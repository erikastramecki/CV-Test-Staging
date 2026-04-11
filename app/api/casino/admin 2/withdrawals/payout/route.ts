import { NextRequest, NextResponse } from "next/server";
import { checkAdmin } from "@/lib/casino-admin-auth";
import { isHotWalletConfigured, processPayout } from "@/lib/casino-payout";

export async function POST(req: NextRequest) {
  const denied = checkAdmin(req);
  if (denied) return denied;

  if (!isHotWalletConfigured()) {
    return NextResponse.json(
      {
        error:
          "Hot wallet not configured: set CASINO_HOT_WALLET_PRIVATE_KEY in .env (0x-prefixed 32-byte hex). Restart dev server after setting.",
      },
      { status: 503 },
    );
  }

  try {
    const { id, destAddress, destChainId, destTokenAddress } = await req.json();
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "id must be an integer" }, { status: 400 });
    }
    if (!destAddress || typeof destAddress !== "string") {
      return NextResponse.json({ error: "destAddress required" }, { status: 400 });
    }
    if (!Number.isInteger(destChainId)) {
      return NextResponse.json({ error: "destChainId must be an integer" }, { status: 400 });
    }

    const result = await processPayout({
      withdrawalId: id,
      destAddress,
      destChainId,
      destTokenAddress: destTokenAddress || undefined,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[payout] error:", e);
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
