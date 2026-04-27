import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { cookieStorage, createStorage } from "wagmi";
import {
  arbitrum,
  avalanche,
  base,
  blast,
  bsc,
  mainnet,
  optimism,
  polygon,
  zksync,
} from "wagmi/chains";

// RainbowKit's getDefaultConfig throws synchronously when projectId is empty,
// which would break dev for anyone who hasn't filled in .env.local yet.
// We fall back to a non-empty placeholder so the page renders; injected
// wallets (MetaMask etc.) still work — only WalletConnect-only flows require
// a real project ID from https://cloud.walletconnect.com.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "PLACEHOLDER_REPLACE_WITH_WALLETCONNECT_PROJECT_ID";

export const wagmiConfig = getDefaultConfig({
  appName: "CoinVoyage Swap",
  projectId,
  chains: [mainnet, optimism, bsc, polygon, zksync, base, arbitrum, avalanche, blast],
  ssr: true,
  // Cookie-backed storage survives SSR — wagmi's default localStorage doesn't
  // exist on the server and crashes hydration in App Router.
  storage: createStorage({ storage: cookieStorage }),
});
