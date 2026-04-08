// Provably-fair RNG and coinflip resolution.
//
// Algorithm (Stake-style HMAC):
//   hmac = HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}`)
//   take the first 8 hex chars → uint32 → divide by 2^32 → uniform [0, 1)
//
// Player can verify by re-running this with the revealed serverSeed,
// their clientSeed, and the nonce that was attached to their bet.

import crypto from "node:crypto";

export const HOUSE_EDGE = 0.01; // 1%
export const COINFLIP_PAYOUT_MULTIPLIER = 2 * (1 - HOUSE_EDGE); // 1.98×

export function generateServerSeed(): { seed: string; hash: string } {
  const seed = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  return { seed, hash };
}

export function defaultClientSeed(): string {
  return crypto.randomBytes(8).toString("hex");
}

// Returns a uniform [0, 1) double using HMAC-SHA256(serverSeed, clientSeed:nonce).
export function provablyFairFloat(serverSeed: string, clientSeed: string, nonce: number): number {
  const hmac = crypto.createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}`).digest("hex");
  // first 8 hex chars = 32 bits
  const intVal = parseInt(hmac.slice(0, 8), 16);
  return intVal / 0x100000000;
}

export type CoinflipChoice = "heads" | "tails";

export type CoinflipResult = {
  outcome: CoinflipChoice;
  choice: CoinflipChoice;
  win: boolean;
  multiplier: number; // applied to the bet on win
  rawFloat: number; // for debugging / verification
};

export function resolveCoinflip(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  choice: CoinflipChoice,
): CoinflipResult {
  const f = provablyFairFloat(serverSeed, clientSeed, nonce);
  const outcome: CoinflipChoice = f < 0.5 ? "heads" : "tails";
  const win = outcome === choice;
  return {
    outcome,
    choice,
    win,
    multiplier: COINFLIP_PAYOUT_MULTIPLIER,
    rawFloat: f,
  };
}
