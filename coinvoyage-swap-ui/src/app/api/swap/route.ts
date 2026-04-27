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

function getApiKey() {
  // Server-side only — never expose to the browser bundle.
  return process.env.CV_API_KEY ?? "";
}

export async function POST(req: NextRequest) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing CV_API_KEY in env" },
      { status: 500 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const action = body.action as string | undefined;
  if (!action) {
    return NextResponse.json({ error: "missing action" }, { status: 400 });
  }

  try {
    if (action === "quote") {
      const intent = body.intent;
      const metadata = body.metadata;
      const res = await fetch(`${BASE_URL}/swap/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({ intent, metadata }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error("[swap/quote]", res.status, JSON.stringify(data));
      }
      return NextResponse.json(data, { status: res.status });
    }

    if (action === "data") {
      const intent = body.intent;
      const receiving_address = body.receiving_address;
      const res = await fetch(`${BASE_URL}/swap/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({ intent, receiving_address }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        console.error("[swap/data]", res.status, JSON.stringify(data));
      }
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "internal error";
    console.error("[swap]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
