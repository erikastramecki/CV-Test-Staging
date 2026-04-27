"use client";

import { useEffect, useState } from "react";

type Mode = "dark" | "light";

export function FloatingDock() {
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  return (
    <>
      <button
        onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
        aria-label="Toggle theme"
        className="fixed bottom-5 left-5 z-30 grid h-10 w-10 place-items-center rounded-full border border-neutral-800 bg-neutral-900/80 text-neutral-200 shadow-lg backdrop-blur transition-colors hover:bg-neutral-900"
      >
        {mode === "dark" ? "☾" : "☀"}
      </button>
      <button
        aria-label="Help"
        title="Support is coming soon"
        className="fixed bottom-5 right-5 z-30 grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-lg transition-opacity hover:opacity-90"
      >
        ?
      </button>
    </>
  );
}
