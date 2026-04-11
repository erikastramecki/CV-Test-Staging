import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://api.coinvoyage.io/v2";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { action, apiKey, ...params } = body || {};
  if (!action) return NextResponse.json({ error: "missing action" }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: "missing apiKey" }, { status: 400 });

  try {
    if (action === "quote") {
      const { intent, metadata } = params;
      const requestBody = JSON.stringify({ intent, metadata });
      console.log("[swap/quote] request body:", requestBody);
      const res = await fetch(`${BASE_URL}/swap/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: requestBody,
      });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error("[swap/quote] upstream error", res.status);
        console.error("[swap/quote] full response:", JSON.stringify(data, null, 2));
      }
      return NextResponse.json(data, { status: res.status });
    }

    if (action === "data") {
      const { intent, receiving_address } = params;
      const requestBody = JSON.stringify({ intent, receiving_address });
      console.log("[swap/data] request body:", requestBody);
      const res = await fetch(`${BASE_URL}/swap/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: requestBody,
      });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error("[swap/data] upstream error", res.status);
        console.error("[swap/data] full response:", JSON.stringify(data, null, 2));
      }
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error("[swap] error:", err);
    return NextResponse.json({ error: err?.message || "internal error" }, { status: 500 });
  }
}
