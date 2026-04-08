import { NextRequest, NextResponse } from "next/server";

// In-memory rendezvous for WebRTC SDP exchange. Two clients with the same
// code agree on offer/answer, then talk peer-to-peer and never hit us again.
// State lives on globalThis so Next.js HMR doesn't wipe it between reloads.
type Session = {
  offer?: string;
  answer?: string;
  request?: string; // optional payment request payload, JSON string
  createdAt: number;
};

const TTL_MS = 5 * 60 * 1000;

const store: Map<string, Session> =
  (globalThis as unknown as { __p2pStore?: Map<string, Session> }).__p2pStore ??
  new Map<string, Session>();
(globalThis as unknown as { __p2pStore?: Map<string, Session> }).__p2pStore = store;

function gc() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now - v.createdAt > TTL_MS) store.delete(k);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  gc();
  const { code } = await params;
  const role = req.nextUrl.searchParams.get("role"); // "offer" | "answer" | null
  const session = store.get(code);
  if (!session) {
    return NextResponse.json({ exists: false }, { status: 404 });
  }
  if (role === "offer") {
    return NextResponse.json({ sdp: session.offer ?? null });
  }
  if (role === "answer") {
    return NextResponse.json({ sdp: session.answer ?? null });
  }
  return NextResponse.json({
    exists: true,
    hasOffer: !!session.offer,
    hasAnswer: !!session.answer,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  gc();
  const { code } = await params;
  const body = (await req.json()) as { role?: string; sdp?: string };
  if (!body.role || !body.sdp) {
    return NextResponse.json({ error: "missing role or sdp" }, { status: 400 });
  }
  let session = store.get(code);
  if (!session) {
    session = { createdAt: Date.now() };
    store.set(code, session);
  }
  if (body.role === "offer") session.offer = body.sdp;
  else if (body.role === "answer") session.answer = body.sdp;
  else return NextResponse.json({ error: "bad role" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  store.delete(code);
  return NextResponse.json({ ok: true });
}
