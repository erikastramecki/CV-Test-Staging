"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PayKitProvider, WalletProvider } from "@coin-voyage/paykit";

// ---------- ApiKey context ----------
type ApiKeys = { apiKey: string | null; secretKey: string | null };
const ApiKeyContext = createContext<ApiKeys>({ apiKey: null, secretKey: null });

export function useApiKeys() {
  return useContext(ApiKeyContext);
}

function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const [keys, setKeys] = useState<ApiKeys>({ apiKey: null, secretKey: null });

  useEffect(() => {
    const read = () => {
      setKeys({
        apiKey: localStorage.getItem("cv_api_key"),
        secretKey: localStorage.getItem("cv_secret_key"),
      });
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  return <ApiKeyContext.Provider value={keys}>{children}</ApiKeyContext.Provider>;
}

// ---------- WalletReady context ----------
// WalletProvider needs browser context. We mount it after a 100ms delay so SSR
// boundaries flush cleanly. Components that use wallet hooks should gate on
// useWalletReady() returning true.
const WalletReadyContext = createContext(false);

export function useWalletReady() {
  return useContext(WalletReadyContext);
}

function DelayedWalletProvider({
  apiKey,
  children,
}: {
  apiKey: string | null;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (!mounted) {
    return <WalletReadyContext.Provider value={false}>{children}</WalletReadyContext.Provider>;
  }

  // PayKitProvider requires an apiKey at construction. If keys aren't set yet,
  // skip the wallet/paykit chain entirely so the rest of the app still renders.
  if (!apiKey) {
    return <WalletReadyContext.Provider value={false}>{children}</WalletReadyContext.Provider>;
  }

  return (
    <WalletProvider>
      <PayKitProvider apiKey={apiKey} mode="dark">
        <WalletReadyContext.Provider value={true}>{children}</WalletReadyContext.Provider>
      </PayKitProvider>
    </WalletProvider>
  );
}

// ---------- root Providers ----------
function ProvidersInner({ children }: { children: React.ReactNode }) {
  const { apiKey } = useApiKeys();
  return <DelayedWalletProvider apiKey={apiKey}>{children}</DelayedWalletProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ApiKeyProvider>
        <ProvidersInner>{children}</ProvidersInner>
      </ApiKeyProvider>
    </QueryClientProvider>
  );
}
