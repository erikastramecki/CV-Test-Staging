import { PRODUCT, SHIPPING_FLAT, TAX_RATE } from "../lib/pricing.js";

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "text-white font-semibold text-base" : "text-slate-300"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function OrderSummary({ quantity, setQuantity, totals, children }) {
  return (
    <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-4 text-base font-semibold text-white">Order summary</h2>

      {/* Line item */}
      <div className="flex items-start gap-4 border-b border-slate-800 pb-5">
        <div className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800" />
        <div className="flex-1">
          <p className="font-medium text-white">{PRODUCT.name}</p>
          <p className="text-xs text-slate-400">${PRODUCT.price.toFixed(2)} each</p>

          <div className="mt-3 inline-flex items-center rounded-md border border-slate-700 bg-slate-950">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="px-3 py-1 text-slate-300 hover:text-white"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="min-w-[2ch] px-2 text-center text-sm text-white">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="px-3 py-1 text-slate-300 hover:text-white"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>
        <p className="text-sm font-medium text-white">
          ${(PRODUCT.price * quantity).toFixed(2)}
        </p>
      </div>

      {/* Totals */}
      <div className="mt-5 space-y-2">
        <Row label="Subtotal" value={`$${totals.subtotal.toFixed(2)}`} />
        <Row label="Shipping" value={`$${SHIPPING_FLAT.toFixed(2)}`} />
        <Row label={`Taxes (${(TAX_RATE * 100).toFixed(0)}%)`} value={`$${totals.taxes.toFixed(2)}`} />
        <div className="my-3 border-t border-slate-800" />
        <Row label="Total" value={`$${totals.total.toFixed(2)}`} bold />
      </div>

      <div className="mt-6">{children}</div>
    </aside>
  );
}
