"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

// ---------- types ----------
type PayOrderStatus =
  | "PENDING"
  | "AWAITING_PAYMENT"
  | "OPTIMISTIC_CONFIRMED"
  | "AWAITING_CONFIRMATION"
  | "EXECUTING_ORDER"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED";

type Order = {
  id: string;
  mode: "SALE" | "DEPOSIT" | "REFUND";
  status: PayOrderStatus;
  created_at: string;
  updated_at: string;
  fulfillment?: {
    asset?: { chain_id?: string; ticker?: string; name?: string; image_uri?: string };
    amount?: { ui_amount?: number; ui_amount_display?: string; value_usd?: number };
    fiat?: any;
    receiving_address?: string;
  };
  payment?: {
    src?: { chain_id?: string; name?: string; ticker?: string; image_uri?: string; total?: any; fees?: any };
    dst?: { chain_id?: string; name?: string; ticker?: string; image_uri?: string; currency_amount?: any };
    deposit_address?: string;
    receiving_address?: string;
    refund_address?: string;
    expires_at?: string;
    execution?: Array<{
      provider?: string;
      status?: string;
      source_currency?: { ticker?: string };
      destination_currency?: { ticker?: string };
      source_tx_hash?: string;
      error?: string;
    }>;
  };
  metadata?: {
    items?: Array<{ name?: string; image?: string; quantity?: number; unit_price?: any; currency?: string }>;
  };
  deposit_tx_hash?: string;
  receiving_tx_hash?: string;
  refund_tx_hash?: string;
};

type Webhook = {
  id: string;
  url: string;
  webhook_secret?: string;
  subscription_events?: string[];
  active: boolean;
};

const ALL_EVENT_TYPES = [
  "ORDER_CREATED",
  "ORDER_AWAITING_PAYMENT",
  "ORDER_CONFIRMING",
  "ORDER_EXECUTING",
  "ORDER_COMPLETED",
  "ORDER_ERROR",
  "ORDER_REFUNDED",
];

// ---------- helpers ----------
function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

function truncate(str?: string, len = 16) {
  if (!str) return "—";
  if (str.length <= len) return str;
  return str.slice(0, len / 2) + "..." + str.slice(-len / 2);
}

const cardShadow = {
  boxShadow:
    "0 0 30px rgba(255, 0, 51, 0.15), inset 0 0 1px rgba(255, 51, 51, 0.3)",
};

