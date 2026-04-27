"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CHAINS,
  CHAIN_BY_ID,
  TOKENS,
  type ChainMeta,
  type Token,
} from "@/lib/chains";

const STARRED_CHAIN_IDS = [42161, 8453, 1, 30000000000001];

type Props = {
  open: boolean;
  initialChainId: number;
  onClose: () => void;
  onPick: (chainId: number, tokenIdx: number) => void;
};

export function TokenPickerDialog({ open, initialChainId, onClose, onPick }: Props) {
  const [chainId, setChainId] = useState<number>(initialChainId);
  const [allChainsView, setAllChainsView] = useState(false);
  const [chainQuery, setChainQuery] = useState("");
  const [tokenQuery, setTokenQuery] = useState("");

  useEffect(() => {
    if (open) {
      setChainId(initialChainId);
      setAllChainsView(false);
      setChainQuery("");
      setTokenQuery("");
    }
  }, [open, initialChainId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filteredChains = useMemo(() => {
    const q = chainQuery.trim().toLowerCase();
    if (!q) return CHAINS;
    return CHAINS.filter(
      (c) => c.name.toLowerCase().includes(q) || c.short.toLowerCase().includes(q),
    );
  }, [chainQuery]);

  const starred = filteredChains.filter((c) => STARRED_CHAIN_IDS.includes(c.id));
  const az = useMemo(
    () => [...filteredChains].sort((a, b) => a.name.localeCompare(b.name)),
    [filteredChains],
  );

  const tokensForView = useMemo(() => {
    if (allChainsView) {
      // flatten all chains into one list with chain context
      return CHAINS.flatMap((c) =>
        (TOKENS[c.id] ?? []).map((t, idx) => ({ chain: c, token: t, idx })),
      );
    }
    return (TOKENS[chainId] ?? []).map((t, idx) => ({
      chain: CHAIN_BY_ID[chainId]!,
      token: t,
      idx,
    }));
  }, [allChainsView, chainId]);

  const filteredTokens = useMemo(() => {
    const q = tokenQuery.trim().toLowerCase();
    if (!q) return tokensForView;
    return tokensForView.filter(
      ({ token }) =>
        token.ticker.toLowerCase().includes(q) ||
        token.name.toLowerCase().includes(q) ||
        (token.address?.toLowerCase().includes(q) ?? false),
    );
  }, [tokenQuery, tokensForView]);

  const headerLabel = allChainsView
    ? "All chains"
    : CHAIN_BY_ID[chainId]?.name ?? "Tokens";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight">Select asset</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-[220px_1fr] divide-x divide-neutral-800">
          {/* Left column — chain picker */}
          <div className="flex max-h-[60vh] flex-col">
            <div className="p-3">
              <SearchInput
                value={chainQuery}
                onChange={setChainQuery}
                placeholder="Search chains"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-1.5 pb-3">
              <ChainListItem
                label="All Chains"
                accent
                selected={allChainsView}
                onClick={() => setAllChainsView(true)}
              />

              {starred.length > 0 && !chainQuery && (
                <Section label="Starred Chains" />
              )}
              {!chainQuery &&
                starred.map((c) => (
                  <ChainListItem
                    key={`starred-${c.id}`}
                    label={c.name}
                    chain={c}
                    selected={!allChainsView && c.id === chainId}
                    onClick={() => {
                      setAllChainsView(false);
                      setChainId(c.id);
                    }}
                  />
                ))}

              <Section label={chainQuery ? "Results" : "Chains A–Z"} />
              {az
                .filter((c) => chainQuery || !STARRED_CHAIN_IDS.includes(c.id))
                .map((c) => (
                  <ChainListItem
                    key={c.id}
                    label={c.name}
                    chain={c}
                    selected={!allChainsView && c.id === chainId}
                    onClick={() => {
                      setAllChainsView(false);
                      setChainId(c.id);
                    }}
                  />
                ))}
              {az.length === 0 && (
                <p className="px-3 py-4 text-xs text-neutral-500">No chains match.</p>
              )}
            </div>
          </div>

          {/* Right column — token list */}
          <div className="flex max-h-[60vh] flex-col">
            <div className="p-3">
              <SearchInput
                value={tokenQuery}
                onChange={setTokenQuery}
                placeholder="Search a token or paste address"
              />
            </div>
            <div className="px-4 pb-2 text-[11px] uppercase tracking-wider text-neutral-500">
              {headerLabel}
            </div>
            <div className="flex-1 overflow-y-auto pb-2">
              {filteredTokens.length === 0 ? (
                <p className="px-4 py-6 text-sm text-neutral-500">
                  No tokens match — CV catalog covers core assets only for now.
                </p>
              ) : (
                filteredTokens.map(({ chain, token, idx }) => (
                  <TokenRow
                    key={`${chain.id}-${token.ticker}-${token.address ?? "native"}`}
                    chain={chain}
                    token={token}
                    onClick={() => {
                      onPick(chain.id, idx);
                      onClose();
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2">
      <span className="text-neutral-500">⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-500"
      />
    </div>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div className="px-3 pb-1 pt-3 text-[10px] uppercase tracking-widest text-neutral-500">
      {label}
    </div>
  );
}

function ChainListItem({
  label,
  chain,
  selected,
  accent,
  onClick,
}: {
  label: string;
  chain?: ChainMeta;
  selected: boolean;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        selected
          ? "bg-rose-500/10 text-rose-100 ring-1 ring-rose-500/40"
          : "text-neutral-300 hover:bg-neutral-900"
      }`}
    >
      <span
        className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold ${
          accent ? "bg-rose-500/20 text-rose-200" : "bg-neutral-800 text-neutral-200"
        }`}
      >
        {accent ? "✦" : chain?.short.slice(0, 3) ?? "?"}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function TokenRow({
  chain,
  token,
  onClick,
}: {
  chain: ChainMeta;
  token: Token;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-neutral-200 transition-colors hover:bg-neutral-900"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-neutral-800 text-[11px] font-semibold">
          {token.ticker.slice(0, 4)}
        </span>
        <div>
          <div className="font-semibold text-neutral-50">{token.ticker}</div>
          <div className="text-xs text-neutral-500">
            {chain.name} {token.address ? short(token.address) : "Native"}
          </div>
        </div>
      </div>
    </button>
  );
}

function short(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
