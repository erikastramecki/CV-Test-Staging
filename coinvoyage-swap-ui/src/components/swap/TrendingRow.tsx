"use client";

import { CHAIN_BY_ID, type ChainMeta, type Token } from "@/lib/chains";

type Trending = { chainId: number; tokenIdx: number; flame?: boolean };

const TRENDING: Trending[] = [
  { chainId: 8453, tokenIdx: 0, flame: true },
  { chainId: 1, tokenIdx: 1 },
  { chainId: 42161, tokenIdx: 0 },
  { chainId: 137, tokenIdx: 1 },
  { chainId: 30000000000001, tokenIdx: 0 },
];

import { TOKENS } from "@/lib/chains";

type Props = {
  onPick: (chainId: number, tokenIdx: number) => void;
};

export function TrendingRow({ onPick }: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-neutral-300">
        <span className="text-rose-400">▲</span>
        Trending
      </span>
      {TRENDING.map(({ chainId, tokenIdx, flame }) => {
        const chain = CHAIN_BY_ID[chainId];
        const token = TOKENS[chainId]?.[tokenIdx];
        if (!chain || !token) return null;
        return (
          <TrendingPill
            key={`${chainId}-${tokenIdx}`}
            chain={chain}
            token={token}
            flame={flame}
            onClick={() => onPick(chainId, tokenIdx)}
          />
        );
      })}
    </div>
  );
}

function TrendingPill({
  chain,
  token,
  flame,
  onClick,
}: {
  chain: ChainMeta;
  token: Token;
  flame?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/60 px-3 py-1.5 text-xs font-semibold text-neutral-100 hover:border-neutral-700"
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-neutral-800 text-[9px] font-semibold">
        {token.ticker.slice(0, 3)}
      </span>
      <span>{token.ticker}</span>
      {flame ? <span className="text-rose-400">▴</span> : null}
    </button>
  );
}
