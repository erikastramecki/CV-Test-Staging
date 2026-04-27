"use client";

import { PayButton } from "@coin-voyage/paykit";
import { useAccount } from "@coin-voyage/crypto/hooks";
import { ChainType as CVChainType } from "@coin-voyage/shared/types";
import { useEffect, useMemo, useState } from "react";

import { TokenLine } from "@/components/swap/TokenLine";
import { TokenPickerDialog } from "@/components/swap/TokenPickerDialog";
import { TrendingRow } from "@/components/swap/TrendingRow";
import { RoutePreview } from "@/components/swap/RoutePreview";
import { Button } from "@/components/ui/button";
import { ConnectWalletDialog } from "@/components/wallet/ConnectWalletDialog";
import {
  CHAIN_BY_ID,
  ChainType,
  TOKENS,
  validateAddressFormat,
} from "@/lib/chains";
import {
  fetchOrderStatus,
  fetchQuote,
  TERMINAL_STATUSES,
  type OrderStatus,
  type QuoteResponse,
  type SwapDataResponse,
  type SwapIntent,
  type SwapMode,
} from "@/lib/swap-api";

type Step = "compose" | "review" | "execute";
type PickerSide = "src" | "dst" | null;

// Map our local ChainType (string union) → PayKit's ChainType enum.
function toCVChainType(t: ChainType | undefined): CVChainType | undefined {
  if (!t) return undefined;
  return CVChainType[t as keyof typeof CVChainType];
}

