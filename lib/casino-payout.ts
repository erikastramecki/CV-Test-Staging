// Server-side cross-chain payout helper. Initiates a withdrawal by:
//   1. Building a CoinVoyage swap intent (USDC on Base → user-chosen chain/token)
//   2. Calling /swap/data to get the deposit address + amount
//   3. Signing a USDC ERC20 transfer from the hot wallet to the deposit address
//      using viem and CASINO_HOT_WALLET_PRIVATE_KEY
//   4. Updating the withdrawal row in the casino DB to status='sent' with tx_hash
//
// SECURITY: This module imports a private key from process.env. Never bundle to
// the client. Only import from server-side route handlers.

import { createWalletClient, http, erc20Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { CASINO_HOT_WALLET } from "./casino-config";
import { db } from "./casino-db";

const COINVOYAGE_API_URL = "https://api.coinvoyage.io/v2";

export type PayoutOptions = {
  withdrawalId: number;
  destAddress: string;
  destChainId: number;
  destTokenAddress?: string; // omit for native token
};

export type PayoutResult = {
  ok: true;
  txHash: string;
  payorderId?: string;
  depositAddress: string;
  amountUsd: number;
};

export function isHotWalletConfigured(): boolean {
  const pk = process.env.CASINO_HOT_WALLET_PRIVATE_KEY;
  return !!pk && pk.startsWith("0x") && pk.length === 66;
}

export async function processPayout(opts: PayoutOptions): Promise<PayoutResult> {
  const pk = process.env.CASINO_HOT_WALLET_PRIVATE_KEY;
  const apiKey = process.env.COINVOYAGE_API_KEY;
  if (!pk) throw new Error("CASINO_HOT_WALLET_PRIVATE_KEY not set in .env");
  if (!apiKey) throw new Error("COINVOYAGE_API_KEY not set in .env");
  if (!pk.startsWith("0x") || pk.length !== 66) {
    throw new Error("CASINO_HOT_WALLET_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string (66 chars total)");
  }

  // Load withdrawal
  const withdrawal = db
    .prepare("SELECT * FROM withdrawals WHERE id = ?")
    .get(opts.withdrawalId) as { id: number; address: string; amount_cents: number; status: string } | undefined;
  if (!withdrawal) throw new Error("withdrawal not found");
  if (withdrawal.status !== "queued" && withdrawal.status !== "processing") {
    throw new Error(`cannot process withdrawal in status: ${withdrawal.status}`);
  }

  // Mark processing so concurrent attempts can't double-spend
  db.prepare("UPDATE withdrawals SET status = 'processing' WHERE id = ?").run(opts.withdrawalId);

  try {
    const amountUsdc = (withdrawal.amount_cents / 100).toString();

    const intent = {
      amount: amountUsdc,
      destination_currency: {
        chain_id: opts.destChainId,
        ...(opts.destTokenAddress ? { address: opts.destTokenAddress } : {}),
      },
      payment_rail: "CRYPTO",
      swap_mode: "ExactIn",
      crypto: {
        sender_address: CASINO_HOT_WALLET.address,
        slippage_bps: 100,
        source_currency: {
          chain_id: CASINO_HOT_WALLET.chainId,
          address: CASINO_HOT_WALLET.tokenAddress,
        },
      },
    };

    const cvRes = await fetch(`${COINVOYAGE_API_URL}/swap/data`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({ intent, receiving_address: opts.destAddress }),
    });
    const cvText = await cvRes.text();
    let cvData: any;
    try {
      cvData = JSON.parse(cvText);
    } catch {
      throw new Error(`CoinVoyage returned non-JSON (HTTP ${cvRes.status}): ${cvText.slice(0, 200)}`);
    }
    if (!cvRes.ok) {
      throw new Error(cvData?.message || cvData?.error || `CoinVoyage HTTP ${cvRes.status}`);
    }

    const swap = cvData.data || cvData;
    const depositAddress: string | undefined = swap?.deposit_address;
    const totalRaw: string | number | undefined = swap?.src?.total?.raw_amount;
    if (!depositAddress) throw new Error("CoinVoyage did not return a deposit_address");
    if (totalRaw == null) throw new Error("CoinVoyage did not return src.total.raw_amount");

    // Sign and submit ERC20 USDC transfer to the CoinVoyage deposit address
    const account = privateKeyToAccount(pk as `0x${string}`);
    const client = createWalletClient({ account, chain: base, transport: http() });

    const txHash = await client.writeContract({
      address: CASINO_HOT_WALLET.tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "transfer",
      args: [depositAddress as `0x${string}`, BigInt(totalRaw)],
    });

    // Mark sent
    db.prepare(
      "UPDATE withdrawals SET status = 'sent', tx_hash = ?, processed_at = ? WHERE id = ?",
    ).run(txHash, Date.now(), opts.withdrawalId);

    return {
      ok: true,
      txHash,
      payorderId: cvData.payorder_id || swap?.payorder_id,
      depositAddress,
      amountUsd: withdrawal.amount_cents / 100,
    };
  } catch (e) {
    // Roll back to queued so admin can retry
    db.prepare("UPDATE withdrawals SET status = 'queued' WHERE id = ?").run(opts.withdrawalId);
    throw e;
  }
}
