"use client";

import type { QuoteResponse } from "@/lib/swap-api";

type Props = {
  quote: QuoteResponse | null;
  srcTicker: string;
  dstTicker: string;
};

export function RoutePreview({ quote, srcTicker, dstTicker }: Props) {
  if (!quote) return null;
  const inAmt =
    quote.input?.currency_amount?.ui_amount_display ||
    quote.input?.currency_amount?.ui_amount;
  const outAmt =
    quote.output?.currency_amount?.ui_amount_display ||
    quote.output?.currency_amount?.ui_amount;
  const usd = quote.output?.currency_amount?.value_usd;
  const impact = quote.price_impact;

  return (
    <div className="space-y-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm">
      <Row label="You pay" value={`${inAmt ?? "—"} ${quote.input?.ticker ?? srcTicker}`} />
      <Row label="You receive" value={`${outAmt ?? "—"} ${quote.output?.ticker ?? dstTicker}`} />
      {usd != null ? <Row label="USD value" value={`$${usd.toFixed(2)}`} /> : null}
      {impact != null ? (
        <Row
          label="Price impact"
          value={`${(impact * 100).toFixed(2)}%`}
          tone={Math.abs(impact) > 0.02 ? "warn" : undefined}
        />
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "warn";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span
        className={
          tone === "warn"
            ? "font-medium text-amber-400"
            : "font-medium text-neutral-100"
        }
      >
        {value}
      </span>
    </div>
  );
}
