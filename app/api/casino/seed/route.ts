import { NextRequest, NextResponse } from "next/server";
import { createSeed, ensureUser, getActiveSeed, revealSeed } from "@/lib/casino-db";
import { defaultClientSeed, generateServerSeed } from "@/lib/casino-engine";

// Actions:
//   "get"     → returns the active seed (creates one if none exists)
//   "rotate"  → reveals the current server seed and creates a new one
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, action, clientSeed } = body || {};
    if (!address) return NextResponse.json({ error: "missing address" }, { status: 400 });
    ensureUser(address);

    if (action === "get") {
      let seed = getActiveSeed(address);
      if (!seed) {
        const { seed: serverSeed, hash } = generateServerSeed();
        seed = createSeed(address, serverSeed, hash, clientSeed || defaultClientSeed());
      }
      return NextResponse.json({
        seed_id: seed.id,
        server_seed_hash: seed.server_seed_hash,
        client_seed: seed.client_seed,
        nonce: seed.nonce,
      });
    }

    if (action === "rotate") {
      const old = getActiveSeed(address);
      const revealed = old ? revealSeed(old.id) : undefined;
      const { seed: serverSeed, hash } = generateServerSeed();
      const next = createSeed(address, serverSeed, hash, clientSeed || defaultClientSeed());
      return NextResponse.json({
        revealed: revealed
          ? {
              seed_id: revealed.id,
              server_seed: revealed.server_seed,
              server_seed_hash: revealed.server_seed_hash,
              client_seed: revealed.client_seed,
              final_nonce: revealed.nonce,
            }
          : null,
        new_seed: {
          seed_id: next.id,
          server_seed_hash: next.server_seed_hash,
          client_seed: next.client_seed,
          nonce: next.nonce,
        },
      });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
