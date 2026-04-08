import { NextRequest, NextResponse } from "next/server";
import { listAllWithdrawals, withdrawalStats } from "@/lib/casino-db";
import { checkAdmin } from "@/lib/casino-admin-auth";
import { isHotWalletConfigured } from "@/lib/casino-payout";

export async function POST(req: NextRequest) {
  const denied = checkAdmin(req);
  if (denied) return denied;

  try {
    const { status } = await req.json().catch(() => ({ status: undefined }));
    return NextResponse.json({
      withdrawals: listAllWithdrawals(status, 200),
      stats: withdrawalStats(),
      hot_wallet_configured: isHotWalletConfigured(),
      hot_wallet_address: isHotWalletConfigured() ? undefined : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
