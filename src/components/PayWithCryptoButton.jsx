import { useState } from "react";
import { PayButton } from "@coin-voyage/paykit";
import { ChainId } from "@coin-voyage/paykit/server";

// Settle on BASE in USDC to the merchant wallet.
const RECEIVING_ADDRESS = "0x24298ff17f46dF37CF4036393e37418C21648552";
const SETTLEMENT_CHAIN = ChainId.BASE;
// USDC on Base mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export function PayWithCryptoButton({ amount, intent, validate, metadata }) {
  const [creationError, setCreationError] = useState(null);

  return (
    <>
      <PayButton.Custom
        intent={intent}
        toChain={SETTLEMENT_CHAIN}
        toAddress={RECEIVING_ADDRESS}
        toAmount={Number(amount.toFixed(2))}
        toToken={USDC_BASE}
        metadata={metadata}
        onPaymentCreationError={(e) => {
          console.error("[Paykit] payment creation error", e);
          setCreationError(e?.errorMessage || "Failed to create pay order");
        }}
        onPaymentStarted={() => console.log("[Paykit] payment started")}
        onPaymentCompleted={() => console.log("[Paykit] payment completed")}
        onPaymentBounced={() => console.log("[Paykit] payment bounced")}
      >
        {({ show }) => (
          <button
            type="button"
            onClick={() => {
              console.log("[Paykit] Pay button clicked, calling show()");
              validate();
              show();
            }}
            className="w-full rounded-lg bg-pink-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-900/40 transition hover:bg-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Pay With Crypto · ${amount.toFixed(2)}
          </button>
        )}
      </PayButton.Custom>
      {creationError && (
        <p className="mt-3 text-center text-xs text-pink-400">
          Couldn't create pay order: {creationError}
        </p>
      )}
    </>
  );
}
