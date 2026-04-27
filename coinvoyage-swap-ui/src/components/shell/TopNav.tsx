"use client";

import { ChainType } from "@coin-voyage/shared/types";
import { useAccount } from "@coin-voyage/crypto/hooks";
import { useState } from "react";

import { ConnectWalletDialog } from "@/components/wallet/ConnectWalletDialog";

const NAV_ITEMS = [
  { label: "Swap", href: "#" },
  { label: "Vaults", href: "#", disabled: true },
  { label: "Activity", href: "#", disabled: true },
];

export function TopNav() {
  const [search, setSearch] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  // Show whichever wallet the user has connected first (any chain type).
  const { account, accounts } = useAccount();
  const connectedCount = accounts.filter((a) => a.isConnected).length;

  return (
    <header className="sticky top-0 z-30 flex items-center gap-6 border-b border-neutral-900 bg-neutral-950/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 text-sm font-black text-white">
          CV
        </span>
        <span className="text-sm font-semibold tracking-tight">CoinVoyage</span>
      </div>

      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href={item.disabled ? undefined : item.href}
            aria-disabled={item.disabled}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              item.disabled
                ? "cursor-not-allowed text-neutral-600"
                : "text-neutral-200 hover:bg-neutral-900"
            }`}
            title={item.disabled ? "Coming soon" : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div className="ml-auto flex max-w-md flex-1 items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-2">
        <span className="text-neutral-500">⌕</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search anything"
          className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-500"
        />
        <kbd className="hidden rounded border border-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500 sm:block">
          /
        </kbd>
      </div>

      {account?.isConnected && account.address ? (
        <button
          onClick={() => setConnectOpen(true)}
          className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:border-neutral-700"
          title="Manage wallets"
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/20 text-[9px] text-emerald-300">
            ●
          </span>
          {short(account.address)}
          {connectedCount > 1 ? (
            <span className="rounded-full bg-neutral-800 px-1.5 text-[10px] text-neutral-300">
              +{connectedCount - 1}
            </span>
          ) : null}
          <span className="text-neutral-500">▾</span>
        </button>
      ) : (
        <button
          onClick={() => setConnectOpen(true)}
          className="rounded-full bg-gradient-to-br from-rose-500 to-rose-700 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-md shadow-rose-900/30 hover:opacity-95"
        >
          Connect
        </button>
      )}

      <ConnectWalletDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
    </header>
  );
}

function chainTypeLabel(t: ChainType | undefined) {
  if (!t) return "wallet";
  return t.toLowerCase();
}

function short(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
