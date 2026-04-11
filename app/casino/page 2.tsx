"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PayButton } from "@coin-voyage/paykit";
import { ChainId } from "@coin-voyage/paykit/server";
import { useAccount } from "@coin-voyage/crypto/hooks";
import { useApiKeys, useWalletReady } from "../providers";
import { WalletConnectButton, WalletConnectKitModal } from "./WalletConnectKit";
import { CASINO_HOT_WALLET } from "@/lib/casino-config";

// ---------- constants ----------
const RECEIVING_ADDRESS = CASINO_HOT_WALLET.address;
const SETTLEMENT_CHAIN = ChainId.BASE;
const USDC_BASE = CASINO_HOT_WALLET.tokenAddress;
const DEPOSIT_PRESETS = [10, 25, 50, 100];

const COLORS = {
  bg: "#0F212E",
  card: "#1A2C38",
  cardLight: "#213743",
  border: "#2F4553",
  accent: "#00E701",
  text: "#FFFFFF",
  textMuted: "#B1BAD3",
  win: "#00E701",
  loss: "#ED4163",
  gold: "#FFD700",
};

// ---------- types ----------
type Bet = {
  id: number;
  game: string;
  bet_cents: number;
  payout_cents: number;
  result: string;
  payload: string;
  nonce: number;
  created_at: number;
};

type Withdrawal = {
  id: number;
  amount_cents: number;
  status: string;
  tx_hash: string | null;
  requested_at: number;
};

type CoinflipResponse = {
  bet_id: number;
  outcome: "heads" | "tails";
  choice: "heads" | "tails";
  win: boolean;
  bet_cents: number;
  payout_cents: number;
  net_cents: number;
  multiplier: number;
  balance_cents: number;
  provably_fair: { server_seed_hash: string; client_seed: string; nonce: number };
};

// ---------- main page ----------
export default function CasinoPage() {
  const { apiKey } = useApiKeys();
  const walletReady = useWalletReady();

  // Same wagmi Hydrate race we hit on /swap: WalletProvider mounts and fires
  // a setState on useSyncExternalStore subscribers in the same render pass
  // CasinoInner first uses useAccount. Push the inner mount one frame later.
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
      <main style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 32, maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8, color: COLORS.text }}>Sign In Required</h1>
          <p style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 24 }}>
            You need a CoinVoyage API key to deposit and play.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: COLORS.accent,
              color: "#000",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              textDecoration: "none",
            }}
          >
            Authenticate
          </Link>
        </div>
      </main>
    );
  }

  if (!walletReady || !hydrationSettled) {
    return (
      <main style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textMuted, fontSize: 13 }}>
        Loading…
      </main>
    );
  }

  return <CasinoInner />;
}

