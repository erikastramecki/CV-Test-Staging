"use client";

import { PayKitProvider, WalletProvider } from "@coin-voyage/paykit";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

const PAYKIT_ENV =
  (process.env.NEXT_PUBLIC_COIN_VOYAGE_ENVIRONMENT as
    | "local"
    | "development"
    | "production"
    | undefined) ?? "production";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  // PayKit's wallet adapters touch localStorage at module init, which throws
  // during SSR. Gate the provider tree on a post-mount flag so adapters only
  // run on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center text-xs text-neutral-500">
        Loading wallet…
      </div>
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_CV_API_KEY ?? "";

  // PayKit's default Solana wallet list is only Coinbase + WalletConnect.
  // Phantom is supposed to be auto-discovered via the wallet-standard, but
  // browser detection can be flaky — pass the adapters explicitly so they
  // always show up in the connect picker.
  return <ProvidersInner queryClient={queryClient} apiKey={apiKey}>{children}</ProvidersInner>;
}

function ProvidersInner({
  children,
  queryClient,
  apiKey,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
  apiKey: string;
}) {
  const solanaWallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider
        config={{
          solana: {
            walletConfiguration: { wallets: solanaWallets },
          },
        }}
      >
        <PayKitProvider apiKey={apiKey} environment={PAYKIT_ENV} mode="dark">
          {children}
        </PayKitProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}