export function SwapCard() {
  const [srcChainId, setSrcChainId] = useState(1);
  const [srcTokenIdx, setSrcTokenIdx] = useState(0);
  const [dstChainId, setDstChainId] = useState(8453);
  const [dstTokenIdx, setDstTokenIdx] = useState(0);
  const [amount, setAmount] = useState("");
  const [swapMode] = useState<SwapMode>("ExactIn");
  const [slippageBps, setSlippageBps] = useState(50);

  const [picker, setPicker] = useState<PickerSide>(null);
  const [recipient, setRecipient] = useState("");
  const [step, setStep] = useState<Step>("compose");

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [swapData, setSwapData] = useState<SwapDataResponse | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const srcChain = CHAIN_BY_ID[srcChainId];
  const dstChain = CHAIN_BY_ID[dstChainId];
  const srcToken = TOKENS[srcChainId]?.[srcTokenIdx];
  const dstToken = TOKENS[dstChainId]?.[dstTokenIdx];
  const isCrossChain = srcChainId !== dstChainId;

  // PayKit's useAccount({ chainType }) has a fallback bug: when no account of
  // the requested chain type is connected, it returns the first *any-chain*
  // connected account. We re-filter to enforce the chainType strictly so the
  // SOL destination panel doesn't end up showing an EVM address.
  const srcChainTypeCV = toCVChainType(srcChain?.type);
  const dstChainTypeCV = toCVChainType(dstChain?.type);
  const { account: rawSrcAccount } = useAccount({ chainType: srcChainTypeCV });
  const { account: rawDstAccount } = useAccount({ chainType: dstChainTypeCV });
  const srcAccount =
    rawSrcAccount?.isConnected && rawSrcAccount.chainType === srcChainTypeCV
      ? rawSrcAccount
      : null;
  const dstAccount =
    rawDstAccount?.isConnected && rawDstAccount.chainType === dstChainTypeCV
      ? rawDstAccount
      : null;
  const address = srcAccount?.address;
  const dstWalletAddress = dstAccount?.address;

  // For non-EVM destinations or cross-chain swaps where the user might want a
  // different receiver, surface a recipient field. Default to the wallet
  // connected on the destination chain when available.
  const requiresRecipient = dstChain?.type !== ChainType.EVM || isCrossChain;
  const effectiveRecipient = useMemo(() => {
    if (recipient.trim()) return recipient.trim();
    if (dstWalletAddress) return dstWalletAddress;
    return "";
  }, [recipient, dstWalletAddress]);

  // Reset quote whenever inputs that change quote materially are edited.
  useEffect(() => {
    setQuote(null);
    if (step !== "compose") setStep("compose");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcChainId, srcTokenIdx, dstChainId, dstTokenIdx, amount, swapMode, slippageBps]);

  // PayKit's modal can attempt to broadcast on a chain whose wallet isn't
  // connected (its source-asset selector doesn't gate on connection state).
  // The Solana adapter throws WalletNotConnectedError; the EVM stack throws
  // similar messages. Catch these and open our chain-filtered connect dialog
  // so the user has a clear path to recover.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = String((e.reason as { message?: string } | undefined)?.message ?? e.reason ?? "");
      const stack = String((e.reason as { stack?: string } | undefined)?.stack ?? "");
      const isWalletNotConnected =
        /WalletNotConnectedError|wallet not connected|no wallet connected/i.test(msg);
      if (!isWalletNotConnected) return;
      // Best-effort chain detection from the stack — Solana adapter throws
      // from @solana/wallet-adapter-base; EVM throws from wagmi/viem.
      const looksSolana = /solana|@solana\/wallet-adapter/i.test(`${msg}\n${stack}`);
      const chainGuess = looksSolana
        ? ChainType.SOL
        : srcChain?.type ?? ChainType.EVM;
      setError(
        `Your ${chainGuess} wallet isn't connected — connect it and retry.`,
      );
      setConnectFor(chainGuess);
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, [srcChain?.type]);

  // Poll order status while in execute step until terminal.
  useEffect(() => {
    if (step !== "execute") return;
    const id = swapData?.payorder_id;
    if (!id) return;
    if (orderStatus && TERMINAL_STATUSES.has(orderStatus)) return;
    const ac = new AbortController();
    const tick = async () => {
      try {
        const data = await fetchOrderStatus(id, { signal: ac.signal });
        if (data?.status) setOrderStatus(data.status);
      } catch {
        // swallow — next tick will retry
      }
    };
    tick();
    const handle = setInterval(tick, 5000);
    return () => {
      clearInterval(handle);
      ac.abort();
    };
  }, [step, swapData?.payorder_id, orderStatus]);

  function flipDirection() {
    setSrcChainId(dstChainId);
    setDstChainId(srcChainId);
    setSrcTokenIdx(dstTokenIdx);
    setDstTokenIdx(srcTokenIdx);
  }

  function buildIntent(): SwapIntent | null {
    if (!srcToken || !dstToken || !address || !amount) return null;
    return {
      amount,
      destination_currency: {
        chain_id: dstChainId,
        ...(dstToken.address ? { address: dstToken.address } : {}),
      },
      payment_rail: "CRYPTO",
      swap_mode: swapMode,
      crypto: {
        sender_address: address,
        slippage_bps: slippageBps,
        source_currency: {
          chain_id: srcChainId,
          ...(srcToken.address ? { address: srcToken.address } : {}),
        },
      },
    };
  }

  async function handleGetQuote() {
    setError(null);
    const intent = buildIntent();
    if (!intent) {
      setError("Connect a wallet, pick tokens, and enter an amount");
      return;
    }
    setBusy(true);
    try {
      const data = await fetchQuote(intent);
      setQuote(data);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // Surface address-format mismatches before the user clicks Confirm so PayKit
  // doesn't get a malformed recipient. Returns the input untouched if valid.
  const recipientError = useMemo(() => {
    if (!effectiveRecipient) return null;
    return validateAddressFormat(effectiveRecipient, dstChain?.type);
  }, [effectiveRecipient, dstChain?.type]);

  const [tab, setTab] = useState<"swap" | "buy">("swap");
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Tracks which chain the connect dialog should filter wallets to. null when closed.
  const [connectFor, setConnectFor] = useState<ChainType | "any" | null>(null);

  return (
    <div className="w-full max-w-md space-y-3">
      <TrendingRow
        onPick={(chainId, tokenIdx) => {
          // Trending pills set the source token; user picks destination next.
          setSrcChainId(chainId);
          setSrcTokenIdx(tokenIdx);
        }}
      />

      <div className="rounded-3xl border border-neutral-800 bg-neutral-950/40 p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-1 rounded-full bg-neutral-900/60 p-0.5">
            <TabButton active={tab === "swap"} onClick={() => setTab("swap")}>
              Swap
            </TabButton>
            <TabButton
              active={tab === "buy"}
              disabled
              title="Coming soon"
              onClick={() => setTab("buy")}
            >
              Buy
            </TabButton>
          </div>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Swap settings"
            className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
          >
            ⚙
          </button>
        </div>

        {settingsOpen && (
          <div className="mb-2 space-y-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Slippage tolerance</span>
              <div className="flex items-center gap-1">
                {[10, 50, 100].map((bps) => (
                  <button
                    key={bps}
                    onClick={() => setSlippageBps(bps)}
                    className={`rounded-md border px-2 py-0.5 ${
                      slippageBps === bps
                        ? "border-rose-500/60 bg-rose-500/10 text-rose-200"
                        : "border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    {(bps / 100).toFixed(2)}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="relative space-y-1">
          <TokenLine
            label="From"
            chainId={srcChainId}
            token={srcToken}
            amount={amount}
            amountUsd={
              quote?.input?.currency_amount?.value_usd != null
                ? `$${quote.input.currency_amount.value_usd.toFixed(2)}`
                : "$0.00"
            }
            walletAction={{
              label: address
                ? `${address.slice(0, 6)}…${address.slice(-4)}`
                : `Connect ${srcChain?.short ?? ""} wallet`,
              onClick: () => setConnectFor(srcChain?.type ?? "any"),
            }}
            showCurrencyFlip
            onAmountChange={setAmount}
            onPickAsset={() => setPicker("src")}
          />
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <button
              onClick={flipDirection}
              aria-label="Flip direction"
              className="grid h-9 w-9 place-items-center rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-300 shadow-md transition-colors hover:border-neutral-700 hover:text-white"
            >
              ↓
            </button>
          </div>
          <TokenLine
            label="To"
            chainId={dstChainId}
            token={dstToken}
            amount={
              quote?.output?.currency_amount?.ui_amount_display ||
              quote?.output?.currency_amount?.ui_amount ||
              ""
            }
            amountReadOnly
            amountUsd={
              quote?.output?.currency_amount?.value_usd != null
                ? `$${quote.output.currency_amount.value_usd.toFixed(2)}`
                : "$0.00"
            }
            walletAction={{
              label: dstWalletAddress
                ? `${dstWalletAddress.slice(0, 6)}…${dstWalletAddress.slice(-4)}`
                : `Connect ${dstChain?.short ?? ""} wallet`,
              onClick: () => setConnectFor(dstChain?.type ?? "any"),
            }}
            onPickAsset={() => setPicker("dst")}
          />
        </div>
      </div>

      <RoutePreview quote={quote} srcTicker={srcToken?.ticker ?? ""} dstTicker={dstToken?.ticker ?? ""} />

      {(requiresRecipient || isCrossChain) && (
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-wider text-neutral-500">
            Recipient on {dstChain?.name ?? "destination"}
          </label>
          <input
            id="cv-recipient-input"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={
              dstWalletAddress
                ? `${dstWalletAddress.slice(0, 6)}…${dstWalletAddress.slice(-4)} (connected)`
                : "Paste destination address"
            }
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2 font-mono text-xs outline-none placeholder:text-neutral-600 focus:border-neutral-700"
          />
        </div>
      )}

      {(error || recipientError) && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error ?? recipientError}
        </div>
      )}

      {step === "compose" && (() => {
        const needsSrcWallet = !address;
        const needsRecipient = !needsSrcWallet && requiresRecipient && !effectiveRecipient;
        const label = needsSrcWallet
          ? `Select ${srcChain?.short ?? ""} Wallet`
          : needsRecipient
            ? `Add ${dstChain?.short ?? ""} Recipient`
            : busy
              ? "Quoting…"
              : "Review Swap";
        const onClick = () => {
          if (needsSrcWallet) {
            setConnectFor(srcChain?.type ?? "any");
            return;
          }
          if (needsRecipient) {
            setConnectFor(dstChain?.type ?? "any");
            return;
          }
          handleGetQuote();
        };
        const disabled = busy || (!needsSrcWallet && !needsRecipient && (!amount || !srcToken || !dstToken));
        return (
          <button
            onClick={onClick}
            disabled={disabled}
            className="h-13 w-full rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 py-3.5 text-sm font-semibold uppercase tracking-wider text-white shadow-lg shadow-rose-900/30 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {label}
          </button>
        );
      })()}

      {step === "review" && (
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="ghost" onClick={() => setStep("compose")} className="h-13 px-5">
            Back
          </Button>
          {(() => {
            const outNum =
              typeof quote?.output?.currency_amount?.ui_amount === "number"
                ? quote.output.currency_amount.ui_amount
                : Number(quote?.output?.currency_amount?.ui_amount);
            const canPay =
              !!effectiveRecipient &&
              Number.isFinite(outNum) &&
              outNum > 0 &&
              !!dstChain;
            if (!canPay) {
              return (
                <button
                  disabled
                  className="h-13 w-full rounded-2xl bg-neutral-800 py-3.5 text-sm font-semibold uppercase tracking-wider text-neutral-500"
                >
                  {!effectiveRecipient ? "Add recipient" : "Quote unavailable"}
                </button>
              );
            }
            return (
              <PayButton.Custom
                toChain={dstChainId}
                toToken={dstToken?.address}
                toAmount={outNum}
                toAddress={effectiveRecipient}
                intent="Swap"
                onPaymentStarted={(e) => {
                  setSwapData({ payorder_id: e.payOrderId, status: "PENDING" });
                  setOrderStatus("PENDING");
                  setStep("execute");
                }}
                onPaymentCompleted={() => setOrderStatus("COMPLETED")}
                onPaymentBounced={() => setOrderStatus("REFUNDED")}
                onPaymentCreationError={(e) =>
                  setError(e?.error?.message || "PayKit could not create the order")
                }
              >
                {({ show }) => (
                  <button
                    onClick={show}
                    className="h-13 w-full rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 py-3.5 text-sm font-semibold uppercase tracking-wider text-white shadow-lg shadow-rose-900/30 transition-opacity hover:opacity-95"
                  >
                    Confirm Swap
                  </button>
                )}
              </PayButton.Custom>
            );
          })()}
        </div>
      )}

      {step === "execute" && swapData && (
        <div className="space-y-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Order</span>
            <span className="font-mono">{shortId(swapData.payorder_id)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Status</span>
            <span
              className={`font-medium ${
                orderStatus === "COMPLETED"
                  ? "text-emerald-400"
                  : orderStatus && ["FAILED", "EXPIRED", "REFUNDED"].includes(orderStatus)
                    ? "text-rose-400"
                    : "text-amber-300"
              }`}
            >
              {orderStatus ?? swapData.status ?? "PENDING"}
            </span>
          </div>
          <p className="pt-2 text-neutral-500">
            Polling every 5s. On-chain deposit signing comes next — once you broadcast the
            tx CV returns in <code className="font-mono">data.steps</code>, the status will
            move from PENDING → COMPLETED automatically.
          </p>
        </div>
      )}

      <TokenPickerDialog
        open={picker !== null}
        initialChainId={picker === "src" ? srcChainId : dstChainId}
        onClose={() => setPicker(null)}
        onPick={(chainId, idx) => {
          if (picker === "src") {
            setSrcChainId(chainId);
            setSrcTokenIdx(idx);
          } else if (picker === "dst") {
            setDstChainId(chainId);
            setDstTokenIdx(idx);
          }
        }}
      />

      <ConnectWalletDialog
        open={connectFor !== null}
        chainType={
          connectFor && connectFor !== "any"
            ? toCVChainType(connectFor as ChainType)
            : undefined
        }
        onClose={() => setConnectFor(null)}
      />
    </div>
  );
}

function shortId(id?: string) {
  if (!id) return "—";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function TabButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-neutral-50 text-neutral-950 shadow-sm"
          : "text-neutral-400 hover:text-neutral-200"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
