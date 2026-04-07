import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const BASE_URL = "https://api.coinvoyage.io/v2";

function buildAuthSignatureHeader(apiKey: string, secretKey: string, body: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${timestamp}.${body}`;
  const signature = crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
  return `APIKey=${apiKey},signature=${signature},timestamp=${timestamp}`;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { action, apiKey, secretKey, ...params } = body || {};
  if (!action) return NextResponse.json({ error: "missing action" }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: "missing apiKey" }, { status: 400 });

  try {
    if (action === "create") {
      if (!secretKey) return NextResponse.json({ error: "missing secretKey" }, { status: 400 });
      const requestBody = JSON.stringify({
        mode: params.mode || "SALE",
        intent: params.intent,
        metadata: params.metadata,
      });
      const auth = buildAuthSignatureHeader(apiKey, secretKey, requestBody);
      const res = await fetch(`${BASE_URL}/pay-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization-Signature": auth,
        },
        body: requestBody,
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    if (action === "quote") {
      const { payorder_id, wallet_address, chain_type, chain_ids } = params;
      if (!payorder_id) return NextResponse.json({ error: "missing payorder_id" }, { status: 400 });
      const res = await fetch(`${BASE_URL}/pay-orders/${payorder_id}/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({ wallet_address, chain_type, chain_ids }),
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    if (action === "payment-details") {
      const { payorder_id, source_currency, refund_address, quote_id } = params;
      if (!payorder_id) return NextResponse.json({ error: "missing payorder_id" }, { status: 400 });
      const res = await fetch(`${BASE_URL}/pay-orders/${payorder_id}/payment-details`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({ source_currency, refund_address, quote_id }),
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    if (action === "status") {
      const { payorder_id } = params;
      if (!payorder_id) return NextResponse.json({ error: "missing payorder_id" }, { status: 400 });
      const res = await fetch(`${BASE_URL}/pay-orders/${payorder_id}`, {
        method: "GET",
        headers: { "X-API-KEY": apiKey },
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    if (action === "list") {
      const limit = params.limit ?? 20;
      const offset = params.offset ?? 0;
      const res = await fetch(`${BASE_URL}/pay-orders?limit=${limit}&offset=${offset}`, {
        method: "GET",
        headers: { "X-API-KEY": apiKey },
      });
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error("[/api/sale] error:", err);
    return NextResponse.json({ error: err?.message || "internal error" }, { status: 500 });
  }
}
