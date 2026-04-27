/**
 * Chain catalog mirrored from parent CV Test Staging swap-content.
 *
 * CoinVoyage uses synthetic high-numbered chain IDs for non-EVM chains so the
 * intent shape stays uniform. We mirror them here verbatim — the API expects
 * these exact numbers.
 */

export const ChainType = {
  EVM: "EVM",
  SOL: "SOL",
  UTXO: "UTXO",
  SUI: "SUI",
  TRON: "TRON",
} as const;
export type ChainType = (typeof ChainType)[keyof typeof ChainType];

export type ChainMeta = {
  id: number;
  name: string;
  short: string;
  type: ChainType;
};

export const CHAINS: ChainMeta[] = [
  { id: 1, name: "Ethereum", short: "ETH", type: ChainType.EVM },
  { id: 10, name: "Optimism", short: "OP", type: ChainType.EVM },
  { id: 56, name: "BNB Smart Chain", short: "BSC", type: ChainType.EVM },
  { id: 137, name: "Polygon", short: "POL", type: ChainType.EVM },
  { id: 324, name: "zkSync Era", short: "ZK", type: ChainType.EVM },
  { id: 8453, name: "Base", short: "BASE", type: ChainType.EVM },
  { id: 42161, name: "Arbitrum One", short: "ARB", type: ChainType.EVM },
  { id: 43114, name: "Avalanche", short: "AVAX", type: ChainType.EVM },
  { id: 81457, name: "Blast", short: "BLAST", type: ChainType.EVM },
  { id: 30000000000001, name: "Solana", short: "SOL", type: ChainType.SOL },
  { id: 30000000000002, name: "Sui", short: "SUI", type: ChainType.SUI },
  { id: 30000000000003, name: "Tron", short: "TRX", type: ChainType.TRON },
  { id: 20000000000001, name: "Bitcoin", short: "BTC", type: ChainType.UTXO },
];

export const CHAIN_BY_ID: Record<number, ChainMeta> = Object.fromEntries(
  CHAINS.map((c) => [c.id, c]),
);

export type Token = {
  ticker: string;
  name: string;
  /** Omit for the chain's native asset. */
  address?: string;
  decimals: number;
};

export const TOKENS: Record<number, Token[]> = {
  1: [
    { ticker: "ETH", name: "Ether", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  ],
  10: [
    { ticker: "ETH", name: "Ether", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
  ],
  56: [
    { ticker: "BNB", name: "BNB", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
    { ticker: "USDT", name: "Tether", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
  ],
  137: [
    { ticker: "POL", name: "Polygon", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
  ],
  324: [
    { ticker: "ETH", name: "Ether", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4", decimals: 6 },
  ],
  8453: [
    { ticker: "ETH", name: "Ether", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
  ],
  42161: [
    { ticker: "ETH", name: "Ether", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
  ],
  43114: [
    { ticker: "AVAX", name: "Avalanche", decimals: 18 },
    { ticker: "USDC", name: "USD Coin", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
  ],
  81457: [{ ticker: "ETH", name: "Ether", decimals: 18 }],
  30000000000001: [
    { ticker: "SOL", name: "Solana", decimals: 9 },
    { ticker: "USDC", name: "USD Coin", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
    { ticker: "USDT", name: "Tether", address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  ],
  30000000000002: [{ ticker: "SUI", name: "Sui", decimals: 9 }],
  20000000000001: [{ ticker: "BTC", name: "Bitcoin", decimals: 8 }],
  30000000000003: [{ ticker: "TRX", name: "Tron", decimals: 6 }],
};

export function validateAddressFormat(
  address: string,
  chainType: ChainType | undefined,
): string | null {
  if (!address) return "Address is empty";
  if (!chainType) return null;
  if (chainType === ChainType.EVM) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return "Destination chain is EVM — address must be 0x… (42 chars)";
    }
  } else if (chainType === ChainType.SOL) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      return "Destination chain is Solana — address must be base58 (32–44 chars)";
    }
  } else if (chainType === ChainType.UTXO) {
    if (address.length < 26 || address.length > 90) {
      return "Destination chain is Bitcoin — address looks malformed";
    }
  } else if (chainType === ChainType.SUI) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(address)) {
      return "Destination chain is Sui — address must be 0x… (66 chars)";
    }
  }
  return null;
}
