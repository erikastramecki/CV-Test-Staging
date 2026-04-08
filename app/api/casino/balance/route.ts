import { NextRequest, NextResponse } from "next/server";
import { ensureUser, getBalance, recentBets, listWithdrawals } from "@/lib/casino-db";

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address) return NextResponse.json({ error: "missing address" }, { status: 400 });
    ensureUser(address);
    return NextResponse.json({
      address,
      balance_cents: getBalance(address),
      bets: recentBets(address, 25),
      withdrawals: listWithdrawals(address),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
