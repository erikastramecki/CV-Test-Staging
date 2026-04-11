import { NextRequest, NextResponse } from "next/server";
import { approveWithdrawal } from "@/lib/casino-db";
import { checkAdmin } from "@/lib/casino-admin-auth";

export async function POST(req: NextRequest) {
  const denied = checkAdmin(req);
  if (denied) return denied;

  try {
    const { id, txHash } = await req.json();
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "id must be an integer" }, { status: 400 });
    }
    const result = approveWithdrawal(id, txHash || undefined);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result.row);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
