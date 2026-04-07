import { useMemo, useState } from "react";
import { CheckoutForm } from "./components/CheckoutForm.jsx";
import { OrderSummary } from "./components/OrderSummary.jsx";
import { PayWithCryptoButton } from "./components/PayWithCryptoButton.jsx";
import { computeTotals, PRODUCT } from "./lib/pricing.js";
import { validateForm } from "./lib/validation.js";

const INITIAL_FORM = {
  email: "",
  name: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

export default function App() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [quantity, setQuantity] = useState(1);

  const totals = useMemo(() => computeTotals(quantity), [quantity]);

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Surface email format issues inline, but never block the payment modal.
  const validate = () => {
    setErrors(validateForm(form));
    return true;
  };

  const metadata = {
    items: [
      {
        name: PRODUCT.name,
        description: "Basic Tee",
        quantity,
        price: PRODUCT.price,
      },
    ],
    customer_email: form.email,
    ship_to: `${form.name}, ${form.address}, ${form.city}, ${form.state} ${form.postalCode}, ${form.country}`,
  };

  return (
    <main className="min-h-screen bg-black px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Checkout</h1>
          <span className="text-xs text-slate-500">
            Powered by <span className="text-pink-400">CoinVoyage</span>
          </span>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          {/* LEFT — form */}
          <CheckoutForm form={form} errors={errors} onChange={handleChange} />

          {/* RIGHT — summary + pay */}
          <OrderSummary quantity={quantity} setQuantity={setQuantity} totals={totals}>
            <PayWithCryptoButton
              amount={totals.total}
              intent={`Pay ${PRODUCT.name}`}
              validate={validate}
              metadata={metadata}
            />
            <p className="mt-3 text-center text-[11px] text-slate-500">
              You'll be redirected to the CoinVoyage modal to complete payment.
            </p>
          </OrderSummary>
        </div>
      </div>
    </main>
  );
}
