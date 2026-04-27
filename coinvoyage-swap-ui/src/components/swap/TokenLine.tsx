"use client";

import { CHAIN_BY_ID, type Token } from "@/lib/chains";

type Props = {
  label: string;
  chainId: number;
  token: Token | undefined;
  amount: string;
  amountReadOnly?: boolean;
  amountUsd?: string;
  walletAction?: { label: string; onClick: () => void };
  onAmountChange?: (next: string) => void;
  onPickAsset: () => void;
  showCurrencyFlip?: boolean;
  onCurrencyFlip?: () => void;
};

export function TokenLine({
  label,
  chainId,
  token,
  amount,
  amountReadOnly,
  amountUsd,
  walletAction,
  onAmountChange,
  onPickAsset,
  showCurrencyFlip,
  onCurrencyFlip,
}: Props) {
  const chain = CHAIN_BY_ID[chainId];

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-neutral-400">{label}</span>
        {walletAction ? (
          <button
            onClick={walletAction.onClick}
            className="text-sm font-medium text-rose-400 hover:text-rose-300"
          >
            {walletAction.label}
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <input
          inputMode="decimal"
          placeholder="0"
          value={amount}
          readOnly={amountReadOnly}
          onChange={(e) => onAmountChange?.(sanitize(e.target.value))}
          className="min-w-0 flex-1 bg-transparent text-4xl font-semibold tracking-tight text-neutral-50 outline-none placeholder:text-neutral-700"
        />
        <button
          onClick={onPickAsset}
          className="flex shrink-0 items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-left hover:border-neutral-700"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-neutral-800 text-[11px] font-semibold">
            {token?.ticker.slice(0, 4) ?? "?"}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-neutral-50">
              {token?.ticker ?? "Select"}
            </span>
            <span className="text-[11px] text-neutral-500">{chain?.name ?? "—"}</span>
          </span>
          <span className="ml-1 text-neutral-500">›</span>
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-sm text-neutral-500">
        <span>{amountUsd ?? "$0.00"}</span>
        {showCurrencyFlip ? (
          <button
            onClick={onCurrencyFlip}
            aria-label="Flip amount currency"
            className="grid h-5 w-5 place-items-center rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            ⇅
          </button>
        ) : null}
      </div>
    </div>
  );
}

function sanitize(v: string) {
  const cleaned = v.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return parts[0] + "." + parts.slice(1).join("");
}
