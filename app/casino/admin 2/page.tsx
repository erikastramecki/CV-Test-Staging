"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CASINO_HOT_WALLET, addressesEqual } from "@/lib/casino-config";

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
  warn: "#F59E0B",
};

const TOKEN_KEY = "cv_casino_admin_token";

type Withdrawal = {
  id: number;
  address: string;
  amount_cents: number;
  status: "queued" | "processing" | "sent" | "rejected" | "failed";
  tx_hash: string | null;
  requested_at: number;
  processed_at: number | null;
};

type Deposit = {
  id: number;
  payment_id: string | null;
  address: string;
  amount_cents: number;
  status: string;
  source: string;
  created_at: number;
};

type StatsMap = Record<string, { count: number; total_cents: number }>;

const STATUS_FILTERS = ["all", "queued", "processing", "sent", "rejected", "failed"] as const;
type Tab = "withdrawals" | "deposits";

export default function CasinoAdminPage() {
  const [token, setToken] = useState<string>("");
  const [authed, setAuthed] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("withdrawals");

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<StatsMap>({});
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("queued");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<number | null>(null);
  const [approveTxHash, setApproveTxHash] = useState("");

  // Hot wallet auto-payout state
  const [hotWalletConfigured, setHotWalletConfigured] = useState(false);
  const [payoutWithdrawal, setPayoutWithdrawal] = useState<Withdrawal | null>(null);
  const [payoutChainId, setPayoutChainId] = useState<number>(8453);
  const [payoutTokenAddress, setPayoutTokenAddress] = useState<string>(
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  );
  const [payoutDestAddress, setPayoutDestAddress] = useState<string>("");
  const [payoutInFlight, setPayoutInFlight] = useState(false);
  const [payoutResult, setPayoutResult] = useState<any>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [depositStats, setDepositStats] = useState<{ count: number; total_cents: number }>({ count: 0, total_cents: 0 });
  const [depositsLoading, setDepositsLoading] = useState(false);

  // pay-order detail (CV API)
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLocal, setDetailLocal] = useState<Deposit | null>(null);

  // hydrate token from sessionStorage
  useEffect(() => {
    const t = sessionStorage.getItem(TOKEN_KEY);
    if (t) {
      setToken(t);
      setAuthed(true);
    }
  }, []);

  const refresh = useCallback(
    async (currentToken = token, currentFilter = filter) => {
      if (!currentToken) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/casino/admin/withdrawals/list", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": currentToken,
          },
          body: JSON.stringify({ status: currentFilter === "all" ? undefined : currentFilter }),
        });
        const data = await res.json();
        if (res.status === 401) {
          setAuthError("Invalid token");
          setAuthed(false);
          sessionStorage.removeItem(TOKEN_KEY);
          return;
        }
        if (res.status === 503) {
          setError(data?.error || "admin not configured");
          return;
        }
        if (!res.ok) {
          setError(data?.error || `HTTP ${res.status}`);
          return;
        }
        setWithdrawals(data.withdrawals || []);
        setStats(data.stats || {});
        setHotWalletConfigured(!!data.hot_wallet_configured);
      } catch (e: any) {
        setError(e?.message || "Network error");
      } finally {
        setLoading(false);
      }
    },
    [token, filter],
  );

  useEffect(() => {
    if (authed && tab === "withdrawals") refresh();
  }, [authed, tab, filter, refresh]);

  const refreshDeposits = useCallback(
    async (currentToken = token) => {
      if (!currentToken) return;
      setDepositsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/casino/admin/deposits/list", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": currentToken,
          },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (res.status === 401) {
          setAuthError("Invalid token");
          setAuthed(false);
          sessionStorage.removeItem(TOKEN_KEY);
          return;
        }
        if (!res.ok) {
          setError(data?.error || `HTTP ${res.status}`);
          return;
        }
        setDeposits(data.deposits || []);
        setDepositStats(data.stats || { count: 0, total_cents: 0 });
      } catch (e: any) {
        setError(e?.message || "Network error");
      } finally {
        setDepositsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (authed && tab === "deposits") refreshDeposits();
  }, [authed, tab, refreshDeposits]);

  // Open the detail modal for a deposit row. Always shows the local DB row,
  // and additionally tries to fetch the full pay-order from CoinVoyage when
  // the deposit has a real payorder_id. Reads cv_api_key / cv_secret_key from
  // localStorage and proxies through /api/sale `status`.
  const openOrderDetail = async (deposit: Deposit) => {
    setDetailOpen(true);
    setDetailLocal(deposit);
    setDetailOrder(null);
    setDetailError(null);

    const paymentId = deposit.payment_id;
    const looksSynthetic =
      !paymentId ||
      paymentId.startsWith("client-") ||
      paymentId.startsWith("test_");

    if (!paymentId) {
      setDetailError("No payment_id stored for this deposit — nothing to fetch from CoinVoyage.");
      return;
    }
    if (looksSynthetic) {
      setDetailError(
        `This deposit has a synthetic ID (${paymentId}) from an old test or fallback — CoinVoyage has no record of it. New deposits will store the real payorder_id.`,
      );
      return;
    }

    setDetailLoading(true);
    try {
      const apiKey = localStorage.getItem("cv_api_key");
      const secretKey = localStorage.getItem("cv_secret_key");
      if (!apiKey || !secretKey) {
        setDetailError("Merchant credentials missing — sign in at / first to fetch CoinVoyage order details.");
        return;
      }
      const res = await fetch("/api/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", apiKey, secretKey, payorder_id: paymentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data?.error || data?.message || `HTTP ${res.status} from CoinVoyage`);
        return;
      }
      setDetailOrder(data);
    } catch (e: any) {
      setDetailError(e?.message || "Network error");
    } finally {
      setDetailLoading(false);
    }
  };

  // ---------- auth ----------
  const submitToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    // try a list call to validate
    const res = await fetch("/api/casino/admin/withdrawals/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": tokenInput,
      },
      body: JSON.stringify({ status: "queued" }),
    });
    if (res.status === 401) {
      setAuthError("Invalid token");
      return;
    }
    if (res.status === 503) {
      const data = await res.json();
      setAuthError(data?.error || "admin not configured");
      return;
    }
    if (!res.ok) {
      setAuthError(`Server error ${res.status}`);
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, tokenInput);
    setToken(tokenInput);
    setAuthed(true);
    setTokenInput("");
  };

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setAuthed(false);
    setWithdrawals([]);
    setStats({});
  };

  // ---------- actions ----------
  const approve = async (id: number, txHash?: string) => {
    setError(null);
    const res = await fetch("/api/casino/admin/withdrawals/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      body: JSON.stringify({ id, txHash: txHash || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || `HTTP ${res.status}`);
      return;
    }
    setApproving(null);
    setApproveTxHash("");
    refresh();
  };

  // ---------- payout ----------
  const openPayoutModal = (w: Withdrawal) => {
    setPayoutWithdrawal(w);
    setPayoutDestAddress(w.address);
    setPayoutChainId(8453);
    setPayoutTokenAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    setPayoutResult(null);
    setPayoutError(null);
  };

  const submitPayout = async () => {
    if (!payoutWithdrawal) return;
    setPayoutInFlight(true);
    setPayoutError(null);
    setPayoutResult(null);
    try {
      const res = await fetch("/api/casino/admin/withdrawals/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({
          id: payoutWithdrawal.id,
          destAddress: payoutDestAddress,
          destChainId: payoutChainId,
          destTokenAddress: payoutTokenAddress || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPayoutError(data?.error || `HTTP ${res.status}`);
        return;
      }
      setPayoutResult(data);
      refresh();
    } catch (e: any) {
      setPayoutError(e?.message || "Network error");
    } finally {
      setPayoutInFlight(false);
    }
  };

  const reject = async (id: number) => {
    if (!confirm(`Reject withdrawal #${id}? The user's balance will be refunded.`)) return;
    setError(null);
    const res = await fetch("/api/casino/admin/withdrawals/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || `HTTP ${res.status}`);
      return;
    }
    refresh();
  };

  // ---------- derived ----------
  const queuedCount = stats.queued?.count ?? 0;
  const queuedCents = stats.queued?.total_cents ?? 0;
  const sentCount = stats.sent?.count ?? 0;
  const sentCents = stats.sent?.total_cents ?? 0;
  const rejectedCount = stats.rejected?.count ?? 0;

  // ---------- auth gate ----------
  if (!authed) {
    return (
      <main style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <form
          onSubmit={submitToken}
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: 32,
            maxWidth: 420,
            width: "100%",
          }}
        >
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Casino Admin</h1>
          <p style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 20 }}>
            Enter the <code style={{ color: COLORS.accent }}>CASINO_ADMIN_TOKEN</code> from your <code style={{ color: COLORS.accent }}>.env</code>.
          </p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Admin token"
            style={{
              width: "100%",
              background: COLORS.bg,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              padding: "12px 14px",
              borderRadius: 6,
              fontSize: 14,
              fontFamily: "ui-monospace,monospace",
              marginBottom: 12,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!tokenInput}
            style={{
              width: "100%",
              padding: 14,
              background: tokenInput ? COLORS.accent : COLORS.cardLight,
              color: tokenInput ? "#000" : COLORS.textMuted,
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              cursor: tokenInput ? "pointer" : "not-allowed",
            }}
          >
            Sign In
          </button>
          {authError && (
            <div style={{ marginTop: 12, fontSize: 12, color: COLORS.loss }}>{authError}</div>
          )}
          <div style={{ marginTop: 16, fontSize: 11, color: COLORS.textMuted, textAlign: "center" }}>
            <Link href="/casino" style={{ color: COLORS.textMuted }}>← Back to casino</Link>
          </div>
        </form>
      </main>
    );
  }

  // ---------- main UI ----------
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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
            <span style={{ color: COLORS.accent }}>cv</span>casino · admin
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link
            href="/casino"
            style={{
              color: COLORS.textMuted,
              fontSize: 12,
              textDecoration: "none",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "6px 12px",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
            }}
          >
            Casino
          </Link>
          <button
            onClick={logout}
            style={{
              background: "transparent",
              color: COLORS.loss,
              border: `1px solid ${COLORS.loss}`,
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        {/* TABS */}
        <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 24, gap: 4 }}>
          <TabButton active={tab === "withdrawals"} onClick={() => setTab("withdrawals")} label="Withdrawals" badge={queuedCount} />
          <TabButton active={tab === "deposits"} onClick={() => setTab("deposits")} label="Deposits" badge={depositStats.count} />
        </div>

        {/* STATS — withdrawals */}
        {tab === "withdrawals" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            <StatCard label="Pending" value={queuedCount} sub={`$${(queuedCents / 100).toFixed(2)} owed`} accent={COLORS.warn} />
            <StatCard label="Sent" value={sentCount} sub={`$${(sentCents / 100).toFixed(2)} paid out`} accent={COLORS.win} />
            <StatCard label="Rejected" value={rejectedCount} sub="refunded to users" accent={COLORS.loss} />
            <StatCard
              label="Hot Wallet Owes"
              value={`$${(queuedCents / 100).toFixed(2)}`}
              sub="must be available"
              accent={COLORS.accent}
            />
          </div>
        )}

        {/* STATS — deposits */}
        {tab === "deposits" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            <StatCard label="Total Deposits" value={depositStats.count} sub="all-time count" accent={COLORS.accent} />
            <StatCard label="Total Volume" value={`$${(depositStats.total_cents / 100).toFixed(2)}`} sub="USDC settled" accent={COLORS.win} />
            <StatCard label="Visible" value={deposits.length} sub="last 200 shown" accent={COLORS.text} />
            <StatCard label="Live Source" value="webhook" sub="+ client callback" accent={COLORS.warn} />
          </div>
        )}

        {/* WITHDRAWALS TAB */}
        {tab === "withdrawals" && (
        <>
        {/* HOT WALLET STATUS */}
        {!hotWalletConfigured && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: "#F59E0B22",
              border: `1px solid ${COLORS.warn}55`,
              borderRadius: 8,
              fontSize: 12,
              color: COLORS.warn,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 14 }}>⚠</span>
            <div style={{ flex: 1 }}>
              <strong>Hot wallet not configured.</strong> Set{" "}
              <code style={{ background: COLORS.bg, padding: "1px 6px", borderRadius: 3, color: COLORS.accent }}>
                CASINO_HOT_WALLET_PRIVATE_KEY
              </code>{" "}
              in <code style={{ color: COLORS.accent }}>.env</code> to enable one-click cross-chain payouts via
              CoinVoyage. Manual approve still works.
            </div>
          </div>
        )}

        {/* FILTERS */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center" }}>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                background: filter === s ? COLORS.accent : "transparent",
                color: filter === s ? "#000" : COLORS.textMuted,
                border: `1px solid ${filter === s ? COLORS.accent : COLORS.border}`,
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => refresh()}
            style={{
              marginLeft: "auto",
              background: "transparent",
              color: COLORS.textMuted,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: 12, background: "#ED416322", border: `1px solid ${COLORS.loss}55`, borderRadius: 6, fontSize: 12, color: COLORS.loss }}>
            {error}
          </div>
        )}

        {/* TABLE */}
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>Loading…</div>
          ) : withdrawals.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
              No withdrawals matching this filter
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: COLORS.cardLight, borderBottom: `1px solid ${COLORS.border}` }}>
                  <Th>ID</Th>
                  <Th>Address</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Requested</Th>
                  <Th>Tx Hash</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <Td>#{w.id}</Td>
                    <Td mono>{w.address.slice(0, 6)}…{w.address.slice(-4)}</Td>
                    <Td mono>${(w.amount_cents / 100).toFixed(2)}</Td>
                    <Td><StatusBadge status={w.status} /></Td>
                    <Td muted>{new Date(w.requested_at).toLocaleString()}</Td>
                    <Td mono muted>
                      {w.tx_hash ? (
                        <span title={w.tx_hash}>{w.tx_hash.slice(0, 10)}…</span>
                      ) : "—"}
                    </Td>
                    <Td align="right">
                      {(w.status === "queued" || w.status === "processing") ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button
                            onClick={() => openPayoutModal(w)}
                            disabled={!hotWalletConfigured}
                            title={hotWalletConfigured ? "Process via CoinVoyage" : "Hot wallet not configured"}
                            style={{
                              background: hotWalletConfigured ? "#a855f7" : COLORS.cardLight,
                              color: hotWalletConfigured ? "#fff" : COLORS.textMuted,
                              border: "none",
                              borderRadius: 4,
                              padding: "5px 10px",
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              cursor: hotWalletConfigured ? "pointer" : "not-allowed",
                            }}
                          >
                            Pay Out
                          </button>
                          <button
                            onClick={() => setApproving(w.id)}
                            style={{
                              background: COLORS.win,
                              color: "#000",
                              border: "none",
                              borderRadius: 4,
                              padding: "5px 10px",
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              cursor: "pointer",
                            }}
                          >
                            Manual
                          </button>
                          <button
                            onClick={() => reject(w.id)}
                            style={{
                              background: "transparent",
                              color: COLORS.loss,
                              border: `1px solid ${COLORS.loss}`,
                              borderRadius: 4,
                              padding: "5px 10px",
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              cursor: "pointer",
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: COLORS.textMuted }}>—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </>
        )}

        {/* DEPOSITS TAB */}
        {tab === "deposits" && detailOpen && detailLocal && (
          <OrderDetailView
            order={detailOrder}
            local={detailLocal}
            loading={detailLoading}
            error={detailError}
            onBack={() => {
              setDetailOpen(false);
              setDetailOrder(null);
              setDetailError(null);
              setDetailLocal(null);
            }}
          />
        )}

        {tab === "deposits" && !detailOpen && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center" }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Click any row to view chain-level transaction details
              </div>
              <button
                onClick={() => refreshDeposits()}
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  color: COLORS.textMuted,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                }}
              >
                ↻ Refresh
              </button>
            </div>

            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
              {depositsLoading ? (
                <div style={{ padding: 40, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>Loading…</div>
              ) : deposits.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
                  No deposits yet
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: COLORS.cardLight, borderBottom: `1px solid ${COLORS.border}` }}>
                      <Th>ID</Th>
                      <Th>User Address</Th>
                      <Th>Amount</Th>
                      <Th>Payment ID</Th>
                      <Th>Source</Th>
                      <Th>Received</Th>
                      <Th align="right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((d) => (
                      <tr
                        key={d.id}
                        onClick={() => openOrderDetail(d)}
                        style={{ borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                      >
                        <Td>#{d.id}</Td>
                        <Td mono>{d.address.slice(0, 6)}…{d.address.slice(-4)}</Td>
                        <Td mono>${(d.amount_cents / 100).toFixed(2)}</Td>
                        <Td mono muted>
                          {d.payment_id ? (
                            <span title={d.payment_id}>{d.payment_id.slice(0, 14)}…</span>
                          ) : "—"}
                        </Td>
                        <Td>
                          <span
                            style={{
                              fontSize: 9,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: d.source === "webhook" ? "#00E70122" : "#F59E0B22",
                              color: d.source === "webhook" ? COLORS.win : COLORS.warn,
                              border: `1px solid ${(d.source === "webhook" ? COLORS.win : COLORS.warn)}55`,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              fontWeight: 800,
                            }}
                          >
                            {d.source}
                          </span>
                        </Td>
                        <Td muted>{new Date(d.created_at).toLocaleString()}</Td>
                        <Td align="right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openOrderDetail(d);
                            }}
                            style={{
                              background: "transparent",
                              color: COLORS.accent,
                              border: `1px solid ${COLORS.accent}`,
                              borderRadius: 4,
                              padding: "5px 10px",
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              cursor: "pointer",
                            }}
                          >
                            View Tx
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* PAYOUT MODAL */}
      {payoutWithdrawal && (
        <div
          onClick={() => {
            if (!payoutInFlight) {
              setPayoutWithdrawal(null);
              setPayoutResult(null);
              setPayoutError(null);
            }
          }}
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
              maxWidth: 520,
              width: "100%",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              Process Payout #{payoutWithdrawal.id}
            </h2>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 16 }}>
              Send <strong style={{ color: COLORS.text }}>${(payoutWithdrawal.amount_cents / 100).toFixed(2)} USDC</strong> from
              the casino hot wallet via CoinVoyage. Bridges automatically if destination is on a different chain.
            </div>

            {payoutResult ? (
              <div>
                <div
                  style={{
                    padding: 14,
                    background: "#22c55e22",
                    border: `1px solid ${COLORS.win}55`,
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.win, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    ✓ Payout Sent
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>Tx Hash</div>
                  <div style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", color: COLORS.text, wordBreak: "break-all", marginBottom: 8 }}>
                    {payoutResult.txHash}
                  </div>
                  {payoutResult.payorderId && (
                    <>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>CoinVoyage Pay Order</div>
                      <div style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", color: COLORS.text, wordBreak: "break-all" }}>
                        {payoutResult.payorderId}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => {
                    setPayoutWithdrawal(null);
                    setPayoutResult(null);
                  }}
                  style={{
                    width: "100%",
                    padding: 12,
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
                  Done
                </button>
              </div>
            ) : (
              <>
                <Label>Destination Chain & Token</Label>
                <select
                  value={`${payoutChainId}|${payoutTokenAddress}`}
                  onChange={(e) => {
                    const [c, t] = e.target.value.split("|");
                    setPayoutChainId(parseInt(c));
                    setPayoutTokenAddress(t);
                  }}
                  style={{
                    width: "100%",
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    padding: "10px 12px",
                    borderRadius: 6,
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                >
                  <option value="8453|0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913">USDC on Base (same chain — fastest, cheapest)</option>
                  <option value="1|0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48">USDC on Ethereum</option>
                  <option value="42161|0xaf88d065e77c8cC2239327C5EDb3A432268e5831">USDC on Arbitrum</option>
                  <option value="10|0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85">USDC on Optimism</option>
                  <option value="137|0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359">USDC on Polygon</option>
                  <option value="30000000000001|EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v">USDC on Solana</option>
                  <option value="1|">ETH on Ethereum (native)</option>
                  <option value="8453|">ETH on Base (native)</option>
                </select>

                <Label>Destination Address</Label>
                <input
                  type="text"
                  value={payoutDestAddress}
                  onChange={(e) => setPayoutDestAddress(e.target.value)}
                  style={{
                    width: "100%",
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    padding: "10px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "ui-monospace,monospace",
                    marginBottom: 6,
                  }}
                />
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 16 }}>
                  Defaults to the user&apos;s wallet ({payoutWithdrawal.address.slice(0, 6)}…{payoutWithdrawal.address.slice(-4)}). Override only if needed.
                </div>

                {payoutError && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: 10,
                      background: "#ED416322",
                      border: `1px solid ${COLORS.loss}55`,
                      borderRadius: 6,
                      fontSize: 11,
                      color: COLORS.loss,
                    }}
                  >
                    {payoutError}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      setPayoutWithdrawal(null);
                      setPayoutError(null);
                    }}
                    disabled={payoutInFlight}
                    style={{
                      flex: 1,
                      padding: 12,
                      background: "transparent",
                      color: COLORS.textMuted,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      cursor: payoutInFlight ? "not-allowed" : "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitPayout}
                    disabled={payoutInFlight || !payoutDestAddress}
                    style={{
                      flex: 2,
                      padding: 12,
                      background: payoutInFlight || !payoutDestAddress ? COLORS.cardLight : "#a855f7",
                      color: payoutInFlight || !payoutDestAddress ? COLORS.textMuted : "#fff",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      cursor: payoutInFlight ? "wait" : "pointer",
                    }}
                  >
                    {payoutInFlight ? "Sending…" : "Send via CoinVoyage"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* APPROVE MODAL */}
      {approving != null && (
        <div
          onClick={() => setApproving(null)}
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
              maxWidth: 480,
              width: "100%",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Approve Withdrawal #{approving}</h2>
            <p style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 16 }}>
              Send the funds from the casino hot wallet to the user&apos;s address, then paste the transaction hash below
              (optional). Marking as approved is irreversible.
            </p>
            <label style={{ display: "block", fontSize: 11, color: COLORS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Tx Hash (optional)
            </label>
            <input
              type="text"
              value={approveTxHash}
              onChange={(e) => setApproveTxHash(e.target.value)}
              placeholder="0x…"
              style={{
                width: "100%",
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                padding: "10px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "ui-monospace,monospace",
                marginBottom: 16,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setApproving(null);
                  setApproveTxHash("");
                }}
                style={{
                  flex: 1,
                  padding: 12,
                  background: "transparent",
                  color: COLORS.textMuted,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => approve(approving!, approveTxHash)}
                style={{
                  flex: 2,
                  padding: 12,
                  background: COLORS.win,
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
                Mark as Sent
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------- subcomponents ----------
function TabButton({ active, onClick, label, badge }: { active: boolean; onClick: () => void; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? COLORS.card : "transparent",
        color: active ? COLORS.text : COLORS.textMuted,
        border: active ? `1px solid ${COLORS.border}` : "1px solid transparent",
        borderBottom: active ? `1px solid ${COLORS.card}` : "1px solid transparent",
        borderRadius: "8px 8px 0 0",
        padding: "10px 18px",
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        cursor: "pointer",
        marginBottom: -1,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {label}
      {badge != null && badge > 0 && (
        <span
          style={{
            background: COLORS.accent,
            color: "#000",
            fontSize: 9,
            fontWeight: 900,
            padding: "2px 6px",
            borderRadius: 999,
            lineHeight: 1,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// Cyberpunk red-glow theme for the merchant-style detail view, distinct from
// the casino navy theme used by the rest of the admin page.
const TX = {
  bg: "#0a0a0a",
  border: "#331111",
  text: "#ffffff",
  textMuted: "#9ca3af",
  textDim: "#6b7280",
  pink: "#ff0033",
  pinkLight: "#ff6666",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  gold: "#fbbf24",
};

const txCardStyle: React.CSSProperties = {
  background: TX.bg,
  border: `1px solid ${TX.border}`,
  borderRadius: 8,
  padding: 20,
  boxShadow: "0 0 30px rgba(255, 0, 51, 0.15), inset 0 0 1px rgba(255, 51, 51, 0.3)",
};

function OrderDetailView({
  order,
  local,
  loading,
  error,
  onBack,
}: {
  order: any;
  local: Deposit;
  loading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  const status = order?.status || (local.status === "credited" ? "COMPLETED" : local.status?.toUpperCase());
  const mode = order?.mode || "DEPOSIT";

  // The actual address the funds settled to (per CoinVoyage), if available.
  const orderReceivingAddress: string | undefined =
    order?.fulfillment?.receiving_address || order?.payment?.receiving_address;
  const settledToAddress = orderReceivingAddress || CASINO_HOT_WALLET.address;
  const settledChainId =
    order?.fulfillment?.asset?.chain_id || order?.payment?.dst?.chain_id || CASINO_HOT_WALLET.chainId;
  const matchesHotWallet = addressesEqual(settledToAddress, CASINO_HOT_WALLET.address);
  const verified = matchesHotWallet && (!orderReceivingAddress || addressesEqual(orderReceivingAddress, CASINO_HOT_WALLET.address));

  return (
    <div>
      {/* HOT WALLET CALLOUT — settled into / paid out from the same wallet */}
      <div
        style={{
          ...txCardStyle,
          marginBottom: 16,
          borderColor: verified ? "#22c55e55" : "#f59e0b55",
          boxShadow: verified
            ? "0 0 30px rgba(34, 197, 94, 0.18), inset 0 0 1px rgba(34, 197, 94, 0.4)"
            : "0 0 30px rgba(245, 158, 11, 0.18), inset 0 0 1px rgba(245, 158, 11, 0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <CardLabel>Casino Hot Wallet · Settled & Payout Source</CardLabel>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontFamily: "ui-monospace,monospace",
              padding: "3px 10px",
              borderRadius: 4,
              border: `1px solid ${verified ? "#22c55e" : "#f59e0b"}`,
              color: verified ? "#22c55e" : "#f59e0b",
            }}
          >
            {verified ? "✓ Verified" : "⚠ Mismatch"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: TX.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              Hot Wallet Address
            </div>
            <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, color: TX.text, wordBreak: "break-all", lineHeight: 1.4 }}>
              {CASINO_HOT_WALLET.address}
            </div>
            <div style={{ fontSize: 10, color: TX.textDim, marginTop: 4 }}>
              {CASINO_HOT_WALLET.chainName} · chain {CASINO_HOT_WALLET.chainId} · {CASINO_HOT_WALLET.tokenSymbol}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: TX.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              This Order Settled To
            </div>
            <div
              style={{
                fontFamily: "ui-monospace,monospace",
                fontSize: 12,
                color: matchesHotWallet ? TX.green : TX.amber,
                wordBreak: "break-all",
                lineHeight: 1.4,
              }}
            >
              {settledToAddress}
            </div>
            <div style={{ fontSize: 10, color: TX.textDim, marginTop: 4 }}>
              chain {settledChainId} {orderReceivingAddress ? "· from CoinVoyage" : "· from local config"}
            </div>
          </div>
        </div>

        {!matchesHotWallet && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              background: "#f59e0b22",
              border: "1px solid #f59e0b55",
              borderRadius: 4,
              fontSize: 11,
              color: "#f59e0b",
            }}
          >
            ⚠ The receiving address on this order does not match the configured casino hot wallet. Investigate
            before issuing a payout — funds may have settled to an unexpected address.
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: "#0a0a0a",
            border: `1px solid ${TX.border}`,
            borderRadius: 4,
            fontSize: 11,
            color: TX.textMuted,
            lineHeight: 1.5,
          }}
        >
          Withdrawals to this user&apos;s address ({local.address.slice(0, 6)}…{local.address.slice(-4)}) will be
          paid out from this same hot wallet. Verify the wallet has enough{" "}
          <strong style={{ color: TX.text }}>{CASINO_HOT_WALLET.tokenSymbol}</strong> on{" "}
          <strong style={{ color: TX.text }}>{CASINO_HOT_WALLET.chainName}</strong> before approving a withdrawal.
        </div>
      </div>
      {/* BACK */}
      <button
        onClick={onBack}
        style={{
          background: "transparent",
          color: TX.pinkLight,
          border: "none",
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          cursor: "pointer",
          padding: "8px 0",
          marginBottom: 16,
        }}
      >
        ← Back to Deposits
      </button>

      {loading && (
        <div style={{ ...txCardStyle, marginBottom: 16, fontSize: 13, color: TX.textMuted }}>
          Loading from CoinVoyage…
        </div>
      )}

      {error && (
        <div
          style={{
            ...txCardStyle,
            marginBottom: 16,
            borderColor: `${TX.red}55`,
            color: TX.red,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* TWO-COLUMN GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* ORDER */}
          <div style={txCardStyle}>
            <CardLabel>Order</CardLabel>
            <FieldRow label="ID" value={<Mono>{order?.id || local.payment_id || `local-${local.id}`}</Mono>} />
            <FieldRow label="Mode" value={mode} />
            <FieldRow label="Status" value={<TxStatusBadge status={status} />} />
            <FieldRow label="Created" value={order?.created_at ? new Date(order.created_at).toLocaleString() : new Date(local.created_at).toLocaleString()} />
            <FieldRow label="Updated" value={order?.updated_at ? new Date(order.updated_at).toLocaleString() : "—"} />
          </div>

          {/* FULFILLMENT */}
          <div style={txCardStyle}>
            <CardLabel>Fulfillment</CardLabel>
            <TokenRow
              imageUri={order?.fulfillment?.asset?.image_uri}
              ticker={order?.fulfillment?.asset?.ticker || "USDC"}
              chainId={order?.fulfillment?.asset?.chain_id || 8453}
              fallbackName="USDC"
            />
            <FieldRow
              label="Amount"
              value={
                order?.fulfillment?.amount?.ui_amount_display ||
                order?.fulfillment?.amount?.ui_amount ||
                (local.amount_cents / 100).toFixed(2)
              }
            />
            <FieldRow
              label="USD Value"
              value={
                order?.fulfillment?.amount?.value_usd != null
                  ? `$${order.fulfillment.amount.value_usd.toFixed(2)}`
                  : `$${(local.amount_cents / 100).toFixed(2)}`
              }
            />
            <FieldRow label="Fiat" value={order?.fulfillment?.fiat ? JSON.stringify(order.fulfillment.fiat) : "—"} />
            <FieldRow
              label="Receiving Address"
              value={
                <Mono>
                  {order?.fulfillment?.receiving_address || local.address}
                </Mono>
              }
            />
          </div>

          {/* TRANSACTION HASHES */}
          <div style={txCardStyle}>
            <CardLabel>Transaction Hashes</CardLabel>
            <FieldRow
              label="Deposit TX"
              value={order?.deposit_tx_hash ? <Mono color={TX.pinkLight}>{order.deposit_tx_hash}</Mono> : <Dash color={TX.pinkLight} />}
            />
            <FieldRow
              label="Receiving TX"
              value={order?.receiving_tx_hash ? <Mono color={TX.green}>{order.receiving_tx_hash}</Mono> : <Dash color={TX.green} />}
            />
            <FieldRow
              label="Refund TX"
              value={order?.refund_tx_hash ? <Mono color={TX.amber}>{order.refund_tx_hash}</Mono> : <Dash color={TX.amber} />}
            />
          </div>

          {/* LOCAL LEDGER (extra context for admin) */}
          <div style={txCardStyle}>
            <CardLabel>Local Ledger Entry</CardLabel>
            <FieldRow label="Deposit ID" value={`#${local.id}`} />
            <FieldRow label="Source" value={local.source} />
            <FieldRow label="Status" value={local.status} />
            <FieldRow label="Created" value={new Date(local.created_at).toLocaleString()} />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* PAYMENT SOURCE */}
          <div style={txCardStyle}>
            <CardLabel>Payment Source</CardLabel>
            {order?.payment?.src ? (
              <>
                <TokenRow
                  imageUri={order.payment.src.image_uri}
                  ticker={order.payment.src.ticker || order.payment.src.name}
                  name={order.payment.src.name}
                  chainId={order.payment.src.chain_id}
                />
                <FieldRow label="Total" value={<Mono small>{fmtAmount(order.payment.src.total)}</Mono>} />
                <FieldRow label="Fees" value={<Mono small>{fmtAmount(order.payment.src.fees)}</Mono>} />
              </>
            ) : (
              <div style={{ color: TX.textDim, fontSize: 12 }}>
                {loading ? "Loading…" : "No source data available"}
              </div>
            )}
          </div>

          {/* PAYMENT DESTINATION */}
          <div style={txCardStyle}>
            <CardLabel>Payment Destination</CardLabel>
            <TokenRow
              imageUri={order?.payment?.dst?.image_uri || order?.fulfillment?.asset?.image_uri}
              ticker={order?.payment?.dst?.ticker || order?.fulfillment?.asset?.ticker || "USDC"}
              name={order?.payment?.dst?.name || order?.fulfillment?.asset?.name || "USD Coin"}
              chainId={order?.payment?.dst?.chain_id || order?.fulfillment?.asset?.chain_id || 8453}
            />
            <FieldRow
              label="Deposit Address"
              value={
                <Mono>{order?.payment?.deposit_address || "—"}</Mono>
              }
            />
            <FieldRow
              label="Receiving Address"
              value={
                <Mono>{order?.payment?.receiving_address || local.address}</Mono>
              }
            />
            <FieldRow
              label="Expires"
              value={order?.payment?.expires_at ? new Date(order.payment.expires_at).toLocaleString() : "—"}
            />
          </div>

          {/* EXECUTION STEPS */}
          <div style={txCardStyle}>
            <CardLabel>Execution Steps</CardLabel>
            {order?.payment?.execution && order.payment.execution.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {order.payment.execution.map((step: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      background: "#050505",
                      border: `1px solid ${TX.border}`,
                      borderRadius: 6,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {step.provider || "STEP"}
                      </span>
                      <TxStatusBadge status={step.status} amber />
                    </div>
                    <div style={{ fontSize: 12, color: TX.textMuted, marginBottom: 6 }}>
                      {step.source_currency?.ticker || "?"} → {step.destination_currency?.ticker || "?"}
                    </div>
                    {step.source_tx_hash && (
                      <div
                        style={{
                          fontFamily: "ui-monospace,monospace",
                          fontSize: 10,
                          color: TX.pinkLight,
                          wordBreak: "break-all",
                          lineHeight: 1.4,
                        }}
                      >
                        {step.source_tx_hash}
                      </div>
                    )}
                    {step.error && (
                      <div style={{ marginTop: 4, fontSize: 10, color: TX.red }}>{step.error}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: TX.textDim, fontSize: 12 }}>
                {loading ? "Loading…" : "No execution steps"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: TX.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontWeight: 700,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        padding: "6px 0",
        fontSize: 13,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: TX.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: TX.text,
          textAlign: "right",
          minWidth: 0,
          wordBreak: "break-all",
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function TokenRow({
  imageUri,
  ticker,
  name,
  chainId,
  fallbackName,
}: {
  imageUri?: string;
  ticker?: string;
  name?: string;
  chainId?: number | string;
  fallbackName?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "#1e3a8a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
          color: "#fff",
          fontWeight: 800,
          fontSize: 12,
        }}
      >
        {imageUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUri}
            alt=""
            style={{ width: 36, height: 36, objectFit: "cover" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          (ticker || fallbackName || "?").slice(0, 1)
        )}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: TX.text }}>
          {name || ticker || fallbackName || "—"}
        </div>
        <div style={{ fontSize: 11, color: TX.textMuted, fontFamily: "ui-monospace,monospace", marginTop: 2 }}>
          {chainId || "—"}
        </div>
      </div>
    </div>
  );
}

function TxStatusBadge({ status, amber = false }: { status?: string; amber?: boolean }) {
  if (!status) return <span style={{ color: TX.textDim }}>—</span>;
  const isCompleted = status === "COMPLETED";
  const isFailed = status === "FAILED" || status === "ERROR";
  const isExpired = status === "EXPIRED";

  let color = TX.green;
  if (amber && isCompleted) color = TX.amber;
  if (isFailed) color = TX.red;
  if (isExpired) color = TX.textDim;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        border: `1px solid ${color}`,
        color,
        background: "transparent",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontFamily: "ui-monospace,monospace",
      }}
    >
      {status}
    </span>
  );
}

function Mono({
  children,
  color = "#ffffff",
  small = false,
}: {
  children: React.ReactNode;
  color?: string;
  small?: boolean;
}) {
  return (
    <span
      style={{
        fontFamily: "ui-monospace,monospace",
        fontSize: small ? 10 : 12,
        color,
        wordBreak: "break-all",
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  );
}

function Dash({ color }: { color: string }) {
  return <span style={{ color, fontWeight: 700 }}>—</span>;
}


function DetailCard({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: accent || COLORS.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 800,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", fontSize: 12 }}>
      <span style={{ color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ color: COLORS.text, textAlign: "right", minWidth: 0, wordBreak: "break-word" }}>{value || "—"}</span>
    </div>
  );
}

function fmtAmount(a: any): string {
  if (a == null) return "—";
  if (typeof a === "string" || typeof a === "number") return String(a);
  if (typeof a === "object") {
    return (
      a.ui_amount_display ||
      a.ui_amount ||
      a.value ||
      a.amount ||
      JSON.stringify(a)
    );
  }
  return "—";
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

function StatCard({ label, value, sub, accent }: { label: string; value: any; sub: string; accent: string }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, fontFamily: "ui-monospace,monospace" }}>{value}</div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { fg: string; bg: string }> = {
    queued: { fg: COLORS.warn, bg: "#F59E0B22" },
    processing: { fg: "#A855F7", bg: "#A855F722" },
    sent: { fg: COLORS.win, bg: "#00E70122" },
    rejected: { fg: COLORS.loss, bg: "#ED416322" },
    failed: { fg: COLORS.loss, bg: "#ED416322" },
  };
  const c = colors[status] || { fg: COLORS.textMuted, bg: COLORS.cardLight };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.fg}55`,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {status}
    </span>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "10px 14px",
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: COLORS.textMuted,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  mono = false,
  muted = false,
  align = "left",
}: {
  children: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
  align?: "left" | "right";
}) {
  return (
    <td
      style={{
        padding: "12px 14px",
        fontSize: 12,
        fontFamily: mono ? "ui-monospace,monospace" : undefined,
        color: muted ? COLORS.textMuted : COLORS.text,
        textAlign: align,
      }}
    >
      {children}
    </td>
  );
}
