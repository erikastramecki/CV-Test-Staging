import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://api.coinvoyage.io/v2";

function getApiKey() {
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
  if (action !== "status") {
    return NextResponse.json({ error: `unsupported action: ${action}` }, { status: 400 });
  }

  const payorder_id = body.payorder_id as string | undefined;
  if (!payorder_id) {
    return NextResponse.json({ error: "missing payorder_id" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE_URL}/pay-orders/${payorder_id}`, {
      method: "GET",
      headers: { "X-API-KEY": apiKey },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
