"use client";

// Polished wallet connect modal built on @coin-voyage/crypto/hooks primitives.
// CoinVoyage doesn't export a standalone "ConnectKit" component — this fills
// that gap by composing useInstalledWallets, useUniversalConnect,
// useAccountDisconnect, and useAccount into a single self-contained UI.

import { useEffect, useState } from "react";
import {
  useAccount,
  useAccountDisconnect,
  useInstalledWallets,
} from "@coin-voyage/crypto/hooks";
import { useUniversalConnect } from "@coin-voyage/crypto/hooks";
import { getConnectorIcon } from "@coin-voyage/crypto/utils";

const COLORS = {
  bg: "#0F212E",
  card: "#1A2C38",
  cardLight: "#213743",
  border: "#2F4553",
  borderHover: "#3D5C70",
  accent: "#00E701",
  text: "#FFFFFF",
  textMuted: "#B1BAD3",
  loss: "#ED4163",
};

export type CasinoAccount = {
  address?: string;
  chainType?: string;
  isConnected: boolean;
};

/**
 * Tiny inline button shown in nav bars / headers. Renders connect/disconnect
 * UX based on current account state. Click → opens modal.
 */
export function WalletConnectButton({
  onOpen,
  account,
}: {
  onOpen: () => void;
  account: CasinoAccount;
}) {
  if (account.isConnected && account.address) {
    return (
      <button
        onClick={onOpen}
        style={{
          background: COLORS.bg,
          color: COLORS.text,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 11,
          fontFamily: "ui-monospace,monospace",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: COLORS.accent,
          }}
        />
        {account.address.slice(0, 6)}…{account.address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      style={{
        background: COLORS.accent,
        color: "#000",
        border: "none",
        borderRadius: 6,
        padding: "8px 14px",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        cursor: "pointer",
      }}
    >
      Connect Wallet
    </button>
  );
}

/**
 * Full wallet connect modal. Self-contained — manages its own connecting
 * state, errors, and view (list vs connected). Caller controls open/close.
 */
export function WalletConnectKitModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const wallets = useInstalledWallets();
  const { connect } = useUniversalConnect();
  const disconnect = useAccountDisconnect();
  const { account } = useAccount({ chainType: undefined, selectedWallet: undefined });

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // close automatically on successful connect (one frame after the account flips)
  useEffect(() => {
    if (open && account?.isConnected && account.address && connectingId) {
      const t = setTimeout(() => {
        setConnectingId(null);
        onClose();
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, account?.isConnected, account?.address, connectingId, onClose]);

  if (!open) return null;

  const handleConnect = async (walletId: string, connector: any) => {
    setError(null);
    setConnectingId(walletId);
    try {
      await connect({ walletConnector: connector });
    } catch (e: any) {
      setError(e?.message || "Connection failed");
      setConnectingId(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect(account);
    } catch (e: any) {
      setError(e?.message || "Disconnect failed");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          maxWidth: 420,
          width: "100%",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>
              {account?.isConnected ? "Connected" : "Connect a Wallet"}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
              {account?.isConnected
                ? "Manage your wallet"
                : "Choose how you'd like to connect"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: COLORS.textMuted,
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              lineHeight: 1,
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
            }}
          >
            ×
          </button>
        </div>

        {/* BODY */}
        <div
          style={{
            padding: 16,
            overflowY: "auto",
            flex: 1,
          }}
        >
          {/* CONNECTED VIEW */}
          {account?.isConnected && account.address ? (
            <div>
              <div
                style={{
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${COLORS.accent} 0%, #008f00 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#000",
                  }}
                >
                  ✓
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontFamily: "ui-monospace,monospace",
                      color: COLORS.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {account.address}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: COLORS.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginTop: 2,
                    }}
                  >
                    {account.chainType} {account.chainId ? `· chain ${account.chainId}` : ""}
                  </div>
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                style={{
                  width: "100%",
                  background: "transparent",
                  color: COLORS.loss,
                  border: `1px solid ${COLORS.loss}`,
                  borderRadius: 8,
                  padding: "12px",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            // WALLET LIST
            <>
              {wallets.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: COLORS.textMuted,
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔌</div>
                  <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>
                    No wallets detected
                  </div>
                  <div style={{ fontSize: 12 }}>
                    Install MetaMask, Phantom, Coinbase Wallet, etc. and refresh.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {wallets.map((w: any) =>
                    w.connectors.map((c: any, i: number) => {
                      const id = `${w.id}-${i}`;
                      const connecting = connectingId === id;
                      const icon = w.icon || getConnectorIcon(c);
                      return (
                        <button
                          key={id}
                          onClick={() => handleConnect(id, c)}
                          disabled={!!connectingId}
                          style={{
                            background: connecting ? COLORS.cardLight : COLORS.bg,
                            color: COLORS.text,
                            border: `1px solid ${connecting ? COLORS.accent : COLORS.border}`,
                            borderRadius: 10,
                            padding: "12px 14px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: connectingId && !connecting ? "not-allowed" : "pointer",
                            opacity: connectingId && !connecting ? 0.5 : 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            textAlign: "left",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            if (!connectingId) {
                              (e.currentTarget as HTMLButtonElement).style.borderColor = COLORS.borderHover;
                              (e.currentTarget as HTMLButtonElement).style.background = COLORS.cardLight;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!connectingId) {
                              (e.currentTarget as HTMLButtonElement).style.borderColor = COLORS.border;
                              (e.currentTarget as HTMLButtonElement).style.background = COLORS.bg;
                            }
                          }}
                        >
                          {/* icon */}
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: COLORS.cardLight,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              flexShrink: 0,
                            }}
                          >
                            {icon ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={icon}
                                alt=""
                                style={{ width: 24, height: 24, objectFit: "contain" }}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: 14, color: COLORS.textMuted }}>
                                {w.name?.[0] || "?"}
                              </span>
                            )}
                          </div>

                          {/* name */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: COLORS.text }}>{w.name}</div>
                            <div
                              style={{
                                fontSize: 10,
                                color: COLORS.textMuted,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                marginTop: 1,
                              }}
                            >
                              {c.chainType || "wallet"}
                            </div>
                          </div>

                          {/* state */}
                          {connecting ? (
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                border: `2px solid ${COLORS.accent}`,
                                borderTopColor: "transparent",
                                borderRadius: "50%",
                                animation: "spin 0.7s linear infinite",
                              }}
                            />
                          ) : (
                            <span style={{ color: COLORS.textMuted, fontSize: 14 }}>›</span>
                          )}
                        </button>
                      );
                    }),
                  )}
                </div>
              )}

              {error && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    background: "rgba(237,65,99,0.1)",
                    border: `1px solid ${COLORS.loss}55`,
                    borderRadius: 8,
                    fontSize: 11,
                    color: COLORS.loss,
                  }}
                >
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: `1px solid ${COLORS.border}`,
            background: COLORS.bg,
            fontSize: 10,
            color: COLORS.textMuted,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Powered by <span style={{ color: COLORS.accent }}>CoinVoyage</span>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
