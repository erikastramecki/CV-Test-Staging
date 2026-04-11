"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PayButton, usePayStatus } from "@coin-voyage/paykit";
import { ChainId } from "@coin-voyage/paykit/server";
import { useApiKeys, useWalletReady } from "../providers";

const PRODUCT = { name: "Basic Tee", price: 4.0 };
const SHIPPING_FLAT = 1.0;
const TAX_RATE = 0.05;

const RECEIVING_ADDRESS = "0x24298ff17f46dF37CF4036393e37418C21648552";
const SETTLEMENT_CHAIN = ChainId.BASE;
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function computeTotals(qty: number) {
  const subtotal = PRODUCT.price * qty;
  const shipping = SHIPPING_FLAT;
  const taxes = (subtotal + shipping) * TAX_RATE;
  const total = subtotal + shipping + taxes;
  return { subtotal, shipping, taxes, total };
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const INITIAL_FORM = {
  email: "",
  name: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

export default function CheckoutPage() {
  const { apiKey } = useApiKeys();
  const walletReady = useWalletReady();

  if (!apiKey) {
    return (
      <main className="min-h-screen flex items-center justify-center p-10">
        <div
          className="bg-[#0a0a0a] border border-[#331111] p-8 max-w-md text-center"
          style={{
            boxShadow:
              "0 0 30px rgba(255, 0, 51, 0.15), inset 0 0 1px rgba(255, 51, 51, 0.3)",
          }}
        >
          <h1 className="text-xl mb-2">Not Authenticated</h1>
          <p className="text-sm text-gray-400 mb-6">
            Set your CoinVoyage API key first.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 uppercase tracking-wider text-xs text-white"
            style={{ background: "linear-gradient(135deg, #ff0033 0%, #cc0029 100%)" }}
          >
            Go to Authenticate
          </Link>
        </div>
      </main>
    );
  }

  if (!walletReady) {
    return (
      <main className="min-h-screen flex items-center justify-center p-10 text-sm text-gray-500">
        Initializing wallet…
      </main>
    );
  }

  return <CheckoutInner />;
}

function CheckoutInner() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [payError, setPayError] = useState<string | null>(null);
  const pendingShowRef = useRef<(() => void) | null>(null);

  const totals = useMemo(() => computeTotals(quantity), [quantity]);
  const totalAmount = useMemo(() => Number(totals.total.toFixed(2)), [totals.total]);

  // Readiness of the pre-created payOrder. PayButton.Custom's `show()` is a
  // silent no-op until this is defined, so we use it to gate the click.
  const payStatus = usePayStatus();
  const isPayReady = payStatus !== undefined;

  // If the user clicked Pay before the preload finished, fire it now.
  useEffect(() => {
    if (isPayReady && pendingShowRef.current) {
      const queued = pendingShowRef.current;
      pendingShowRef.current = null;
      queued();
    }
  }, [isPayReady]);

  const handleChange = (name: keyof typeof INITIAL_FORM, value: string) => {
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) {
      setErrors((p) => {
        const n = { ...p };
        delete n[name];
        return n;
      });
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (form.email && !validateEmail(form.email)) errs.email = "Invalid email";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Keep this stable — any change to `metadata` refires the preload query and
  // opens a race window where `order` is briefly null. Form fields are NOT
  // included in the preload metadata for that reason; they're fine to record
  // server-side after payment completes.
  const metadata = useMemo(
    () => ({
      items: [
        {
          name: PRODUCT.name,
          description: "Basic Tee",
          quantity,
          unit_price: PRODUCT.price,
          currency: "USD",
        },
      ],
    }),
    [quantity],
  );

  return (
    <main className="min-h-screen bg-black px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Checkout</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="px-3 py-2 uppercase tracking-wider text-xs border border-[#331111] hover:border-[#ff0033] hover:text-[#ff6666]"
            >
              Dashboard
            </Link>
            <span className="text-xs text-slate-500">
              Powered by <span className="text-[#ff6666]">CoinVoyage</span>
            </span>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          {/* form */}
          <section
            className="bg-[#0a0a0a] border border-[#331111] p-6"
            style={{
              boxShadow:
                "0 0 30px rgba(255, 0, 51, 0.15), inset 0 0 1px rgba(255, 51, 51, 0.3)",
            }}
          >
            <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4">Contact</h2>
            <Input label="Email" value={form.email} onChange={(v) => handleChange("email", v)} error={errors.email} />

            <h2 className="text-sm uppercase tracking-wider text-gray-500 mt-6 mb-4">Shipping</h2>
            <Input label="Full Name" value={form.name} onChange={(v) => handleChange("name", v)} />
            <Input label="Address" value={form.address} onChange={(v) => handleChange("address", v)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="City" value={form.city} onChange={(v) => handleChange("city", v)} />
              <Input label="State" value={form.state} onChange={(v) => handleChange("state", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Postal Code" value={form.postalCode} onChange={(v) => handleChange("postalCode", v)} />
              <Input label="Country" value={form.country} onChange={(v) => handleChange("country", v)} />
            </div>
          </section>

          {/* summary */}
          <section
            className="bg-[#0a0a0a] border border-[#331111] p-6 h-fit"
            style={{
              boxShadow:
                "0 0 30px rgba(255, 0, 51, 0.15), inset 0 0 1px rgba(255, 51, 51, 0.3)",
            }}
          >
            <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-4">Order Summary</h2>

            <div className="flex items-center justify-between py-3 border-b border-[#1a0a0a]">
              <div>
                <div className="text-sm">{PRODUCT.name}</div>
                <div className="text-xs text-gray-500">${PRODUCT.price.toFixed(2)} each</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-2 py-1 border border-[#331111] hover:border-[#ff0033] text-sm"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-2 py-1 border border-[#331111] hover:border-[#ff0033] text-sm"
                >
                  +
                </button>
              </div>
            </div>

            <Row label="Subtotal" value={totals.subtotal} />
            <Row label="Shipping" value={totals.shipping} />
            <Row label="Taxes (5%)" value={totals.taxes} />
            <div className="border-t border-[#1a0a0a] mt-2 pt-3">
              <Row label="Total" value={totals.total} bold />
            </div>

            <div className="mt-6">
              <PayButton.Custom
                intent={`Pay ${PRODUCT.name}`}
                toChain={SETTLEMENT_CHAIN}
                toAddress={RECEIVING_ADDRESS}
                toAmount={totalAmount}
                toToken={USDC_BASE}
                metadata={metadata}
                onPaymentCreationError={(e: any) => {
                  console.error("[Paykit]", e);
                  setPayError(e?.errorMessage ?? "Could not create payment. Check your API key and try again.");
                }}
                onPaymentStarted={() => {
                  setPayError(null);
                  console.log("[Paykit] started");
                }}
                onPaymentCompleted={() => console.log("[Paykit] completed")}
                onPaymentBounced={() => console.log("[Paykit] bounced")}
              >
                {({ show }: { show: () => void }) => (
                  <button
                    type="button"
                    onClick={() => {
                      if (!validate()) return;
                      setPayError(null);
                      if (isPayReady) {
                        show();
                      } else {
                        pendingShowRef.current = show;
                      }
                    }}
                    disabled={!isPayReady && pendingShowRef.current != null}
                    className="w-full py-3 uppercase tracking-wider text-xs text-white disabled:opacity-60 disabled:cursor-wait"
                    style={{
                      background: "linear-gradient(135deg, #ff0033 0%, #cc0029 100%)",
                    }}
                  >
                    {isPayReady
                      ? `Pay With Crypto · $${totals.total.toFixed(2)}`
                      : pendingShowRef.current
                        ? "Preparing payment…"
                        : `Pay With Crypto · $${totals.total.toFixed(2)}`}
                  </button>
                )}
              </PayButton.Custom>
              {payError && (
                <p className="mt-3 text-center text-[11px] text-[#ff6666]">{payError}</p>
              )}
              <p className="mt-3 text-center text-[10px] text-gray-500">
                You&apos;ll be redirected to the CoinVoyage modal to complete payment.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="mb-3">
      <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-sm" />
      {error && <p className="text-[10px] text-[#ff6666] mt-1">{error}</p>}
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 text-sm ${bold ? "font-semibold" : "text-gray-400"}`}>
      <span>{label}</span>
      <span>${value.toFixed(2)}</span>
    </div>
  );
}
