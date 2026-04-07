# CoinVoyage Paykit — Vite + React Checkout

A two-column dark-themed checkout page wired to
[`@coin-voyage/paykit`](https://docs.coinvoyage.io/).

- **Left:** Contact + Shipping form
- **Right:** Order summary (Basic Tee $4.00, qty selector, $1 shipping, 5% tax, total)
- **Pink "Pay With Crypto" button** that opens the CoinVoyage payment modal.

Settles in **USDC on Base** by default.

## Setup

```sh
npm install
cp .env.example .env
npm run seed     # populate sample transactions (one-time)
npm run dev      # starts vite (5173) + express webhook server (3001)
```

Open <http://localhost:5173>.

- `/`             — Dashboard (stats, revenue chart, live activity)
- `/transactions` — Transaction list with search, filters, pagination
- `/transactions/:id` — Detail view (timeline, explorer link, raw events)
- `/settings`     — Webhook URL to paste into CoinVoyage
- `/checkout`     — Original Paykit checkout demo

### Test the webhook end-to-end

```sh
curl -X POST http://localhost:3001/webhooks/coinvoyage \
  -H "Content-Type: application/json" \
  -d '{"type":"payment.completed","data":{"id":"pay_demo_1","amount":42.50,"currency":"USD","crypto_amount":0.0125,"crypto_currency":"ETH","network":"ethereum","tx_hash":"0xabc","customer_email":"demo@test.com","customer_name":"Demo"}}'
```

The dashboard updates instantly via Socket.io and a toast appears.
HMAC signature verification is enabled when `COINVOYAGE_WEBHOOK_SECRET`
is set to a real value (not the `whsec_replace_me` placeholder).

The Paykit public API key lives in `.env.local`:

```
VITE_COIN_VOYAGE_API_KEY=pk_live_...
```

## Configure your receiving wallet

Open `src/components/PayWithCryptoButton.jsx` and edit:

```js
const RECEIVING_ADDRESS = "0xYourBaseAddress";
const SETTLEMENT_CHAIN = ChainId.BASE;
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
```

Use the chain + token + address you want funds settled to.

## File map

```
.
├── index.html
├── package.json
├── vite.config.js                    # node polyfills for Buffer/process/global
├── tailwind.config.js
├── postcss.config.js
├── .env.local                        # contains VITE_COIN_VOYAGE_API_KEY
└── src/
    ├── main.jsx                      # React entry, mounts <Providers>
    ├── App.jsx                       # form + summary state, layout
    ├── Providers.jsx                 # QueryClient + Wallet + PayKit providers
    ├── index.css                     # tailwind base + dark body
    ├── lib/
    │   ├── pricing.js                # PRODUCT, SHIPPING_FLAT, TAX_RATE, computeTotals
    │   └── validation.js             # soft email format check (non-blocking)
    └── components/
        ├── CheckoutForm.jsx          # contact + shipping fields
        ├── OrderSummary.jsx          # line item, qty, subtotal/shipping/tax/total
        └── PayWithCryptoButton.jsx   # pink button → PayButton.Custom → modal
```

## How the payment flow works

1. User clicks **Pay With Crypto**.
2. `PayButton.Custom` calls `show()`, which opens the CoinVoyage modal with
   the current cart total, settlement chain (Base), and token (USDC).
3. The customer pays from any chain/token CoinVoyage supports; the SDK
   handles routing so the merchant receives USDC on Base.
4. Lifecycle callbacks (`onPaymentStarted`, `onPaymentCompleted`,
   `onPaymentBounced`, `onPaymentCreationError`) log to the console — wire
   them to your own success page / order persistence.
