// Single source of truth for the casino's hot wallet — the address that
// receives all deposits AND will be the source of all withdrawal payouts.
//
// IMPORTANT: This wallet must hold enough USDC on Base to cover every queued
// withdrawal at any given time. The admin dashboard surfaces "Hot Wallet Owes"
// for exactly this reason.

export const CASINO_HOT_WALLET = {
  address: "0x24298ff17f46dF37CF4036393e37418C21648552",
  chainId: 8453, // Base mainnet
  chainName: "Base",
  tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  tokenSymbol: "USDC",
} as const;

// Compare two addresses ignoring case and whitespace.
export function addressesEqual(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
