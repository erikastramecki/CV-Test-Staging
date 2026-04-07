import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const BASE_URL = "https://api.coinvoyage.io/v2";
const MAX_EVENTS = 500;

// Module-level in-memory event store. Persists across requests, resets on server restart.
const webhookEvents: any[] = [];

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

  // Branch 1: management requests from frontend (have `action` field)
  if (body && body.action) {
    const { action, apiKey, secretKey, ...params } = body;

    if (action === "get-events") {
      return NextResponse.json({ events: webhookEvents });
    }
    if (action === "clear-events") {
      webhookEvents.length = 0;
      return NextResponse.json({ ok: true });
    }

    if (!apiKey || !secretKey) {
      return NextResponse.json({ error: "missing credentials" }, { status: 400 });
    }

    try {
      if (action === "list") {
        const auth = buildAuthSignatureHeader(apiKey, secretKey, "");
        const res = await fetch(`${BASE_URL}/webhooks`, {
          method: "GET",
          headers: { "Authorization-Signature": auth },
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
      }

      if (action === "create") {
        const requestBody = JSON.stringify({
          url: params.url,
          subscription_events: params.subscription_events,
        });
        const auth = buildAuthSignatureHeader(apiKey, secretKey, requestBody);
        const res = await fetch(`${BASE_URL}/webhooks`, {
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

      if (action === "update") {
        const { webhook_id, ...rest } = params;
        if (!webhook_id) return NextResponse.json({ error: "missing webhook_id" }, { status: 400 });
        const requestBody = JSON.stringify(rest);
        const auth = buildAuthSignatureHeader(apiKey, secretKey, requestBody);
        const res = await fetch(`${BASE_URL}/webhooks/${webhook_id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization-Signature": auth,
          },
          body: requestBody,
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
      }

      if (action === "delete") {
        const { webhook_id } = params;
        if (!webhook_id) return NextResponse.json({ error: "missing webhook_id" }, { status: 400 });
        const auth = buildAuthSignatureHeader(apiKey, secretKey, "");
        const res = await fetch(`${BASE_URL}/webhooks/${webhook_id}`, {
          method: "DELETE",
          headers: { "Authorization-Signature": auth },
        });
        if (res.status === 204) return NextResponse.json({ ok: true });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
      }

      if (action === "fee-balance") {
        const auth = buildAuthSignatureHeader(apiKey, secretKey, "");
        const res = await fetch(`${BASE_URL}/fees/balance`, {
          method: "GET",
          headers: { "Authorization-Signature": auth },
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
      }

      return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      console.error("[/api/webhooks] management error:", err);
      return NextResponse.json({ error: err?.message || "internal error" }, { status: 500 });
    }
  }

  // Branch 2: incoming webhook event from CoinVoyage
  const event = { ...body, received_at: new Date().toISOString() };
  webhookEvents.unshift(event);
  if (webhookEvents.length > MAX_EVENTS) webhookEvents.length = MAX_EVENTS;
  console.log("[webhook] received:", event.type || event.event || "unknown", event);
  return NextResponse.json({ received: true });
}
