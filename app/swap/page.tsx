"use client";

import dynamic from "next/dynamic";

// Wallet hooks need browser context (WagmiProvider, window, etc).
// Force-disable SSR so we never try to render the swap UI on the server.
const SwapContent = dynamic(() => import("./swap-content"), { ssr: false });

export default function SwapPage() {
  return <SwapContent />;
}
