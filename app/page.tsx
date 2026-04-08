"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AuthenticatePage() {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasStored, setHasStored] = useState(false);

  useEffect(() => {
    const a = localStorage.getItem("cv_api_key") || "";
    const s = localStorage.getItem("cv_secret_key") || "";
    if (a) setApiKey(a);
    if (s) setSecretKey(s);
    setHasStored(!!a && !!s);
  }, []);

  const save = () => {
    localStorage.setItem("cv_api_key", apiKey);
    localStorage.setItem("cv_secret_key", secretKey);
    setSaved(true);
    setHasStored(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const clear = () => {
    localStorage.removeItem("cv_api_key");
    localStorage.removeItem("cv_secret_key");
    setApiKey("");
    setSecretKey("");
    setHasStored(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-10">
      <div
        className="w-full max-w-md bg-[#0a0a0a] border border-[#331111] p-8"
        style={{
          boxShadow:
            "0 0 30px rgba(255, 0, 51, 0.15), inset 0 0 1px rgba(255, 51, 51, 0.3)",
        }}
      >
        <h1 className="text-2xl font-semibold mb-1">Authenticate</h1>
        <p className="text-sm text-gray-400 mb-6">
          Paste your CoinVoyage API credentials. Stored in localStorage on this device only.
        </p>

        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
          API Key
        </label>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="pk_live_..."
          className="w-full mb-4 font-mono text-sm"
        />

        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
          Secret Key
        </label>
        <input
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder="sk_live_..."
          className="w-full mb-6 font-mono text-sm"
        />

        <button
          onClick={save}
          disabled={!apiKey || !secretKey}
          className="w-full uppercase tracking-wider text-xs py-3 mb-3 text-white disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #ff0033 0%, #cc0029 100%)",
          }}
        >
          {saved ? "Saved" : "Save Credentials"}
        </button>

        {hasStored && (
          <>
            <Link
              href="/dashboard"
              className="block w-full text-center uppercase tracking-wider text-xs py-3 mb-3 border border-[#331111] hover:border-[#ff0033] hover:text-[#ff6666] transition"
            >
              Go to Dashboard →
            </Link>
            <Link
              href="/checkout"
              className="block w-full text-center uppercase tracking-wider text-xs py-3 mb-3 border border-[#331111] hover:border-[#ff0033] hover:text-[#ff6666] transition"
            >
              Checkout Demo →
            </Link>
            <Link
              href="/pay/receive"
              className="block w-full text-center uppercase tracking-wider text-xs py-3 mb-3 border border-[#331111] hover:border-[#ff0033] hover:text-[#ff6666] transition"
            >
              Tap to Pay · Request →
            </Link>
            <Link
              href="/pay/send"
              className="block w-full text-center uppercase tracking-wider text-xs py-3 mb-3 border border-[#331111] hover:border-[#ff0033] hover:text-[#ff6666] transition"
            >
              Tap to Pay · Send →
            </Link>
            <button
              onClick={clear}
              className="w-full uppercase tracking-wider text-xs py-2 text-gray-500 hover:text-[#ff6666]"
            >
              Clear stored credentials
            </button>
          </>
        )}
      </div>
    </main>
  );
}