// ---------- status badge ----------
function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    PENDING: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
    AWAITING_PAYMENT: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
    OPTIMISTIC_CONFIRMED: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
    AWAITING_CONFIRMATION: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
    EXECUTING_ORDER: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
    COMPLETED: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
    FAILED: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
    EXPIRED: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/30" },
    REFUNDED: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  };
  const s = map[status || ""] || map.PENDING;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider border ${s.bg} ${s.text} ${s.border}`}>
      {status || "—"}
    </span>
  );
}

// ---------- main page ----------
export default function DashboardPage() {
  // auth
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // tabs
  const [tab, setTab] = useState<"orders" | "webhooks" | "events" | "settings">("orders");

  // orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<{ total_count?: number; limit?: number; offset?: number }>({});
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // webhooks
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);

  // events
  const [events, setEvents] = useState<any[]>([]);
  const [wsEvents, setWsEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // websocket
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // fee balance
  const [feeBalance, setFeeBalance] = useState<{ amount_cents?: number } | null>(null);

  // ---------- auth gate ----------
  useEffect(() => {
    const a = localStorage.getItem("cv_api_key");
    const s = localStorage.getItem("cv_secret_key");
    setApiKey(a);
    setSecretKey(s);
    setAuthChecked(true);
  }, []);

  const isAuthenticated = !!apiKey && !!secretKey;

  // ---------- fetchers ----------
  const fetchOrders = useCallback(
    async (offset = 0) => {
      if (!apiKey || !secretKey) return;
      setOrdersLoading(true);
      try {
        const res = await fetch("/api/sale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", apiKey, secretKey, limit: PAGE_SIZE, offset }),
        });
        const json = await res.json();
        setOrders(json.data || []);
        setPagination(json.pagination || {});
      } catch (e) {
        console.error("[orders] fetch error:", e);
      } finally {
        setOrdersLoading(false);
      }
    },
    [apiKey, secretKey],
  );

  const fetchWebhooks = useCallback(async () => {
    if (!apiKey || !secretKey) return;
    setWebhooksLoading(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", apiKey, secretKey }),
      });
      const json = await res.json();
      setWebhooks(json.data || json.webhooks || []);
    } catch (e) {
      console.error("[webhooks] fetch error:", e);
    } finally {
      setWebhooksLoading(false);
    }
  }, [apiKey, secretKey]);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-events" }),
      });
      const json = await res.json();
      setEvents(json.events || []);
    } catch (e) {
      console.error("[events] fetch error:", e);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const fetchFeeBalance = useCallback(async () => {
    if (!apiKey || !secretKey) return;
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fee-balance", apiKey, secretKey }),
      });
      const json = await res.json();
      setFeeBalance(json);
    } catch (e) {
      console.error("[fee-balance] fetch error:", e);
    }
  }, [apiKey, secretKey]);

  // ---------- initial load ----------
  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders(0);
      fetchFeeBalance();
    }
  }, [isAuthenticated, fetchOrders, fetchFeeBalance]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (tab === "webhooks") fetchWebhooks();
    if (tab === "events") fetchEvents();
  }, [tab, isAuthenticated, fetchWebhooks, fetchEvents]);

  // ---------- websocket ----------
  const connectWs = useCallback(() => {
    if (!apiKey) return;
    if (wsRef.current) return;
    const ws = new WebSocket("wss://api.coinvoyage.io/v2/ws");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "connect", data: { api_key: apiKey } }));
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "connected") {
          setWsConnected(true);
          ws.send(JSON.stringify({ type: "subscribe", data: {} }));
        } else if (msg.type === "event") {
          setWsEvents((prev) =>
            [{ ...msg.data, received_at: new Date().toISOString(), source: "websocket" }, ...prev].slice(0, 100),
          );
          fetchOrders(page * PAGE_SIZE);
        } else if (msg.type === "error") {
          console.error("[ws] error:", msg.data);
        }
      } catch (err) {
        console.error("[ws] parse error:", err);
      }
    };
    ws.onclose = () => {
      setWsConnected(false);
      wsRef.current = null;
    };
    ws.onerror = (e) => {
      console.error("[ws] error event:", e);
    };
  }, [apiKey, fetchOrders, page]);

  const disconnectWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // ---------- stats ----------
  const stats = useMemo(() => {
    return {
      total: pagination.total_count ?? orders.length,
      completed: orders.filter((o) => o.status === "COMPLETED").length,
      pending: orders.filter((o) =>
        ["PENDING", "AWAITING_PAYMENT", "AWAITING_CONFIRMATION", "EXECUTING_ORDER"].includes(o.status),
      ).length,
      failed: orders.filter((o) => ["FAILED", "EXPIRED"].includes(o.status)).length,
      totalVolume: orders.reduce((sum, o) => sum + (o.fulfillment?.amount?.value_usd || 0), 0),
    };
  }, [orders, pagination]);

  // ---------- webhook crud ----------
  const createWebhook = async () => {
    if (!newUrl) return;
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        apiKey,
        secretKey,
        url: newUrl,
        subscription_events: selectedEventTypes.length ? selectedEventTypes : undefined,
      }),
    });
    setNewUrl("");
    setSelectedEventTypes([]);
    fetchWebhooks();
  };

  const toggleWebhook = async (w: Webhook) => {
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        apiKey,
        secretKey,
        webhook_id: w.id,
        active: !w.active,
      }),
    });
    fetchWebhooks();
  };

  const deleteWebhook = async (w: Webhook) => {
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        apiKey,
        secretKey,
        webhook_id: w.id,
      }),
    });
    fetchWebhooks();
  };

  const clearAllEvents = async () => {
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear-events" }),
    });
    setEvents([]);
    setWsEvents([]);
  };

  // ---------- gate ----------
  if (!authChecked) return null;
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center p-10">
        <div className="bg-[#0a0a0a] border border-[#331111] p-8 max-w-md text-center" style={cardShadow}>
          <h1 className="text-xl mb-2">Not Authenticated</h1>
          <p className="text-sm text-gray-400 mb-6">
            Set your CoinVoyage API key and secret to access the dashboard.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 uppercase tracking-wider text-xs text-white"
            style={{ background: "linear-gradient(135deg, #ff0033 0%, #cc0029 100%)" }}
          >
            Go to Authenticate
          </Link>
        </div>
      </main>
    );
  }

  // ---------- render ----------
  return (
    <main className="max-w-[1200px] mx-auto p-10">
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={wsConnected ? disconnectWs : connectWs}
            className={`px-3 py-2 uppercase tracking-wider text-xs flex items-center gap-2 border ${
              wsConnected
                ? "border-green-500/50 text-green-400"
                : "border-[#331111] text-gray-400 hover:text-[#ff6666]"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-400" : "bg-gray-600"}`} />
            {wsConnected ? "Live" : "Offline"}
          </button>
          <Link
            href="/swap"
            className="px-3 py-2 uppercase tracking-wider text-xs border border-[#331111] hover:border-[#ff0033] hover:text-[#ff6666]"
          >
            Swap
          </Link>
          <Link
            href="/checkout"
            className="px-3 py-2 uppercase tracking-wider text-xs border border-[#331111] hover:border-[#ff0033] hover:text-[#ff6666]"
          >
            Checkout
          </Link>
          <Link
            href="/"
            className="px-3 py-2 uppercase tracking-wider text-xs border border-[#331111] hover:border-[#ff0033] hover:text-[#ff6666]"
          >
            Auth
          </Link>
        </div>
      </div>

      {/* stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <StatCard label="Total Orders" value={stats.total} />
        <StatCard label="Completed" value={stats.completed} accent="text-green-400" />
        <StatCard label="In Progress" value={stats.pending} accent="text-blue-400" />
        <StatCard label="Failed" value={stats.failed} accent="text-red-400" />
        <StatCard label="Volume USD" value={`$${stats.totalVolume.toFixed(2)}`} accent="text-amber-400" />
      </div>

      {/* fee balance */}
      <div
        className="bg-[#0a0a0a] border border-amber-500/30 p-3 mb-6 flex items-center justify-between text-sm"
        style={cardShadow}
      >
        <span className="text-gray-400 uppercase tracking-wider text-xs">Fee Balance</span>
        <span className="text-amber-400 font-mono">
          ${feeBalance?.amount_cents != null ? (feeBalance.amount_cents / 100).toFixed(2) : "0.00"}
        </span>
      </div>

      {/* tabs */}
      <div className="flex border-b border-[#331111] mb-6">
        <TabButton active={tab === "orders"} onClick={() => setTab("orders")} label="Orders" />
        <TabButton active={tab === "webhooks"} onClick={() => setTab("webhooks")} label="Webhooks" badge={webhooks.length} />
        <TabButton active={tab === "events"} onClick={() => setTab("events")} label="Events" badge={events.length + wsEvents.length} />
        <TabButton active={tab === "settings"} onClick={() => setTab("settings")} label="Settings" />
      </div>

      {/* tab content */}
      {tab === "orders" && (
        <OrdersTab
          orders={orders}
          loading={ordersLoading}
          page={page}
          setPage={(p) => {
            setPage(p);
            fetchOrders(p * PAGE_SIZE);
          }}
          pageSize={PAGE_SIZE}
          totalCount={pagination.total_count || orders.length}
          selected={selectedOrder}
          onSelect={setSelectedOrder}
        />
      )}

      {tab === "webhooks" && (
        <WebhooksTab
          webhooks={webhooks}
          loading={webhooksLoading}
          newUrl={newUrl}
          setNewUrl={setNewUrl}
          selectedEventTypes={selectedEventTypes}
          setSelectedEventTypes={setSelectedEventTypes}
          createWebhook={createWebhook}
          toggleWebhook={toggleWebhook}
          deleteWebhook={deleteWebhook}
        />
      )}

      {tab === "events" && (
        <EventsTab
          events={events}
          wsEvents={wsEvents}
          loading={eventsLoading}
          refresh={fetchEvents}
          clearAll={clearAllEvents}
        />
      )}

      {tab === "settings" && (
        <SettingsTab
          apiKey={apiKey || ""}
          secretKey={secretKey || ""}
          wsConnected={wsConnected}
          connectWs={connectWs}
          disconnectWs={disconnectWs}
        />
      )}
    </main>
  );
}

