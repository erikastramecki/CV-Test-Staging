import { NextRequest, NextResponse } from "next/server";
import {
  adjustBalance,
  bumpSeedNonce,
  createSeed,
  ensureUser,
  getActiveSeed,
  getBalance,
  recordBet,
} from "@/lib/casino-db";
import {
  COINFLIP_PAYOUT_MULTIPLIER,
  defaultClientSeed,
  generateServerSeed,
  resolveCoinflip,
  type CoinflipChoice,
} from "@/lib/casino-engine";

export async function POST(req: NextRequest) {
  try {
    const { address, amountCents, choice } = (await req.json()) as {
      address: string;
      amountCents: number;
      choice: CoinflipChoice;
    };

    if (!address) return NextResponse.json({ error: "missing address" }, { status: 400 });
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: "amountCents must be a positive integer" }, { status: 400 });
    }
    if (choice !== "heads" && choice !== "tails") {
      return NextResponse.json({ error: "choice must be heads or tails" }, { status: 400 });
    }

    ensureUser(address);

    if (getBalance(address) < amountCents) {
      return NextResponse.json({ error: "insufficient balance" }, { status: 400 });
    }

    // get or create the active seed
    let seed = getActiveSeed(address);
    if (!seed) {
      const { seed: serverSeed, hash } = generateServerSeed();
      seed = createSeed(address, serverSeed, hash, defaultClientSeed());
    }

    // bump nonce BEFORE rolling so this bet has its own deterministic nonce
    const nonce = bumpSeedNonce(seed.id);

    // resolve
    const result = resolveCoinflip(seed.server_seed, seed.client_seed, nonce, choice);
    const payoutCents = result.win ? Math.floor(amountCents * COINFLIP_PAYOUT_MULTIPLIER) : 0;
    const netCents = payoutCents - amountCents;

    // ledger update
    const newBalance = adjustBalance(address, netCents);

    const betId = recordBet({
      address,
      game: "coinflip",
      betCents: amountCents,
      payload: { choice },
      result: { outcome: result.outcome, win: result.win, multiplier: result.multiplier },
      payoutCents,
      seedId: seed.id,
      nonce,
      serverSeedHash: seed.server_seed_hash,
      clientSeed: seed.client_seed,
    });

    return NextResponse.json({
      bet_id: betId,
      outcome: result.outcome,
      choice,
      win: result.win,
      bet_cents: amountCents,
      payout_cents: payoutCents,
      net_cents: netCents,
      multiplier: result.multiplier,
      balance_cents: newBalance,
      provably_fair: {
        server_seed_hash: seed.server_seed_hash,
        client_seed: seed.client_seed,
        nonce,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
