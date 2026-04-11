"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useApiKeys, useWalletReady } from "../providers";
import { ChainType } from "@coin-voyage/shared/types";
import {
  useAccount,
  useInstalledWallets,
  usePrepareTransaction,
  useUniversalConnect,
} from "@coin-voyage/crypto/hooks";
import { useSwitchChain } from "wagmi";

// ---------- chain config ----------
const CHAINS: Record<number, { name: string; type: ChainType }> = {
  1: { name: "Ethereum", type: ChainType.EVM },
  10: { name: "Optimism", type: ChainType.EVM },
  56: { name: "BSC", type: ChainType.EVM },
  137: { name: "Polygon", type: ChainType.EVM },
  324: { name: "zkSync", type: ChainType.EVM },
  8453: { name: "Base", type: ChainType.EVM },
  42161: { name: "Arbitrum", type: ChainType.EVM },
  43114: { name: "Avalanche", type: ChainType.EVM },
  81457: { name: "Blast", type: ChainType.EVM },
  30000000000001: { name: "Solana", type: ChainType.SOL },
  30000000000002: { name: "Sui", type: ChainType.SUI },
  20000000000001: { name: "Bitcoin", type: ChainType.UTXO },
  30000000000003: { name: "Tron", type: ChainType.TRON },
};

// ---------- token catalog ----------
type Token = { ticker: string; name: string; address?: string; decimals: number };
const TOKENS: Record<number, Token[]> = {
  1: [
    { ticker: "ETH", name: "Ether", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  ],
  10: [
    { ticker: "ETH", name: "Ether", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
  ],
  56: [
    { ticker: "BNB", name: "BNB", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
    { ticker: "USDT", name: "Tether", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
  ],
  137: [
    { ticker: "POL", name: "Polygon", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
  ],
  324: [
    { ticker: "ETH", name: "Ether", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4", decimals: 6 },
  ],
  8453: [
    { ticker: "ETH", name: "Ether", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
  ],
  42161: [
    { ticker: "ETH", name: "Ether", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
  ],
  43114: [
    { ticker: "AVAX", name: "Avalanche", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
  ],
  81457: [{ ticker: "ETH", name: "Ether", decimals: 18 }],
  30000000000001: [
    { ticker: "SOL", name: "Solana", decimals: 9 },
    { ticker: "USDC", name: "USD Coin", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  ],
  30000000000002: [{ ticker: "SUI", name: "Sui", decimals: 9 }],
  20000000000001: [{ ticker: "BTC", name: "Bitcoin", decimals: 8 }],
  30000000000003: [{ ticker: "TRX", name: "Tron", decimals: 6 }],
};

// ---------- helpers ----------
const truncate = (s?: string, len = 12) => {
  if (!s) return "—";
  if (s.length <= len) return s;
  return s.slice(0, len / 2) + "…" + s.slice(-len / 2);
};

// Validate that an address looks like it belongs to a given ChainType.
// Returns null if valid, or a human-readable error string if not.
function validateAddressFormat(address: string, chainType: ChainType | undefined): string | null {
  if (!address) return "Address is empty";
  if (!chainType) return null;

  if (chainType === ChainType.EVM) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return "Destination chain is EVM — address must be 0x… (42 chars)";
    }
  } else if (chainType === ChainType.SOL) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      return "Destination chain is Solana — address must be base58 (32–44 chars)";
    }
  } else if (chainType === ChainType.UTXO) {
    // very loose: bitcoin addresses are 26-62 chars, multiple formats
    if (address.length < 26 || address.length > 90) {
      return "Destination chain is Bitcoin — address looks malformed";
    }
  } else if (chainType === ChainType.SUI) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(address)) {
      return "Destination chain is Sui — address must be 0x… (66 chars)";
    }
  }
  return null;
}

const cardStyle: React.CSSProperties = {
  background: "var(--card-bg)",
  border: "1px solid #1a1a1a",
  borderRadius: 16,
  padding: 20,
};

const inputStyle: React.CSSProperties = {
  background: "var(--input-bg)",
  border: "1px solid #1a1a1a",
  borderRadius: 12,
  padding: "10px 14px",
  color: "#fff",
  fontSize: 13,
  width: "100%",
  outline: "none",
};

const btnPrimary: React.CSSProperties = {
  background: "linear-gradient(135deg, #ff0033 0%, #cc0029 100%)",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "12px 20px",
  fontSize: 13,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  cursor: "pointer",
  width: "100%",
};

const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "#9ca3af",
  border: "1px solid #1a1a1a",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 12,
  cursor: "pointer",
};

// ---------- debug log entry ----------
type LogEntry = {
  ts: string;
  type: "REQUEST" | "RESPONSE" | "ERROR" | "INFO";
  label: string;
  payload?: any;
};

// ---------- main ----------
export default function SwapContentPage() {
  const walletReady = useWalletReady();
  const { apiKey } = useApiKeys();

  // Extra mount gate: wagmi's Hydrate triggers setState on subscribers during
  // the same render pass that WalletProvider mounts. We push SwapInner's first
  // render one frame later so wagmi's hydration settles before useAccount
  // subscribes. Without this, React 19 errors with
  // "Cannot update a component while rendering a different component".
  const [hydrationSettled, setHydrationSettled] = useState(false);
  useEffect(() => {
    if (!walletReady) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) setHydrationSettled(true);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [walletReady]);

  if (!apiKey) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ ...cardStyle, maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Not Authenticated</h1>
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>
            Set your CoinVoyage API key to use the swap.
          </p>
          <Link href="/" style={{ ...btnPrimary, display: "inline-block", textDecoration: "none" }}>
            Go to Authenticate
          </Link>
        </div>
      </main>
    );
  }

  if (!walletReady || !hydrationSettled) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, color: "#6b7280", fontSize: 13 }}>
        Initializing wallet…
      </main>
    );
  }

  return <SwapInner />;
}