// ---------- subcomponents ----------

function StatCard({ label, value, accent = "text-white" }: { label: string; value: any; accent?: string }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#331111] p-4" style={cardShadow}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-xs uppercase tracking-wider flex items-center gap-2 -mb-px ${
        active
          ? "bg-[#0a0a0a] text-white border border-[#331111] border-b-[#0a0a0a]"
          : "bg-transparent text-gray-400 hover:text-[#ff6666]"
      }`}
      style={
        active
          ? { boxShadow: "0 -4px 20px rgba(255, 0, 51, 0.2)" }
          : undefined
      }
    >
      {label}
      {badge != null && badge > 0 ? (
        <span className="bg-[#ff0033] text-white text-[9px] px-1.5 py-0.5 rounded-full leading-none">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

// ---------- orders tab ----------
function OrdersTab({
  orders,
  loading,
  page,
  setPage,
  pageSize,
  totalCount,
  selected,
  onSelect,
}: {
  orders: Order[];
  loading: boolean;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  totalCount: number;
  selected: Order | null;
  onSelect: (o: Order | null) => void;
}) {
  if (selected) return <OrderDetail order={selected} onBack={() => onSelect(null)} />;

  const hasMore = (page + 1) * pageSize < totalCount;

  return (
    <div className="bg-[#0a0a0a] border border-[#331111]" style={cardShadow}>
      {loading ? (
        <div className="p-8 text-center text-gray-500 text-sm">Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center text-gray-500 text-sm">No orders yet</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a0a0a] text-[10px] uppercase tracking-wider text-gray-500">
              <th className="text-left p-3">Order ID</th>
              <th className="text-left p-3">Mode</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Asset</th>
              <th className="text-left p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                onClick={() => onSelect(o)}
                className="border-b border-[#1a0a0a] hover:bg-[#0f0808] cursor-pointer"
              >
                <td className="p-3 font-mono text-xs text-[#ff6666]">{truncate(o.id, 16)}</td>
                <td className="p-3 text-gray-400">{o.mode}</td>
                <td className="p-3"><StatusBadge status={o.status} /></td>
                <td className="p-3">{o.fulfillment?.amount?.ui_amount_display || o.fulfillment?.amount?.ui_amount || "—"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {o.fulfillment?.asset?.image_uri ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.fulfillment.asset.image_uri} alt="" className="w-4 h-4 rounded-full" />
                    ) : null}
                    <span className="text-gray-400">{o.fulfillment?.asset?.ticker || "—"}</span>
                  </div>
                </td>
                <td className="p-3 text-gray-500 text-xs">{formatDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center justify-between p-3 border-t border-[#1a0a0a] text-xs text-gray-500">
        <div>
          Page {page + 1} • {orders.length} of {totalCount}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 uppercase tracking-wider border border-[#331111] disabled:opacity-30 hover:border-[#ff0033]"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(page + 1)}
            disabled={!hasMore}
            className="px-3 py-1.5 uppercase tracking-wider border border-[#331111] disabled:opacity-30 hover:border-[#ff0033]"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ order, onBack }: { order: Order; onBack: () => void }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-xs uppercase tracking-wider text-[#ff6666] hover:text-white"
      >
        ← Back to orders
      </button>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* LEFT */}
        <div className="space-y-4">
          <Card title="Order">
            <Field label="ID" value={<span className="font-mono text-xs">{order.id}</span>} />
            <Field label="Mode" value={order.mode} />
            <Field label="Status" value={<StatusBadge status={order.status} />} />
            <Field label="Created" value={formatDate(order.created_at)} />
            <Field label="Updated" value={formatDate(order.updated_at)} />
          </Card>

          <Card title="Fulfillment">
            <div className="flex items-center gap-3 mb-3">
              {order.fulfillment?.asset?.image_uri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={order.fulfillment.asset.image_uri} alt="" className="w-8 h-8 rounded-full" />
              ) : null}
              <div>
                <div className="text-sm">{order.fulfillment?.asset?.name || order.fulfillment?.asset?.ticker || "—"}</div>
                <div className="text-xs text-gray-500">{order.fulfillment?.asset?.chain_id}</div>
              </div>
            </div>
            <Field label="Amount" value={order.fulfillment?.amount?.ui_amount_display || order.fulfillment?.amount?.ui_amount} />
            <Field label="USD Value" value={order.fulfillment?.amount?.value_usd != null ? `$${order.fulfillment.amount.value_usd.toFixed(2)}` : "—"} />
            <Field label="Fiat" value={order.fulfillment?.fiat ? JSON.stringify(order.fulfillment.fiat) : "—"} />
            <Field label="Receiving Address" value={<span className="font-mono text-xs break-all">{order.fulfillment?.receiving_address || "—"}</span>} />
          </Card>

          <Card title="Transaction Hashes">
            <Field label="Deposit TX" value={<span className="font-mono text-xs break-all text-[#ff6666]">{order.deposit_tx_hash || "—"}</span>} />
            <Field label="Receiving TX" value={<span className="font-mono text-xs break-all text-green-400">{order.receiving_tx_hash || "—"}</span>} />
            <Field label="Refund TX" value={<span className="font-mono text-xs break-all text-amber-400">{order.refund_tx_hash || "—"}</span>} />
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <Card title="Payment Source">
            {order.payment?.src ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  {order.payment.src.image_uri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={order.payment.src.image_uri} alt="" className="w-8 h-8 rounded-full" />
                  ) : null}
                  <div>
                    <div className="text-sm">{order.payment.src.name || order.payment.src.ticker}</div>
                    <div className="text-xs text-gray-500">{order.payment.src.chain_id}</div>
                  </div>
                </div>
                <Field label="Total" value={JSON.stringify(order.payment.src.total) || "—"} />
                <Field label="Fees" value={JSON.stringify(order.payment.src.fees) || "—"} />
              </>
            ) : (
              <div className="text-xs text-gray-500">No source selected</div>
            )}
          </Card>

          <Card title="Payment Destination">
            {order.payment?.dst ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  {order.payment.dst.image_uri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={order.payment.dst.image_uri} alt="" className="w-8 h-8 rounded-full" />
                  ) : null}
                  <div>
                    <div className="text-sm">{order.payment.dst.name || order.payment.dst.ticker}</div>
                    <div className="text-xs text-gray-500">{order.payment.dst.chain_id}</div>
                  </div>
                </div>
              </>
            ) : null}
            <Field label="Deposit Address" value={<span className="font-mono text-xs break-all">{order.payment?.deposit_address || "—"}</span>} />
            <Field label="Receiving Address" value={<span className="font-mono text-xs break-all">{order.payment?.receiving_address || "—"}</span>} />
            <Field label="Expires" value={formatDate(order.payment?.expires_at)} />
          </Card>

          <Card title="Execution Steps">
            {order.payment?.execution && order.payment.execution.length > 0 ? (
              <ul className="space-y-2">
                {order.payment.execution.map((step, i) => (
                  <li key={i} className="border border-[#1a0a0a] p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400">{step.provider}</span>
                      <StatusBadge status={step.status} />
                    </div>
                    <div className="text-gray-500">
                      {step.source_currency?.ticker} → {step.destination_currency?.ticker}
                    </div>
                    {step.source_tx_hash && (
                      <div className="font-mono text-[10px] text-[#ff6666] break-all">{step.source_tx_hash}</div>
                    )}
                    {step.error && <div className="text-red-400 text-[10px]">{step.error}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-gray-500">No execution steps</div>
            )}
          </Card>

          {order.metadata?.items && order.metadata.items.length > 0 && (
            <Card title="Items">
              <ul className="space-y-2">
                {order.metadata.items.map((it, i) => (
                  <li key={i} className="flex items-center gap-3 text-xs">
                    {it.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image} alt="" className="w-8 h-8 object-cover" />
                    ) : null}
                    <div className="flex-1">
                      <div>{it.name}</div>
                      <div className="text-gray-500">
                        {it.quantity} × {JSON.stringify(it.unit_price)} {it.currency}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0a0a0a] border border-[#331111] p-4" style={cardShadow}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-3">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-gray-500 uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-right text-gray-200 min-w-0 break-all">{value || "—"}</span>
    </div>
  );
}

// ---------- webhooks tab ----------
function WebhooksTab({
  webhooks,
  loading,
  newUrl,
  setNewUrl,
  selectedEventTypes,
  setSelectedEventTypes,
  createWebhook,
  toggleWebhook,
  deleteWebhook,
}: {
  webhooks: Webhook[];
  loading: boolean;
  newUrl: string;
  setNewUrl: (s: string) => void;
  selectedEventTypes: string[];
  setSelectedEventTypes: (s: string[]) => void;
  createWebhook: () => void;
  toggleWebhook: (w: Webhook) => void;
  deleteWebhook: (w: Webhook) => void;
}) {
  const toggleEvent = (e: string) => {
    setSelectedEventTypes(
      selectedEventTypes.includes(e) ? selectedEventTypes.filter((x) => x !== e) : [...selectedEventTypes, e],
    );
  };

  return (
    <div className="space-y-6">
      {/* create form */}
      <div className="bg-[#0a0a0a] border border-[#331111] p-5" style={cardShadow}>
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-3">Create Webhook</div>
        <input
          type="text"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://your-domain.com/webhooks"
          className="w-full mb-4 font-mono text-xs"
        />
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
          Event Types (none = all)
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {ALL_EVENT_TYPES.map((e) => {
            const on = selectedEventTypes.includes(e);
            return (
              <button
                key={e}
                onClick={() => toggleEvent(e)}
                className={`px-3 py-1 text-[10px] uppercase tracking-wider border transition ${
                  on
                    ? "bg-[#ff0033] border-[#ff0033] text-white"
                    : "bg-transparent border-[#331111] text-gray-400 hover:border-[#ff0033]"
                }`}
              >
                {e}
              </button>
            );
          })}
        </div>
        <button
          onClick={createWebhook}
          disabled={!newUrl}
          className="px-5 py-2 uppercase tracking-wider text-xs text-white disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #ff0033 0%, #cc0029 100%)" }}
        >
          Create Webhook
        </button>
      </div>

      {/* list */}
      {loading ? (
        <div className="text-sm text-gray-500">Loading webhooks…</div>
      ) : webhooks.length === 0 ? (
        <div className="text-sm text-gray-500">No webhooks configured</div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((w) => (
            <div key={w.id} className="bg-[#0a0a0a] border border-[#331111] p-4" style={cardShadow}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${w.active ? "bg-green-400" : "bg-gray-600"}`} />
                    <span className="font-mono text-xs text-[#ff6666] break-all">{w.url}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">{w.id}</div>
                  {w.webhook_secret && (
                    <div className="text-[10px] text-gray-500 font-mono mt-1">
                      secret: {truncate(w.webhook_secret, 20)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleWebhook(w)}
                    className="px-3 py-1.5 text-[10px] uppercase tracking-wider border border-[#331111] hover:border-[#ff0033]"
                  >
                    {w.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => deleteWebhook(w)}
                    className="px-3 py-1.5 text-[10px] uppercase tracking-wider border border-red-500/40 text-red-400 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {w.subscription_events && w.subscription_events.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {w.subscription_events.map((e) => (
                    <span key={e} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-[#331111] text-gray-400">
                      {e}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- events tab ----------
function EventsTab({
  events,
  wsEvents,
  loading,
  refresh,
  clearAll,
}: {
  events: any[];
  wsEvents: any[];
  loading: boolean;
  refresh: () => void;
  clearAll: () => void;
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={refresh}
          className="px-3 py-1.5 text-[10px] uppercase tracking-wider border border-[#331111] hover:border-[#ff0033]"
        >
          Refresh
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-1.5 text-[10px] uppercase tracking-wider border border-red-500/40 text-red-400 hover:bg-red-500/10"
        >
          Clear All
        </button>
      </div>

      {/* WebSocket events */}
      <div className="bg-green-500/5 border border-green-500/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs uppercase tracking-wider text-green-400">Live Events (WebSocket)</span>
        </div>
        {wsEvents.length === 0 ? (
          <div className="text-xs text-gray-500">Connect WebSocket to receive live events</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {wsEvents.map((e, i) => (
              <div key={i} className="bg-[#0a0a0a] border border-[#1a3a1a] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-green-400 font-mono">{e.type || e.event || "event"}</span>
                  <span className="text-[10px] text-gray-500">{formatDate(e.received_at)}</span>
                </div>
                <pre className="text-[10px] text-gray-300 overflow-x-auto">{JSON.stringify(e, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhook events */}
      <div className="bg-[#ff0033]/5 border border-[#331111] p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-[#ff0033]" />
          <span className="text-xs uppercase tracking-wider text-[#ff6666]">Webhook Events</span>
        </div>
        {loading ? (
          <div className="text-xs text-gray-500">Loading…</div>
        ) : events.length === 0 ? (
          <div className="text-xs text-gray-500">
            No webhook events yet. Configure a webhook pointing to{" "}
            <code className="text-[#ff6666]">{origin}/api/webhooks</code>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.map((e, i) => (
              <div key={i} className="bg-[#0a0a0a] border border-[#331111] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#ff6666] font-mono">{e.type || e.event || "event"}</span>
                  <span className="text-[10px] text-gray-500">{formatDate(e.received_at)}</span>
                </div>
                <pre className="text-[10px] text-gray-300 overflow-x-auto">{JSON.stringify(e, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- settings tab ----------
function SettingsTab({
  apiKey,
  secretKey,
  wsConnected,
  connectWs,
  disconnectWs,
}: {
  apiKey: string;
  secretKey: string;
  wsConnected: boolean;
  connectWs: () => void;
  disconnectWs: () => void;
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="space-y-4 max-w-[500px]">
      <div className="bg-[#0a0a0a] border border-[#331111] p-5" style={cardShadow}>
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-3">API Configuration</div>
        <Field label="API Key" value={<span className="font-mono text-xs text-[#ff6666]">{truncate(apiKey, 20)}</span>} />
        <Field label="Secret Key" value={<span className="font-mono text-xs">{"•".repeat(20)}</span>} />
        <div className="flex items-center gap-2 mt-3">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs text-green-400 uppercase tracking-wider">Connected</span>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-[#331111] p-5" style={cardShadow}>
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-3">Webhook Receiver URL</div>
        <code className="block bg-[#0f0808] border border-[#331111] p-3 text-xs font-mono text-[#ff6666] break-all">
          {origin}/api/webhooks
        </code>
        <div className="text-[10px] text-gray-500 mt-2">
          Use ngrok or localtunnel to expose this for local development.
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-[#331111] p-5" style={cardShadow}>
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-3">WebSocket</div>
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-400" : "bg-gray-600"}`} />
          <span className="text-xs uppercase tracking-wider">{wsConnected ? "Connected" : "Disconnected"}</span>
        </div>
        <button
          onClick={wsConnected ? disconnectWs : connectWs}
          className={`w-full px-4 py-2 uppercase tracking-wider text-xs ${
            wsConnected
              ? "border border-red-500/40 text-red-400 hover:bg-red-500/10"
              : "text-white"
          }`}
          style={
            wsConnected
              ? undefined
              : { background: "linear-gradient(135deg, #ff0033 0%, #cc0029 100%)" }
          }
        >
          {wsConnected ? "Disconnect" : "Connect"}
        </button>
      </div>
    </div>
  );
}
