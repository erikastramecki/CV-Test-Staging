"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// USDC on Base — same defaults the checkout demo uses.
const DEFAULT_CHAIN_ID = 8453;
const DEFAULT_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DEFAULT_ADDRESS = "0x24298ff17f46dF37CF4036393e37418C21648552";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

type Status =
  | "idle"
  | "creating"
  | "waiting"
  | "connected"
  | "paid"
  | "error";

function rand6() {
  // ambiguous chars stripped (no 0/O/1/I)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

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

export default function ReceivePage() {
  const [amount, setAmount] = useState("1.00");
  const [memo, setMemo] = useState("");
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [status, setStatus] = useState<Status>("idle");
  const [code, setCode] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const pollRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    dcRef.current?.close();
    pcRef.current?.close();
    dcRef.current = null;
    pcRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    setErrMsg(null);
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setErrMsg("Enter a valid amount");
      return;
    }
    if (!address.startsWith("0x") || address.length !== 42) {
      setErrMsg("Recipient address looks wrong");
      return;
    }

    setStatus("creating");
    const newCode = rand6();

    try {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      const dc = pc.createDataChannel("pay");
      dcRef.current = dc;

      dc.onopen = () => {
        const payload = {
          type: "payment-request",
          chainId: DEFAULT_CHAIN_ID,
          toAddress: address,
          toToken: DEFAULT_TOKEN,
          toAmount: numericAmount,
          memo: memo || undefined,
        };
        dc.send(JSON.stringify(payload));
        setStatus("connected");
      };

      dc.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "paid") {
            setStatus("paid");
            // best-effort cleanup of the rendezvous record
            fetch(`/api/p2p/${newCode}`, { method: "DELETE" }).catch(() => {});
          }
        } catch {
          // ignore non-JSON
        }
      };

      dc.onerror = () => setErrMsg("Data channel error");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceComplete(pc);

      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error("Failed to gather local SDP");

      const res = await fetch(`/api/p2p/${newCode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "offer", sdp }),
      });
      if (!res.ok) throw new Error("Signaling POST failed");

      setCode(newCode);
      setJoinUrl(`${window.location.origin}/pay/send?code=${newCode}`);
      setStatus("waiting");

      // poll for the answer
      pollRef.current = window.setInterval(async () => {
        try {
          const r = await fetch(`/api/p2p/${newCode}?role=answer`);
          if (!r.ok) return;
          const data = (await r.json()) as { sdp?: string | null };
          if (data.sdp && pc.signalingState !== "stable") {
            await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch {
          // transient — keep polling
        }
      }, 1000);
    } catch (err) {
      console.error(err);
      setErrMsg(err instanceof Error ? err.message : "Failed to start");
      setStatus("error");
      cleanup();
    }
  }, [amount, address, memo, cleanup]);

  const reset = () => {
    cleanup();
    setStatus("idle");
    setCode(null);
    setJoinUrl(null);
    setErrMsg(null);
  };

  return (
    <main className="min-h-screen bg-black px-4 py-10">
      <div className="mx-auto max-w-md">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Request Payment</h1>
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
          {status === "idle" || status === "error" ? (
            <>
              <Field label="Amount (USDC)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-sm"
                />
              </Field>
              <Field label="Memo (optional)">
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full text-sm"
                />
              </Field>
              <Field label="Receiving Address">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full font-mono text-xs"
                />
              </Field>

              {errMsg && (
                <p className="mt-3 text-[11px] text-[#ff6666]">{errMsg}</p>
              )}

              <button
                onClick={start}
                className="mt-6 w-full py-3 uppercase tracking-wider text-xs text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #ff0033 0%, #cc0029 100%)",
                }}
              >
                Generate Payment Code
              </button>
              <p className="mt-3 text-center text-[10px] text-gray-500">
                Settles on Base in USDC via the CoinVoyage paykit.
              </p>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                  Share this code
                </p>
                <p className="my-3 font-mono text-4xl tracking-[0.4em] text-white">
                  {code}
                </p>
                {joinUrl && (
                  <a
                    href={joinUrl}
                    className="block break-all text-[11px] text-[#ff6666] underline"
                  >
                    {joinUrl}
                  </a>
                )}
              </div>

              <div className="my-6 border-t border-[#1a0a0a]" />

              <StatusLine status={status} amount={amount} />

              <button
                onClick={reset}
                className="mt-6 w-full py-2 text-[10px] uppercase tracking-wider text-gray-500 hover:text-[#ff6666]"
              >
                Cancel / new code
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusLine({ status, amount }: { status: Status; amount: string }) {
  const map: Record<Status, { text: string; color: string }> = {
    idle: { text: "", color: "" },
    error: { text: "", color: "" },
    creating: { text: "Creating session…", color: "text-gray-400" },
    waiting: { text: "Waiting for payer to connect…", color: "text-gray-400" },
    connected: {
      text: "Payer connected — waiting for confirmation…",
      color: "text-yellow-400",
    },
    paid: { text: `Paid ${amount} USDC ✓`, color: "text-green-400" },
  };
  const s = map[status];
  return <p className={`text-center text-xs ${s.color}`}>{s.text}</p>;
}
