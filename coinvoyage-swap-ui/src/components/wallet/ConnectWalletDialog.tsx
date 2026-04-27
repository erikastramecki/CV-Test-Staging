"use client";

import {
  useAccount,
  useAccountDisconnect,
  useInstalledWallets,
  useUniversalConnect,
} from "@coin-voyage/crypto/hooks";
import type { ChainType } from "@coin-voyage/shared/types";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  /** Optional chain-type filter — show only wallets that support this ecosystem. */
  chainType?: ChainType;
  onClose: () => void;
};

export function ConnectWalletDialog({ open, chainType, onClose }: Props) {
  const wallets = useInstalledWallets(chainType);
  const { accounts } = useAccount();
  const disconnect = useAccountDisconnect();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { connect } = useUniversalConnect({
    onSuccess: () => {
      setPending(null);
      onClose();
    },
    onError: (err) => {
      setPending(null);
      setError(err?.message ?? "Could not connect wallet");
    },
  });

  useEffect(() => {
    if (!open) return;
    setPending(null);
    setError(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  // Filter connected accounts by chain type when one is requested.
  const connected = accounts.filter(
    (a) => a.isConnected && (chainType ? a.chainType === chainType : true),
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              {chainType ? `${chainType} wallet` : "Wallets"}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {chainType
                ? `Manage your ${chainType} wallet for this swap.`
                : "Manage every connected wallet across CV."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {connected.length > 0 && (
            <section className="mb-1">
              <h3 className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-widest text-neutral-500">
                Connected
              </h3>
              {connected.map((acct) => (
                <div
                  key={`${acct.chainType}-${acct.address}`}
                  className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/15 text-[10px] font-semibold text-emerald-200">
                      {acct.chainType ?? "?"}
                    </span>
                    <div className="leading-tight">
                      <div className="font-mono text-xs text-neutral-100">
                        {short(acct.address)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                        Active
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await disconnect(acct);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Disconnect failed");
                      }
                    }}
                    className="rounded-md border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:border-rose-500/50 hover:text-rose-300"
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </section>
          )}

          <section>
            <h3 className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-widest text-neutral-500">
              {connected.length > 0 ? "Connect another" : "Available wallets"}
            </h3>
            {wallets.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-neutral-400">
                <p>No installed wallets detected.</p>
                <p className="mt-1.5 text-xs text-neutral-500">
                  Install MetaMask, Phantom, Coinbase Wallet, or another supported
                  wallet and refresh.
                </p>
              </div>
            ) : (
              wallets.map((w) => (
                <button
                  key={w.id}
                  disabled={pending !== null}
                  onClick={async () => {
                    setError(null);
                    setPending(w.id);
                    try {
                      const connector = w.connectors[0];
                      if (!connector) {
                        throw new Error("Wallet has no available connector");
                      }
                      await connect({ walletConnector: connector });
                    } catch (e) {
                      setPending(null);
                      setError(e instanceof Error ? e.message : "Connect failed");
                    }
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm text-neutral-100 transition-colors hover:bg-neutral-900 disabled:cursor-wait disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    {w.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={w.icon}
                        alt=""
                        className="h-9 w-9 rounded-lg bg-neutral-900 object-contain"
                      />
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-neutral-800 text-[11px] font-semibold">
                        {w.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="leading-tight">
                      <div className="font-medium">{w.name}</div>
                      <div className="text-[11px] text-neutral-500">
                        {w.connectors.length} chain{w.connectors.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  {pending === w.id ? (
                    <span className="text-xs text-rose-300">Connecting…</span>
                  ) : (
                    <span className="text-neutral-500">›</span>
                  )}
                </button>
              ))
            )}
          </section>

          {error && (
            <div className="mx-2 mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function short(addr: string | undefined) {
  if (!addr) return "—";
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
