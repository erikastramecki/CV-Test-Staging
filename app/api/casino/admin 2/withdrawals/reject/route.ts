import { NextRequest, NextResponse } from "next/server";
import { rejectWithdrawal } from "@/lib/casino-db";
import { checkAdmin } from "@/lib/casino-admin-auth";

export async function POST(req: NextRequest) {
  const denied = checkAdmin(req);
  if (denied) return denied;

  try {
    const { id } = await req.json();
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "id must be an integer" }, { status: 400 });
    }
    const result = rejectWithdrawal(id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ...result.row, refunded_cents: result.refunded_cents });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