// ---------- inner component (after wallet ready) ----------
function SwapInner() {
  const { apiKey } = useApiKeys();

  // chains/tokens
  const [srcChainId, setSrcChainId] = useState<number>(8453);
  const [dstChainId, setDstChainId] = useState<number>(8453);
  const [srcTokenIdx, setSrcTokenIdx] = useState(0);
  const [dstTokenIdx, setDstTokenIdx] = useState(1);
  const [amount, setAmount] = useState("10");
  const [swapMode, setSwapMode] = useState<"ExactIn" | "ExactOut">("ExactIn");
  const [slippageBps, setSlippageBps] = useState(100);
  const [showSettings, setShowSettings] = useState(false);

  // wallets — independent
  const srcChainType = CHAINS[srcChainId]?.type;
  const dstChainType = CHAINS[dstChainId]?.type;
  const { account: srcAccount } = useAccount({ chainType: srcChainType, selectedWallet: undefined });
  const { account: dstAccount } = useAccount({ chainType: dstChainType, selectedWallet: undefined });
  const srcWallets = useInstalledWallets(srcChainType);
  const dstWallets = useInstalledWallets(dstChainType);
  const { connect } = useUniversalConnect();
  const preparedTx = usePrepareTransaction(srcChainType);
  const { switchChainAsync } = useSwitchChain();

  const [walletPickerMode, setWalletPickerMode] = useState<"source" | "dest" | null>(null);
  const [pendingDstCapture, setPendingDstCapture] = useState(false);
  const [dstAddress, setDstAddress] = useState("");
  const [receivingAddressManual, setReceivingAddressManual] = useState("");

  // capture destination wallet address after connecting
  useEffect(() => {
    if (pendingDstCapture && dstAccount?.address) {
      setDstAddress(dstAccount.address);
      setPendingDstCapture(false);
    }
  }, [pendingDstCapture, dstAccount?.address]);

  const receivingAddress = receivingAddressManual || dstAddress || "";
  const receivingAddressError = receivingAddress
    ? validateAddressFormat(receivingAddress, dstChainType)
    : null;

  // step
  const [step, setStep] = useState<"configure" | "review" | "execute">("configure");

  // quote/data
  const [quote, setQuote] = useState<any>(null);
  const [swapData, setSwapData] = useState<any>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // debug
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const log = useCallback((entry: Omit<LogEntry, "ts">) => {
    setLogs((prev) => [{ ts: new Date().toISOString(), ...entry }, ...prev].slice(0, 200));
  }, []);

  const isBridge = srcChainId !== dstChainId;
  const srcToken = TOKENS[srcChainId]?.[srcTokenIdx];
  const dstToken = TOKENS[dstChainId]?.[dstTokenIdx];

  // ---------- swap direction ----------
  const flipDirection = () => {
    setSrcChainId(dstChainId);
    setDstChainId(srcChainId);
    setSrcTokenIdx(dstTokenIdx);
    setDstTokenIdx(srcTokenIdx);
    setQuote(null);
  };

  // ---------- intent builder ----------
  const buildIntent = useCallback(() => {
    if (!srcToken || !dstToken || !srcAccount?.address) return null;
    return {
      amount,
      destination_currency: {
        chain_id: dstChainId,
        ...(dstToken.address ? { address: dstToken.address } : {}),
      },
      payment_rail: "CRYPTO",
      swap_mode: swapMode,
      crypto: {
        sender_address: srcAccount.address,
        slippage_bps: slippageBps,
        source_currency: {
          chain_id: srcChainId,
          ...(srcToken.address ? { address: srcToken.address } : {}),
        },
      },
    };
  }, [amount, dstChainId, dstToken, srcAccount?.address, srcChainId, srcToken, slippageBps, swapMode]);

  // ---------- get quote ----------
  const getQuote = async () => {
    setErrorMsg(null);
    const intent = buildIntent();
    if (!intent) {
      setErrorMsg("Connect source wallet and pick tokens first");
      return;
    }
    setBusy(true);
    log({ type: "REQUEST", label: "POST /swap/quote", payload: { intent } });
    try {
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quote", apiKey, intent }),
      });
      const data = await res.json();
      log({ type: res.ok ? "RESPONSE" : "ERROR", label: "swap/quote", payload: data });
      if (!res.ok) {
        setErrorMsg(data?.error || data?.message || `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setQuote(data);
      setStep("review");
    } catch (e: any) {
      log({ type: "ERROR", label: "swap/quote exception", payload: { message: e?.message } });
      setErrorMsg(e?.message || "Quote failed");
    } finally {
      setBusy(false);
    }
  };

  // ---------- get swap data (proceed to execute) ----------
  const getSwapData = async () => {
    setErrorMsg(null);
    const intent = buildIntent();
    if (!intent) return;
    if (!receivingAddress) {
      setErrorMsg("No receiving address — connect destination wallet or paste an address");
      return;
    }
    const addrErr = validateAddressFormat(receivingAddress, dstChainType);
    if (addrErr) {
      setErrorMsg(addrErr);
      log({ type: "ERROR", label: "address validation", payload: { address: receivingAddress, dstChainType, error: addrErr } });
      return;
    }
    setBusy(true);
    log({ type: "REQUEST", label: "POST /swap/data", payload: { intent, receiving_address: receivingAddress } });
    try {
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "data", apiKey, intent, receiving_address: receivingAddress }),
      });
      const data = await res.json();
      log({ type: res.ok ? "RESPONSE" : "ERROR", label: "swap/data", payload: data });
      if (!res.ok) {
        setErrorMsg(data?.error || data?.message || `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setSwapData(data);
      setOrderStatus(data?.status || "PENDING");
      setStep("execute");
    } catch (e: any) {
      log({ type: "ERROR", label: "swap/data exception", payload: { message: e?.message } });
      setErrorMsg(e?.message || "Swap data failed");
    } finally {
      setBusy(false);
    }
  };

  // ---------- poll order status ----------
  useEffect(() => {
    if (step !== "execute" || !swapData?.payorder_id) return;
    const terminal = ["COMPLETED", "FAILED", "EXPIRED", "REFUNDED"];
    if (orderStatus && terminal.includes(orderStatus)) return;

    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/sale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", apiKey, payorder_id: swapData.payorder_id }),
        });
        const data = await res.json();
        if (data?.status) {
          setOrderStatus(data.status);
          log({ type: "INFO", label: "status poll", payload: { status: data.status } });
        }
      } catch (e: any) {
        log({ type: "ERROR", label: "status poll error", payload: { message: e?.message } });
      }
    }, 5000);

    return () => clearInterval(id);
  }, [step, swapData?.payorder_id, orderStatus, apiKey, log]);

  // ---------- sign & send ----------
  const signAndSend = async () => {
    setErrorMsg(null);
    if (!swapData?.data || !srcAccount?.address || !preparedTx) {
      setErrorMsg("Missing swap data or wallet");
      return;
    }
    setBusy(true);
    try {
      // EVM chain switch if needed
      if (srcChainType === ChainType.EVM && srcAccount.chainId !== srcChainId) {
        log({ type: "INFO", label: "switchChain", payload: { from: srcAccount.chainId, to: srcChainId } });
        await switchChainAsync({ chainId: srcChainId });
      }

      const steps = swapData.data.steps || [];
      const txStep = steps.find((s: any) => s.kind === "transaction" || s?.data?.crypto);
      const depositStep = steps.find((s: any) => s.kind === "deposit") || steps[0];

      let hash: string | undefined;

      if (txStep && txStep.data?.crypto) {
        log({ type: "REQUEST", label: "execute transaction step", payload: txStep });
        hash = await preparedTx.execute({
          from: srcAccount.address,
          paymentData: txStep.data.crypto,
        } as any);
      } else if (depositStep) {
        const depositAddress = swapData.data.deposit_address || depositStep?.data?.deposit_address;
        const src = swapData.data.src;
        const totalRaw = src?.total?.raw_amount;
        if (!depositAddress || !totalRaw) {
          setErrorMsg("Missing deposit address or amount");
          setBusy(false);
          return;
        }
        const amountBig = BigInt(totalRaw);

        if (srcToken?.address) {
          log({ type: "REQUEST", label: "ERC20 transfer to deposit", payload: { depositAddress, amount: totalRaw } });
          hash = await preparedTx.execute({
            from: srcAccount.address,
            to: depositAddress,
            amount: amountBig,
            chainId: srcChainId,
            token: { address: srcToken.address, decimals: srcToken.decimals },
          } as any);
        } else {
          log({ type: "REQUEST", label: "native transfer to deposit", payload: { depositAddress, amount: totalRaw } });
          hash = await preparedTx.execute({
            from: srcAccount.address,
            to: depositAddress,
            amount: amountBig,
            chainId: srcChainId,
          } as any);
        }
      }

      if (hash) {
        setTxHash(hash);
        log({ type: "RESPONSE", label: "tx hash", payload: { hash } });
      }
    } catch (e: any) {
      log({ type: "ERROR", label: "sign & send exception", payload: { message: e?.message } });
      setErrorMsg(e?.message || "Transaction failed");
    } finally {
      setBusy(false);
    }
  };

  // ---------- wallet connect ----------
  const connectWallet = async (mode: "source" | "dest", connector: any) => {
    log({ type: "REQUEST", label: `connect ${mode}`, payload: { connector: connector?.id, chainType: connector?.chainType } });
    if (mode === "dest") setPendingDstCapture(true);
    try {
      await connect({ walletConnector: connector });
      setWalletPickerMode(null);
      log({ type: "RESPONSE", label: `connect ${mode} ok`, payload: {} });
    } catch (e: any) {
      log({ type: "ERROR", label: `connect ${mode} failed`, payload: { message: e?.message, stack: e?.stack } });
      setErrorMsg(`Wallet connect failed: ${e?.message || "unknown error"}`);
      setPendingDstCapture(false);
    }
  };

  // Handle the destination wallet button click. Special-cases:
  //  1. Same chain type as source AND source is connected → just copy the
  //     source address (you can't have two distinct accounts of the same
  //     chain type from one browser).
  //  2. Different chain type but a wallet of that type is already connected
  //     elsewhere → capture it directly without re-connecting.
  //  3. Otherwise → open the wallet picker.
  const handleDestClick = () => {
    setErrorMsg(null);
    if (srcChainType === dstChainType && srcAccount?.isConnected && srcAccount.address) {
      setDstAddress(srcAccount.address);
      log({ type: "INFO", label: "dest captured from source", payload: { address: srcAccount.address } });
      return;
    }
    if (dstAccount?.isConnected && dstAccount.address) {
      setDstAddress(dstAccount.address);
      log({ type: "INFO", label: "dest captured from existing wallet", payload: { address: dstAccount.address } });
      return;
    }
    setWalletPickerMode(walletPickerMode === "dest" ? null : "dest");
  };

  const useSourceAsDest = () => {
    if (srcAccount?.address) {
      setReceivingAddressManual("");
      setDstAddress(srcAccount.address);
      log({ type: "INFO", label: "use source as dest", payload: { address: srcAccount.address } });
    }
  };

  // ---------- render ----------
  const accent = isBridge ? "var(--bridge-purple)" : "var(--pink-primary)";

  return (
    <main style={{ minHeight: "100vh", background: "var(--background)", padding: 40 }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>{isBridge ? "Bridge" : "Swap"}</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/dashboard" style={{ ...btnGhost, textDecoration: "none" }}>Dashboard</Link>
            <Link href="/" style={{ ...btnGhost, textDecoration: "none" }}>Auth</Link>
          </div>
        </div>

        {/* card */}
        <div style={cardStyle}>
          {/* wallet bar */}
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <button
                onClick={() => setWalletPickerMode(walletPickerMode === "source" ? null : "source")}
                style={{ ...btnGhost, flex: 1, marginRight: 8, textAlign: "left" }}
              >
                {srcAccount?.isConnected
                  ? `Source: ${truncate(srcAccount.address, 14)} · ${srcAccount.chainType}`
                  : "Connect Source Wallet"}
              </button>
              <span
                style={{
                  background: accent,
                  color: "#fff",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {isBridge ? "Bridge" : "Swap"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={handleDestClick}
                style={{ ...btnGhost, flex: 1, textAlign: "left", minWidth: 0 }}
              >
                {dstAddress || receivingAddressManual
                  ? `Dest: ${truncate(receivingAddressManual || dstAddress, 14)}`
                  : "Connect Destination Wallet"}
              </button>
              {(dstAddress || receivingAddressManual) && (
                <button
                  onClick={() => {
                    setDstAddress("");
                    setReceivingAddressManual("");
                  }}
                  style={btnGhost}
                >
                  Change
                </button>
              )}
              {srcAccount?.isConnected && srcChainType === dstChainType && (
                <button onClick={useSourceAsDest} style={btnGhost}>
                  Use Source
                </button>
              )}
              <button
                onClick={() => {
                  const v = window.prompt("Receiving address");
                  if (v) setReceivingAddressManual(v);
                }}
                style={btnGhost}
              >
                Paste
              </button>
            </div>

            {/* address mismatch warning */}
            {receivingAddressError && (
              <div style={{ marginTop: 8, padding: 8, background: "#7f1d1d33", border: "1px solid #ef444455", borderRadius: 8, fontSize: 11, color: "#fca5a5" }}>
                ⚠ {receivingAddressError}
              </div>
            )}

            {/* wallet picker dropdown */}
            {walletPickerMode && (
              <div style={{ marginTop: 12, padding: 12, background: "var(--input-bg)", borderRadius: 12, border: "1px solid #1a1a1a" }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Available {walletPickerMode === "source" ? "Source" : "Destination"} Wallets
                </div>
                {(walletPickerMode === "source" ? srcWallets : dstWallets).map((w: any) => (
                  <div key={w.id} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                    {w.connectors.map((c: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => connectWallet(walletPickerMode!, c)}
                        style={{ ...btnGhost, padding: "6px 10px" }}
                      >
                        {w.name} {c.chainType ? `(${c.chainType})` : ""}
                      </button>
                    ))}
                  </div>
                ))}
                {(walletPickerMode === "source" ? srcWallets : dstWallets).length === 0 && (
                  <div style={{ fontSize: 12, color: "#6b7280" }}>No wallets installed for this chain type</div>
                )}
              </div>
            )}
          </div>

          {/* configure step */}
          {step === "configure" && (
            <>
              {/* FROM */}
              <Field label="From">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <ChainSelect value={srcChainId} onChange={(c) => { setSrcChainId(c); setSrcTokenIdx(0); setQuote(null); }} />
                  <TokenSelect chainId={srcChainId} value={srcTokenIdx} onChange={setSrcTokenIdx} />
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  style={{ ...inputStyle, fontSize: 28, fontWeight: 700, textAlign: "right" }}
                />
              </Field>

              {/* swap direction */}
              <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
                <button
                  onClick={flipDirection}
                  className="swap-flip"
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid #1a1a1a",
                    borderRadius: "50%",
                    width: 40,
                    height: 40,
                    color: "#9ca3af",
                    fontSize: 18,
                    cursor: "pointer",
                    transition: "transform 0.3s",
                  }}
                >
                  ↕
                </button>
              </div>

              {/* TO */}
              <Field label="To">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <ChainSelect value={dstChainId} onChange={(c) => { setDstChainId(c); setDstTokenIdx(0); setQuote(null); }} />
                  <TokenSelect chainId={dstChainId} value={dstTokenIdx} onChange={setDstTokenIdx} />
                </div>
                <div style={{ ...inputStyle, fontSize: 28, fontWeight: 700, textAlign: "right", color: "#9ca3af" }}>
                  {quote?.output?.currency_amount?.ui_amount_display || quote?.output?.currency_amount?.ui_amount || "—"}
                </div>
              </Field>

              {/* settings */}
              <div style={{ marginTop: 16 }}>
                <button onClick={() => setShowSettings(!showSettings)} style={btnGhost}>
                  {showSettings ? "Hide" : "Show"} Settings
                </button>
                {showSettings && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--input-bg)", borderRadius: 12 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Mode
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      {(["ExactIn", "ExactOut"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setSwapMode(m)}
                          style={{
                            ...btnGhost,
                            background: swapMode === m ? accent : "transparent",
                            color: swapMode === m ? "#fff" : "#9ca3af",
                            borderColor: swapMode === m ? accent : "#1a1a1a",
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Slippage
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      {[50, 100, 200, 500].map((bps) => (
                        <button
                          key={bps}
                          onClick={() => setSlippageBps(bps)}
                          style={{
                            ...btnGhost,
                            background: slippageBps === bps ? accent : "transparent",
                            color: slippageBps === bps ? "#fff" : "#9ca3af",
                            borderColor: slippageBps === bps ? accent : "#1a1a1a",
                          }}
                        >
                          {bps / 100}%
                        </button>
                      ))}
                    </div>

                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Receiving Address (optional override)
                    </div>
                    <input
                      type="text"
                      value={receivingAddressManual}
                      onChange={(e) => setReceivingAddressManual(e.target.value)}
                      placeholder="0x… or paste address"
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>

              {/* CTA */}
              <div style={{ marginTop: 20 }}>
                {!srcAccount?.isConnected ? (
                  <button onClick={() => setWalletPickerMode("source")} style={btnPrimary}>
                    Connect Wallet
                  </button>
                ) : (
                  <button onClick={getQuote} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>
                    {busy ? "Getting Quote…" : "Get Quote"}
                  </button>
                )}
              </div>

              {errorMsg && <div style={{ marginTop: 12, fontSize: 12, color: "var(--error)" }}>{errorMsg}</div>}
            </>
          )}

          {/* review step */}
          {step === "review" && quote && (
            <ReviewView
              quote={quote}
              srcToken={srcToken}
              dstToken={dstToken}
              srcChainId={srcChainId}
              dstChainId={dstChainId}
              slippageBps={slippageBps}
              swapMode={swapMode}
              isBridge={isBridge}
              accent={accent}
              busy={busy}
              onBack={() => setStep("configure")}
              onProceed={getSwapData}
              errorMsg={errorMsg}
            />
          )}

          {/* execute step */}
          {step === "execute" && swapData && (
            <ExecuteView
              swapData={swapData}
              orderStatus={orderStatus}
              txHash={txHash}
              busy={busy}
              accent={accent}
              srcChainType={srcChainType}
              srcAccount={srcAccount}
              srcChainId={srcChainId}
              onBack={() => { setStep("configure"); setSwapData(null); setOrderStatus(null); setTxHash(null); }}
              onSign={signAndSend}
              errorMsg={errorMsg}
            />
          )}
        </div>

        {/* debug console */}
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setShowDebug(!showDebug)} style={btnGhost}>
            {showDebug ? "Hide" : "Show"} Debug Console ({logs.length})
          </button>
          {showDebug && (
            <div style={{ ...cardStyle, marginTop: 8, maxHeight: 320, overflowY: "auto", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Logs ({logs.length})
                </span>
                <button onClick={() => setLogs([])} style={{ ...btnGhost, padding: "4px 8px", fontSize: 10 }}>
                  Clear
                </button>
              </div>
              {logs.length === 0 ? (
                <div style={{ fontSize: 11, color: "#6b7280" }}>No logs yet</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #1a1a1a" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 9,
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontWeight: 700,
                          background:
                            l.type === "REQUEST" ? "#1e3a8a" :
                            l.type === "RESPONSE" ? "#14532d" :
                            l.type === "ERROR" ? "#7f1d1d" : "#374151",
                          color: "#fff",
                        }}
                      >
                        {l.type}
                      </span>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>{l.label}</span>
                      <span style={{ fontSize: 9, color: "#6b7280", marginLeft: "auto" }}>
                        {new Date(l.ts).toLocaleTimeString()}
                      </span>
                    </div>
                    {l.payload != null && (
                      <pre style={{ fontSize: 9, color: "#9ca3af", overflowX: "auto", margin: 0 }}>
                        {JSON.stringify(l.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        :global(.swap-flip:hover) {
          transform: rotate(180deg);
          color: var(--pink-primary);
        }
      `}</style>
    </main>
  );
}

// ---------- subcomponents ----------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ChainSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} style={inputStyle}>
      {Object.entries(CHAINS).map(([id, c]) => (
        <option key={id} value={id}>{c.name}</option>
      ))}
    </select>
  );
}

function TokenSelect({ chainId, value, onChange }: { chainId: number; value: number; onChange: (v: number) => void }) {
  const list = TOKENS[chainId] || [];
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} style={inputStyle}>
      {list.map((t, i) => (
        <option key={i} value={i}>{t.ticker}</option>
      ))}
    </select>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const colors: Record<string, string> = {
    PENDING: "#f59e0b",
    AWAITING_PAYMENT: "#3b82f6",
    AWAITING_CONFIRMATION: "#a855f7",
    EXECUTING_ORDER: "#a855f7",
    COMPLETED: "#22c55e",
    FAILED: "#ef4444",
    EXPIRED: "#6b7280",
    REFUNDED: "#f59e0b",
  };
  const color = colors[status || ""] || "#6b7280";
  return (
    <span style={{
      fontSize: 10,
      padding: "4px 10px",
      borderRadius: 8,
      background: `${color}1a`,
      color,
      border: `1px solid ${color}55`,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      fontWeight: 700,
    }}>
      {status || "—"}
    </span>
  );
}

function ReviewView(props: {
  quote: any;
  srcToken: Token | undefined;
  dstToken: Token | undefined;
  srcChainId: number;
  dstChainId: number;
  slippageBps: number;
  swapMode: string;
  isBridge: boolean;
  accent: string;
  busy: boolean;
  onBack: () => void;
  onProceed: () => void;
  errorMsg: string | null;
}) {
  const { quote, srcToken, dstToken, srcChainId, dstChainId, slippageBps, swapMode, isBridge, accent, busy, onBack, onProceed, errorMsg } = props;
  const priceImpact = quote?.price_impact ?? 0;
  const piColor = priceImpact > 5 ? "#ef4444" : priceImpact > 1 ? "#f59e0b" : "#22c55e";

  return (
    <div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Review {isBridge ? "Bridge" : "Swap"}
      </div>

      <div style={{ background: "var(--input-bg)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>Route</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {srcToken?.ticker} ({CHAINS[srcChainId]?.name}) → {dstToken?.ticker} ({CHAINS[dstChainId]?.name})
        </div>
      </div>

      <Row label="You Pay" value={`${quote?.input?.currency_amount?.ui_amount_display || quote?.input?.currency_amount?.ui_amount || "—"} ${quote?.input?.ticker || srcToken?.ticker || ""}`} />
      <Row label="You Receive" value={`${quote?.output?.currency_amount?.ui_amount_display || quote?.output?.currency_amount?.ui_amount || "—"} ${quote?.output?.ticker || dstToken?.ticker || ""}`} />
      <Row label="USD Value" value={quote?.output?.currency_amount?.value_usd != null ? `$${quote.output.currency_amount.value_usd.toFixed(2)}` : "—"} />
      <Row label="Price Impact" value={<span style={{ color: piColor }}>{priceImpact.toFixed(2)}%</span>} />
      <Row label="Slippage" value={`${slippageBps / 100}%`} />
      <Row label="Mode" value={swapMode} />
      <Row label="Fees" value={JSON.stringify(quote?.output?.fees) || "—"} />
      <Row label="Gas" value={JSON.stringify(quote?.output?.gas) || "—"} />

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onBack} style={{ ...btnGhost, flex: 1 }}>Back</button>
        <button onClick={onProceed} disabled={busy} style={{ ...btnPrimary, background: `linear-gradient(135deg, ${accent} 0%, ${accent} 100%)`, opacity: busy ? 0.5 : 1, flex: 2 }}>
          {busy ? "Loading…" : isBridge ? "Bridge Now" : "Swap Now"}
        </button>
      </div>

      {errorMsg && <div style={{ marginTop: 12, fontSize: 12, color: "var(--error)" }}>{errorMsg}</div>}
    </div>
  );
}

function ExecuteView(props: {
  swapData: any;
  orderStatus: string | null;
  txHash: string | null;
  busy: boolean;
  accent: string;
  srcChainType: any;
  srcAccount: any;
  srcChainId: number;
  onBack: () => void;
  onSign: () => void;
  errorMsg: string | null;
}) {
  const { swapData, orderStatus, txHash, busy, accent, srcChainType, srcAccount, srcChainId, onBack, onSign, errorMsg } = props;
  const data = swapData?.data || {};
  const wrongChain = srcChainType === ChainType.EVM && srcAccount?.chainId && srcAccount.chainId !== srcChainId;

  const copyDeposit = () => {
    if (data.deposit_address) navigator.clipboard.writeText(data.deposit_address);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Execute</div>
        <StatusBadge status={orderStatus} />
      </div>

      <Row label="Order ID" value={<span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11 }}>{truncate(swapData?.payorder_id, 20)}</span>} />
      <Row label="You Pay" value={`${data?.src?.currency_amount?.ui_amount_display || data?.src?.currency_amount?.ui_amount || "—"} ${data?.src?.ticker || ""}`} />
      <Row label="You Receive" value={`${data?.dst?.currency_amount?.ui_amount_display || data?.dst?.currency_amount?.ui_amount || "—"} ${data?.dst?.ticker || ""}`} />
      <Row
        label="Deposit Address"
        value={
          <button onClick={copyDeposit} style={{ background: "transparent", border: "none", color: "#ff6666", fontFamily: "ui-monospace,monospace", fontSize: 11, cursor: "pointer" }}>
            {truncate(data?.deposit_address, 24)} 📋
          </button>
        }
      />
      <Row label="Expires" value={data?.expires_at ? new Date(data.expires_at).toLocaleString() : "—"} />
      {txHash && <Row label="Tx Hash" value={<span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, color: "#22c55e" }}>{truncate(txHash, 24)}</span>} />}

      {wrongChain && (
        <div style={{ marginTop: 12, padding: 10, background: "#f59e0b1a", border: "1px solid #f59e0b55", borderRadius: 8, fontSize: 12, color: "#f59e0b" }}>
          Wallet on chain {srcAccount.chainId}, swap requires chain {srcChainId}. Will switch on sign.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onBack} style={{ ...btnGhost, flex: 1 }}>Back</button>
        <button
          onClick={onSign}
          disabled={busy || ["COMPLETED", "FAILED", "EXPIRED", "REFUNDED"].includes(orderStatus || "")}
          style={{ ...btnPrimary, background: `linear-gradient(135deg, ${accent} 0%, ${accent} 100%)`, opacity: busy ? 0.5 : 1, flex: 2 }}
        >
          {busy ? "Signing…" : "Sign & Send"}
        </button>
      </div>

      {errorMsg && <div style={{ marginTop: 12, fontSize: 12, color: "var(--error)" }}>{errorMsg}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a1a1a", fontSize: 13 }}>
      <span style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ color: "#fff", textAlign: "right" }}>{value}</span>
    </div>
  );
}