// ---------- inner ----------
function CasinoInner() {
  const { account } = useAccount({ chainType: undefined, selectedWallet: undefined });
  const [walletKitOpen, setWalletKitOpen] = useState(false);

  const address = account?.isConnected ? account.address ?? null : null;

  // server state
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [seedInfo, setSeedInfo] = useState<{ server_seed_hash: string; client_seed: string; nonce: number } | null>(null);

  // game state
  const [betUsd, setBetUsd] = useState(1);
  const [choice, setChoice] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [lastResult, setLastResult] = useState<CoinflipResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // modals
  const [depositOpen, setDepositOpen] = useState(false);
  const [pendingDeposit, setPendingDeposit] = useState<number | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawUsd, setWithdrawUsd] = useState(0);
  const [fairnessOpen, setFairnessOpen] = useState(false);

  // ---------- API calls ----------
  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch("/api/casino/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (res.ok) {
        setBalanceCents(data.balance_cents);
        setBets(data.bets || []);
        setWithdrawals(data.withdrawals || []);
      }
    } catch (e: any) {
      console.error("[casino] balance error:", e);
    }
  }, [address]);

  const fetchSeed = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch("/api/casino/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, action: "get" }),
      });
      const data = await res.json();
      if (res.ok) setSeedInfo(data);
    } catch (e: any) {
      console.error("[casino] seed error:", e);
    }
  }, [address]);

  const rotateSeed = async () => {
    if (!address) return;
    const res = await fetch("/api/casino/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, action: "rotate" }),
    });
    const data = await res.json();
    if (res.ok) {
      setSeedInfo(data.new_seed);
      if (data.revealed) {
        alert(
          `Old seed revealed:\n\nServer seed: ${data.revealed.server_seed}\nClient seed: ${data.revealed.client_seed}\nFinal nonce: ${data.revealed.final_nonce}\n\nVerify your bets at any HMAC-SHA256 verifier.`,
        );
      }
    }
  };

  // load on connect
  useEffect(() => {
    if (address) {
      refreshBalance();
      fetchSeed();
    } else {
      setBalanceCents(null);
      setBets([]);
      setWithdrawals([]);
      setSeedInfo(null);
    }
  }, [address, refreshBalance, fetchSeed]);

  // ---------- bet ----------
  const flip = async () => {
    if (!address || balanceCents == null) return;
    const amountCents = Math.round(betUsd * 100);
    if (amountCents <= 0) return;
    if (balanceCents < amountCents) {
      setErrorMsg("Insufficient balance");
      return;
    }
    setErrorMsg(null);
    setFlipping(true);

    // brief animation delay so the flip feels physical
    await new Promise((r) => setTimeout(r, 700));

    try {
      const res = await fetch("/api/casino/bet/coinflip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, amountCents, choice }),
      });
      const data = (await res.json()) as CoinflipResponse | { error: string };
      if (!res.ok) {
        setErrorMsg(("error" in data && data.error) || "Bet failed");
        setFlipping(false);
        return;
      }
      const result = data as CoinflipResponse;
      setLastResult(result);
      setBalanceCents(result.balance_cents);
      setSeedInfo((s) => (s ? { ...s, nonce: result.provably_fair.nonce } : s));
      // refresh history in the background
      refreshBalance();
    } catch (e: any) {
      setErrorMsg(e?.message || "Network error");
    } finally {
      setFlipping(false);
    }
  };

  // ---------- deposit ----------
  const handleDepositComplete = async (paymentId?: string) => {
    if (pendingDeposit == null || !address) return;
    if (!paymentId) {
      console.warn("[casino] deposit completed without a payorder_id — relying on webhook to credit");
    }
    try {
      const res = await fetch("/api/casino/credit-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          amountCents: pendingDeposit * 100,
          paymentId: paymentId || null,
        }),
      });
      const data = await res.json();
      if (res.ok) setBalanceCents(data.balance_cents);
    } catch (e: any) {
      console.error("[casino] credit error:", e);
    }
    setDepositOpen(false);
    setPendingDeposit(null);
    refreshBalance();
  };

  // ---------- withdraw ----------
  const submitWithdraw = async () => {
    if (!address) return;
    const amountCents = Math.round(withdrawUsd * 100);
    if (amountCents <= 0 || balanceCents == null || balanceCents < amountCents) {
      setErrorMsg("Invalid withdraw amount");
      return;
    }
    const res = await fetch("/api/casino/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, amountCents }),
    });
    const data = await res.json();
    if (res.ok) {
      setBalanceCents(data.balance_cents);
      setWithdrawOpen(false);
      setWithdrawUsd(0);
      refreshBalance();
      alert(`Withdrawal #${data.withdrawal_id} queued. Will be processed manually.`);
    } else {
      setErrorMsg(data.error || "Withdrawal failed");
    }
  };

  // ---------- derived ----------
  const balanceUsd = balanceCents != null ? balanceCents / 100 : 0;
  const profitOnWin = useMemo(() => betUsd * 1.98 - betUsd, [betUsd]);
  const canBet = address && balanceCents != null && balanceCents >= Math.round(betUsd * 100) && !flipping;

  return (
    <main style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text }}>
      {/* TOP BAR */}
      <div
        style={{
          background: COLORS.card,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
            <span style={{ color: COLORS.accent }}>cv</span>casino
          </div>
          <nav style={{ display: "flex", gap: 16 }}>
            <NavItem label="Casino" active />
            <NavItem label="Sports" />
            <NavItem label="Promotions" />
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* wallet connect via CoinVoyage Connect Kit */}
          <WalletConnectButton
            onOpen={() => setWalletKitOpen(true)}
            account={{
              address: account?.address,
              chainType: account?.chainType,
              isConnected: !!account?.isConnected,
            }}
          />

          {/* balance + deposit + withdraw */}
          {address && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "8px 14px", fontSize: 13, fontWeight: 700, fontFamily: "ui-monospace,monospace" }}>
                ${balanceUsd.toFixed(2)}
              </div>
              <button
                onClick={() => setDepositOpen(true)}
                style={{
                  background: COLORS.accent,
                  color: "#000",
                  border: "none",
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                }}
              >
                Deposit
              </button>
              <button
                onClick={() => {
                  setWithdrawUsd(balanceUsd);
                  setWithdrawOpen(true);
                }}
                disabled={balanceUsd === 0}
                style={{
                  background: COLORS.cardLight,
                  color: balanceUsd === 0 ? COLORS.textMuted : COLORS.text,
                  border: "none",
                  borderLeft: `1px solid ${COLORS.border}`,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: balanceUsd === 0 ? "not-allowed" : "pointer",
                }}
              >
                Withdraw
              </button>
            </div>
          )}

          <Link
            href="/dashboard"
            style={{ color: COLORS.textMuted, fontSize: 12, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* GAME AREA */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Coinflip</h1>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>
              Provably fair · 1% house edge · 1.98× payout
            </div>
          </div>
          {address && (
            <button
              onClick={() => setFairnessOpen(true)}
              style={{
                background: "transparent",
                color: COLORS.accent,
                border: `1px solid ${COLORS.accent}`,
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                cursor: "pointer",
              }}
            >
              Fairness
            </button>
          )}
        </div>

        {!address ? (
          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: 60,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎰</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Connect to play</h2>
            <p style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 20 }}>
              Your wallet address is your account. Balance is custodied on the casino server.
            </p>
            <button
              onClick={() => setWalletKitOpen(true)}
              style={{
                background: COLORS.accent,
                color: "#000",
                border: "none",
                borderRadius: 6,
                padding: "12px 28px",
                fontSize: 13,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                cursor: "pointer",
              }}
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "320px 1fr",
              gap: 16,
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: 20,
            }}
          >
            {/* LEFT: bet controls */}
            <div>
              <Label>Bet Amount (USD)</Label>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={betUsd}
                  onChange={(e) => setBetUsd(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{
                    flex: 1,
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    padding: "10px 12px",
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: "ui-monospace,monospace",
                  }}
                />
                <button onClick={() => setBetUsd((b) => +(b / 2).toFixed(2))} style={iconBtn}>½</button>
                <button onClick={() => setBetUsd((b) => +(b * 2).toFixed(2))} style={iconBtn}>2×</button>
              </div>

              <Label>Profit on Win</Label>
              <div
                style={{
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.win,
                  padding: "10px 12px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: "ui-monospace,monospace",
                  marginBottom: 16,
                }}
              >
                +${profitOnWin.toFixed(2)}
              </div>

              <Label>Pick Side</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                <SideButton
                  active={choice === "heads"}
                  onClick={() => setChoice("heads")}
                  label="Heads"
                  emoji="👑"
                />
                <SideButton
                  active={choice === "tails"}
                  onClick={() => setChoice("tails")}
                  label="Tails"
                  emoji="🪙"
                />
              </div>

              <button
                onClick={flip}
                disabled={!canBet}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: canBet ? COLORS.accent : COLORS.cardLight,
                  color: canBet ? "#000" : COLORS.textMuted,
                  border: "none",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  cursor: canBet ? "pointer" : "not-allowed",
                }}
              >
                {flipping
                  ? "Flipping…"
                  : balanceCents != null && balanceCents < Math.round(betUsd * 100)
                  ? "Insufficient Balance"
                  : "Flip Coin"}
              </button>

              {errorMsg && (
                <div style={{ marginTop: 10, fontSize: 11, color: COLORS.loss }}>{errorMsg}</div>
              )}
            </div>

            {/* RIGHT: coin display */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 20 }}>
              <div
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: "50%",
                  background: lastResult?.win === true
                    ? `radial-gradient(circle, ${COLORS.gold} 0%, #b8860b 100%)`
                    : lastResult?.win === false
                    ? `radial-gradient(circle, ${COLORS.loss}aa 0%, #6b0b1b 100%)`
                    : `radial-gradient(circle, ${COLORS.cardLight} 0%, ${COLORS.bg} 100%)`,
                  border: `4px solid ${
                    lastResult?.win === true
                      ? COLORS.gold
                      : lastResult?.win === false
                      ? COLORS.loss
                      : COLORS.border
                  }`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 80,
                  boxShadow: "0 0 40px rgba(0,0,0,0.5)",
                  animation: flipping ? "coin-flip 0.7s linear" : undefined,
                  marginBottom: 24,
                }}
              >
                {flipping ? "🌀" : lastResult ? (lastResult.outcome === "heads" ? "👑" : "🪙") : "❓"}
              </div>

              {lastResult && !flipping && (
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: lastResult.win ? COLORS.win : COLORS.loss,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}
                  >
                    {lastResult.win ? "Win" : "Loss"} · {lastResult.outcome}
                  </div>
                  <div style={{ fontSize: 14, fontFamily: "ui-monospace,monospace", color: COLORS.textMuted }}>
                    {lastResult.win
                      ? `+$${((lastResult.payout_cents - lastResult.bet_cents) / 100).toFixed(2)}`
                      : `−$${(lastResult.bet_cents / 100).toFixed(2)}`}
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 8 }}>
                    nonce {lastResult.provably_fair.nonce}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* HISTORY */}
        {bets.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Recent Bets
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
              {bets.slice(0, 25).map((b) => {
                const result = safeParse(b.result);
                const win = result?.win;
                const outcome = result?.outcome;
                return (
                  <div
                    key={b.id}
                    title={`#${b.nonce} · ${outcome} · ${win ? "+" : "−"}$${(win ? b.payout_cents - b.bet_cents : b.bet_cents) / 100}`}
                    style={{
                      flex: "0 0 auto",
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      background: win ? "#00E70122" : "#ED416322",
                      border: `1px solid ${win ? COLORS.win : COLORS.loss}55`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                    }}
                  >
                    {outcome === "heads" ? "👑" : "🪙"}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* WALLET CONNECT KIT MODAL */}
      <WalletConnectKitModal open={walletKitOpen} onClose={() => setWalletKitOpen(false)} />

      {/* DEPOSIT MODAL */}
      {depositOpen && (
        <Modal
          onClose={() => {
            setDepositOpen(false);
            setPendingDeposit(null);
          }}
          title="Deposit Crypto"
        >
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Quick Amount
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
            {DEPOSIT_PRESETS.map((amt) => (
              <button
                key={amt}
                onClick={() => setPendingDeposit(amt)}
                style={{
                  padding: "12px",
                  background: pendingDeposit === amt ? COLORS.accent : COLORS.bg,
                  color: pendingDeposit === amt ? "#000" : COLORS.text,
                  border: `1px solid ${pendingDeposit === amt ? COLORS.accent : COLORS.border}`,
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "ui-monospace,monospace",
                }}
              >
                ${amt}
              </button>
            ))}
          </div>

          {pendingDeposit != null && address && (
            <PayButton.Custom
              intent={`Casino Deposit $${pendingDeposit}`}
              toChain={SETTLEMENT_CHAIN}
              toAddress={RECEIVING_ADDRESS}
              toAmount={pendingDeposit}
              toToken={USDC_BASE}
              metadata={{ kind: "casino_deposit", amount: pendingDeposit, address }}
              onPaymentCreationError={(e: any) => console.error("[Paykit]", e)}
              onPaymentStarted={() => console.log("[Paykit] deposit started")}
              onPaymentCompleted={(event: any) => {
                console.log("[Paykit] deposit completed", event);
                // PayOrderCompletedEvent shape: { type, payorder_id, status, payment_data, source_tx_hash, destination_tx_hash, metadata }
                handleDepositComplete(event?.payorder_id);
              }}
              onPaymentBounced={() => console.log("[Paykit] deposit bounced")}
            >
              {({ show }: { show: () => void }) => (
                <button
                  type="button"
                  onClick={show}
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: COLORS.accent,
                    color: "#000",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                  }}
                >
                  Pay With Crypto · ${pendingDeposit}
                </button>
              )}
            </PayButton.Custom>
          )}

          <div style={{ marginTop: 12, fontSize: 10, color: COLORS.textMuted, textAlign: "center" }}>
            Settles to merchant in USDC on Base · pay from any chain via CoinVoyage
          </div>
        </Modal>
      )}

      {/* WITHDRAW MODAL */}
      {withdrawOpen && (
        <Modal onClose={() => setWithdrawOpen(false)} title="Withdraw">
          <Label>Amount (USD)</Label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={balanceUsd}
            value={withdrawUsd}
            onChange={(e) => setWithdrawUsd(Math.max(0, parseFloat(e.target.value) || 0))}
            style={{
              width: "100%",
              background: COLORS.bg,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              padding: "10px 12px",
              borderRadius: 6,
              fontSize: 14,
              fontFamily: "ui-monospace,monospace",
              marginBottom: 12,
            }}
          />
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 16 }}>
            Available: ${balanceUsd.toFixed(2)} · destination: {address?.slice(0, 6)}…{address?.slice(-4)}
          </div>
          <button
            onClick={submitWithdraw}
            disabled={withdrawUsd <= 0 || withdrawUsd > balanceUsd}
            style={{
              width: "100%",
              padding: "14px",
              background: withdrawUsd > 0 && withdrawUsd <= balanceUsd ? COLORS.accent : COLORS.cardLight,
              color: withdrawUsd > 0 && withdrawUsd <= balanceUsd ? "#000" : COLORS.textMuted,
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
            }}
          >
            Queue Withdrawal
          </button>
          <div style={{ marginTop: 10, fontSize: 10, color: COLORS.textMuted, textAlign: "center" }}>
            Withdrawals are processed manually for the demo. Pending list below.
          </div>

          {withdrawals.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Label>Recent Withdrawals</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                {withdrawals.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      background: COLORS.bg,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      padding: "8px 10px",
                      fontSize: 11,
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "ui-monospace,monospace",
                    }}
                  >
                    <span>#{w.id} · ${(w.amount_cents / 100).toFixed(2)}</span>
                    <span style={{ color: w.status === "sent" ? COLORS.win : COLORS.textMuted }}>{w.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* FAIRNESS MODAL */}
      {fairnessOpen && (
        <Modal onClose={() => setFairnessOpen(false)} title="Provably Fair">
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 16 }}>
            Each bet is resolved by HMAC-SHA256(serverSeed, clientSeed:nonce). The server commits to a hash before any bet is placed and reveals the seed when you rotate it.
          </div>

          {seedInfo && (
            <>
              <Label>Server Seed Hash</Label>
              <code style={codeBlock}>{seedInfo.server_seed_hash}</code>

              <Label>Client Seed</Label>
              <code style={codeBlock}>{seedInfo.client_seed}</code>

              <Label>Current Nonce</Label>
              <code style={codeBlock}>{seedInfo.nonce}</code>
            </>
          )}

          <button
            onClick={rotateSeed}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "12px",
              background: COLORS.accent,
              color: "#000",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            Rotate (Reveal Old Seed)
          </button>
        </Modal>
      )}

      <style>{`
        @keyframes coin-flip {
          0%   { transform: rotateY(0deg); }
          50%  { transform: rotateY(900deg) scale(0.9); }
          100% { transform: rotateY(1800deg); }
        }
      `}</style>
    </main>
  );
}

// ---------- subcomponents ----------
function NavItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: active ? COLORS.text : COLORS.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        cursor: "pointer",
        padding: "4px 0",
        borderBottom: active ? `2px solid ${COLORS.accent}` : "2px solid transparent",
      }}
    >
      {label}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: COLORS.textMuted,
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function SideButton({ active, onClick, label, emoji }: { active: boolean; onClick: () => void; label: string; emoji: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? COLORS.accent : COLORS.bg,
        color: active ? "#000" : COLORS.text,
        border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
        borderRadius: 6,
        padding: "12px",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 22 }}>{emoji}</span>
      {label}
    </button>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000088",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 24,
          maxWidth: 460,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ background: "transparent", color: COLORS.textMuted, border: "none", fontSize: 22, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const iconBtn: React.CSSProperties = {
  background: "#1A2C38",
  color: "#B1BAD3",
  border: "1px solid #2F4553",
  padding: "0 12px",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const codeBlock: React.CSSProperties = {
  display: "block",
  background: "#0F212E",
  border: "1px solid #2F4553",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 11,
  fontFamily: "ui-monospace,monospace",
  color: "#B1BAD3",
  wordBreak: "break-all",
  marginBottom: 12,
};
