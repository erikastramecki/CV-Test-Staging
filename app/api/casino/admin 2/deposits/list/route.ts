import { NextRequest, NextResponse } from "next/server";
import { listAllDeposits, depositStats } from "@/lib/casino-db";
import { checkAdmin } from "@/lib/casino-admin-auth";

export async function POST(req: NextRequest) {
  const denied = checkAdmin(req);
  if (denied) return denied;

  try {
    return NextResponse.json({
      deposits: listAllDeposits(200),
      stats: depositStats(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
