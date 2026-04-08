"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PayButton } from "@coin-voyage/paykit";
import { ChainId } from "@coin-voyage/paykit/server";
import { useApiKeys, useWalletReady } from "../../providers";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

type Status =
  | "idle"
  | "connecting"
  | "request"
  | "paying"
  | "paid"
  | "error";

type PaymentRequest = {
  type: "payment-request";
  chainId: number;
  toAddress: string;
  toToken: string;
  toAmount: number;
  memo?: string;
};

async function waitForIceComplete(pc: RTCPeerConnection, timeoutMs = 5000) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
  });
}

export default function SendPage() {
  return (
    <Suspense fallback={<Shell>Loading…</Shell>}>
      <SendInner />
    </Suspense>
  );
}

type PrefillPayload = {
  request: PaymentRequest;
  apiKey?: string;
  secretKey?: string;
};

function decodePrefill(value: string): PrefillPayload | null {
  try {
    // base64url → base64, then decode
    const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
    const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? atob(b64)
        : Buffer.from(b64, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed.toAddress === "string" &&
      typeof parsed.toToken === "string" &&
      typeof parsed.toAmount === "number" &&
      typeof parsed.chainId === "number"
    ) {
      const request: PaymentRequest = {
        type: "payment-request",
        chainId: parsed.chainId,
        toAddress: parsed.toAddress,
        toToken: parsed.toToken,
        toAmount: parsed.toAmount,
        memo: typeof parsed.memo === "string" ? parsed.memo : undefined,
      };
      return {
        request,
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : undefined,
        secretKey:
          typeof parsed.secretKey === "string" ? parsed.secretKey : undefined,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

const PREFILL_RELOAD_FLAG = "cv_prefill_reloaded";

function SendInner() {
  const params = useSearchParams();
  const initialCode = (params.get("code") || "").toUpperCase();
  const prefillParam = params.get("prefill");
  const { apiKey } = useApiKeys();
  const walletReady = useWalletReady();

  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [request, setRequest] = useState<PaymentRequest | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  const cleanup = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();
    dcRef.current = null;
    pcRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // Native (MultipeerConnectivity / AWDL) hand-off path: the iOS app does
  // the peer discovery + payload exchange, then opens this page in
  // SFSafariViewController with the request encoded as base64url. The
  // payload may also bundle CoinVoyage credentials so a fresh device can
  // pay without going through the auth screen first. If credentials arrive
  // and don't match what's in localStorage, we persist them and reload
  // once so the ApiKeyProvider/PayKitProvider chain picks them up cleanly.
  useEffect(() => {
    if (!prefillParam) return;
    const decoded = decodePrefill(prefillParam);
    if (!decoded) {
      setErrMsg("Invalid prefill payload");
      return;
    }

    if (decoded.apiKey || decoded.secretKey) {
      const alreadyReloaded =
        sessionStorage.getItem(PREFILL_RELOAD_FLAG) === "1";
      let needsReload = false;
      if (
        decoded.apiKey &&
        localStorage.getItem("cv_api_key") !== decoded.apiKey
      ) {
        localStorage.setItem("cv_api_key", decoded.apiKey);
        needsReload = true;
      }
      if (
        decoded.secretKey &&
        localStorage.getItem("cv_secret_key") !== decoded.secretKey
      ) {
        localStorage.setItem("cv_secret_key", decoded.secretKey);
        needsReload = true;
      }
      if (needsReload && !alreadyReloaded) {
        sessionStorage.setItem(PREFILL_RELOAD_FLAG, "1");
        window.location.reload();
        return;
      }
      sessionStorage.removeItem(PREFILL_RELOAD_FLAG);
    }

    setRequest(decoded.request);
    setStatus("request");
  }, [prefillParam]);

  const connect = useCallback(async () => {
    setErrMsg(null);
    if (!code || code.length < 4) {
      setErrMsg("Enter the 6-character code");
      return;
    }
    setStatus("connecting");

    try {
      const offerRes = await fetch(`/api/p2p/${code}?role=offer`);
      if (!offerRes.ok) throw new Error("Code not found or expired");
      const offerData = (await offerRes.json()) as { sdp?: string | null };
      if (!offerData.sdp) throw new Error("No offer for that code yet");

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      pc.ondatachannel = (ev) => {
        const dc = ev.channel;
        dcRef.current = dc;
        dc.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "payment-request") {
              setRequest(msg as PaymentRequest);
              setStatus("request");
            }
          } catch {
            // ignore
          }
        };
        dc.onerror = () => setErrMsg("Data channel error");
      };

      await pc.setRemoteDescription({ type: "offer", sdp: offerData.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceComplete(pc);

      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error("Failed to gather local SDP");

      const postRes = await fetch(`/api/p2p/${code}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "answer", sdp }),
      });
      if (!postRes.ok) throw new Error("Signaling POST failed");
    } catch (err) {
      console.error(err);
      setErrMsg(err instanceof Error ? err.message : "Connect failed");
      setStatus("error");
      cleanup();
    }
  }, [code, cleanup]);

  const reportPaid = useCallback(() => {
    try {
      dcRef.current?.send(JSON.stringify({ type: "paid" }));
    } catch {
      // best-effort
    }
    setStatus("paid");
  }, []);

  // Gate on auth/wallet so PayButton.Custom has what it needs.
  // If a prefill is in flight, don't bounce to the auth screen — the
  // prefill effect may be about to write credentials and reload.
  if (!apiKey) {
    if (prefillParam) {
      return <Shell>Loading payment request…</Shell>;
    }
    return (
      <Shell>
        <p className="mb-4 text-sm text-gray-400">
          Set your CoinVoyage API key first.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 uppercase tracking-wider text-xs text-white"
          style={{
            background: "linear-gradient(135deg, #ff0033 0%, #cc0029 100%)",
          }}
        >
          Authenticate
        </Link>
      </Shell>
    );
  }

  if (!walletReady) {
    return <Shell>Initializing wallet…</Shell>;
  }

  return (
    <Shell>
      {status === "idle" || status === "connecting" || status === "error" ? (
        <>
          <p className="mb-4 text-xs text-gray-500">
            Enter the 6-character code from the payee&apos;s screen.
          </p>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="ABC123"
            className="w-full font-mono tracking-[0.4em] text-center text-2xl"
          />
          {errMsg && (
            <p className="mt-3 text-[11px] text-[#ff6666]">{errMsg}</p>
          )}
          <button
            onClick={connect}
            disabled={status === "connecting"}
            className="mt-6 w-full py-3 uppercase tracking-wider text-xs text-white disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #ff0033 0%, #cc0029 100%)",
            }}
          >
            {status === "connecting" ? "Connecting…" : "Connect"}
          </button>
        </>
      ) : status === "request" || status === "paying" ? (
        request && (
          <PayUI request={request} onPaid={reportPaid} setStatus={setStatus} />
        )
      ) : (
        <div className="text-center">
          <p className="text-2xl text-green-400">Paid ✓</p>
          <p className="mt-1 text-xs text-gray-500">
            {request?.toAmount} USDC sent
          </p>
        </div>
      )}
    </Shell>
  );
}

function PayUI({
  request,
  onPaid,
  setStatus,
}: {
  request: PaymentRequest;
  onPaid: () => void;
  setStatus: (s: Status) => void;
}) {
  return (
    <>
      <p className="text-[10px] uppercase tracking-wider text-gray-500">
        Payment request
      </p>
      <p className="mt-2 text-3xl text-white">
        {request.toAmount.toFixed(2)} USDC
      </p>
      <p className="mt-1 break-all font-mono text-[10px] text-gray-500">
        → {request.toAddress}
      </p>
      {request.memo && (
        <p className="mt-2 text-xs text-gray-400">&ldquo;{request.memo}&rdquo;</p>
      )}

      <div className="my-5 border-t border-[#1a0a0a]" />

      <PayButton.Custom
        intent="Tap to pay"
        toChain={request.chainId as ChainId}
        toAddress={request.toAddress}
        toAmount={request.toAmount}
        toToken={request.toToken}
        onPaymentCreationError={(e: unknown) => console.error("[Paykit]", e)}
        onPaymentStarted={() => setStatus("paying")}
        onPaymentCompleted={() => onPaid()}
        onPaymentBounced={() => console.log("[Paykit] bounced")}
      >
        {({ show }: { show: () => void }) => (
          <button
            type="button"
            onClick={() => show()}
            className="w-full py-3 uppercase tracking-wider text-xs text-white"
            style={{
              background:
                "linear-gradient(135deg, #ff0033 0%, #cc0029 100%)",
            }}
          >
            Pay {request.toAmount.toFixed(2)} USDC
          </button>
        )}
      </PayButton.Custom>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-black px-4 py-10">
      <div className="mx-auto max-w-md">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Send Payment</h1>
          <Link
            href="/"
            className="text-xs uppercase tracking-wider text-gray-500 hover:text-[#ff6666]"
          >
            ← Home
          </Link>
        </header>
        <section
          className="bg-[#0a0a0a] border border-[#331111] p-6"
          style={{
            boxShadow:
              "0 0 30px rgba(255, 0, 51, 0.15), inset 0 0 1px rgba(255, 51, 51, 0.3)",
          }}
        >
          {children}
        </section>
      </div>
    </main>
  );
}
