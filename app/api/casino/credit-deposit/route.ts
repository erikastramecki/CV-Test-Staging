import { NextRequest, NextResponse } from "next/server";
import { recordDeposit } from "@/lib/casino-db";

// Frontend-triggered credit. Called from Paykit's onPaymentCompleted callback
// so the user sees their balance instantly without waiting for the webhook
// roundtrip. The webhook handler ALSO credits, but the UNIQUE constraint on
// deposits.payment_id makes it idempotent.
//
// SECURITY NOTE: this endpoint trusts the client. For a production casino,
// gate this behind a signed receipt from the Paykit modal or rely solely on
// the webhook. Acceptable for the demo.
export async function POST(req: NextRequest) {
  try {
    const { address, amountCents, paymentId } = await req.json();
    if (!address) return NextResponse.json({ error: "missing address" }, { status: 400 });
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: "amountCents must be a positive integer" }, { status: 400 });
    }

    const result = recordDeposit({
      paymentId: paymentId || null,
      address,
      amountCents,
      status: "credited",
      source: "client_callback",
    });

    return NextResponse.json({
      credited: result.credited,
      balance_cents: result.balance,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
