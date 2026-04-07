import { useState } from "react";
import { PayKitProvider, WalletProvider } from "@coin-voyage/paykit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const API_KEY = import.meta.env.VITE_COIN_VOYAGE_API_KEY;

export function Providers({ children }) {
  const [queryClient] = useState(() => new QueryClient());

  if (!API_KEY) {
    throw new Error("VITE_COIN_VOYAGE_API_KEY is required");
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <PayKitProvider apiKey={API_KEY} mode="dark">
          {children}
        </PayKitProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}
