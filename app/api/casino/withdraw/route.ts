import { NextRequest, NextResponse } from "next/server";
import { ensureUser, getBalance, queueWithdrawal } from "@/lib/casino-db";

// Withdrawals are queued, not auto-paid. A future job (or you, manually) drains
// the queue by signing USDC transfers from the casino hot wallet.
export async function POST(req: NextRequest) {
  try {
    const { address, amountCents } = (await req.json()) as {
      address: string;
      amountCents: number;
    };
    if (!address) return NextResponse.json({ error: "missing address" }, { status: 400 });
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: "amountCents must be a positive integer" }, { status: 400 });
    }

    ensureUser(address);
    if (getBalance(address) < amountCents) {
      return NextResponse.json({ error: "insufficient balance" }, { status: 400 });
    }

    const { id, balance } = queueWithdrawal(address, amountCents);
    return NextResponse.json({ withdrawal_id: id, status: "queued", balance_cents: balance });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
