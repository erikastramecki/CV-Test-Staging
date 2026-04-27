/**
 * Typed client for the CoinVoyage swap proxy.
 *
 * Talks to /api/swap and /api/sale on this app, which forward to
 * https://api.coinvoyage.io/v2/swap/{quote,data} and
 * https://api.coinvoyage.io/v2/pay-orders/:id with the X-API-KEY header.
 *
 * The API key lives only in server env (CV_API_KEY) and is never sent
 * from the browser.
 */

export type SwapMode = "ExactIn" | "ExactOut";

export type CurrencyRef = {
  chain_id: number;
  /** Omit for the chain's native asset. */
  address?: string;
};

export type SwapIntent = {
  /** Decimal string in the source token's display units (e.g. "1.25"). */
  amount: string;
  destination_currency: CurrencyRef;
  payment_rail: "CRYPTO";
  swap_mode: SwapMode;
  crypto: {
    sender_address: string;
    /** Slippage in basis points (50 = 0.5%). */
    slippage_bps: number;
    source_currency: CurrencyRef;
  };
};

export type CurrencyAmount = {
  ui_amount?: string;
  ui_amount_display?: string;
  value_usd?: number;
};

export type QuoteSide = {
  ticker?: string;
  currency_amount?: CurrencyAmount;
  fees?: unknown;
  gas?: unknown;
};

export type QuoteResponse = {
  input?: QuoteSide;
  output?: QuoteSide;
  price_impact?: number;
  [key: string]: unknown;
};

export type SwapDataResponse = {
  payorder_id?: string;
  status?: string;
  data?: {
    steps?: unknown[];
    deposit_address?: string;
    src?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type CallOpts = {
  signal?: AbortSignal;
};

async function postSwap<T>(body: Record<string, unknown>, opts?: CallOpts): Promise<T> {
  const res = await fetch(`/api/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts?.signal,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = data as { error?: string; message?: string } | undefined;
    const msg = err?.error || err?.message || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, payload: data });
  }
  return data as T;
}

export function fetchQuote(
  intent: SwapIntent,
  opts?: CallOpts & { metadata?: Record<string, unknown> },
): Promise<QuoteResponse> {
  return postSwap<QuoteResponse>(
    { action: "quote", intent, metadata: opts?.metadata },
    opts,
  );
}

export function fetchSwapData(
  intent: SwapIntent,
  receiving_address: string,
  opts?: CallOpts,
): Promise<SwapDataResponse> {
  return postSwap<SwapDataResponse>(
    { action: "data", intent, receiving_address },
    opts,
  );
}

export type OrderStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED"
  | (string & {});

export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
]);

export async function fetchOrderStatus(
  payorder_id: string,
  opts?: CallOpts,
): Promise<{ status?: OrderStatus; [key: string]: unknown }> {
  const res = await fetch(`/api/sale`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "status", payorder_id }),
    signal: opts?.signal,
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: OrderStatus;
    [key: string]: unknown;
  };
  if (!res.ok) {
    throw Object.assign(
      new Error((data as { error?: string })?.error || `HTTP ${res.status}`),
      { status: res.status },
    );
  }
  return data;
}
