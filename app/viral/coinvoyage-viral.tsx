"use client";

import { useState, useEffect, useRef } from "react";

const GLOBAL_STYLES = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes floatUp {
    0% { opacity: 0; transform: translateY(28px) scale(0.97); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes fadeInScale {
    0% { opacity: 0; transform: scale(0.85); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes slideInRight {
    0% { opacity: 0; transform: translateX(30px); }
    100% { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInLeft {
    0% { opacity: 0; transform: translateX(-30px); }
    100% { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 15px rgba(207,39,107,0.2), 0 0 40px rgba(207,39,107,0.08); }
    50% { box-shadow: 0 0 30px rgba(207,39,107,0.4), 0 0 70px rgba(207,39,107,0.15); }
  }
  @keyframes borderGlow {
    0%, 100% { border-color: rgba(207,39,107,0.25); }
    50% { border-color: rgba(207,39,107,0.7); }
  }
  @keyframes ripple {
    0% { transform: scale(0); opacity: 0.5; }
    100% { transform: scale(4); opacity: 0; }
  }
  @keyframes modalSlideUp {
    0% { opacity: 0; transform: translateY(40px) scale(0.94); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes selectPulse {
    0% { background: rgba(207,39,107,0); }
    50% { background: rgba(207,39,107,0.12); }
    100% { background: rgba(207,39,107,0.05); }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes checkBounce {
    0% { transform: scale(0); }
    60% { transform: scale(1.15); }
    100% { transform: scale(1); }
  }
  @keyframes barGrow {
    0% { width: 0%; }
    100% { width: var(--target-width); }
  }
  @keyframes particleFloat {
    0% { opacity: 0; transform: translateY(0) scale(0); }
    20% { opacity: 1; transform: translateY(-15px) scale(1); }
    100% { opacity: 0; transform: translateY(-80px) scale(0.4); }
  }
  @keyframes typeCursor {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
`;

const SCENES = [
  { id: "hook", duration: 3200 },
  { id: "problem", duration: 3200 },
  { id: "platform", duration: 3500 },
  { id: "deposit", duration: 3800 },
  { id: "selectMethod", duration: 3200 },
  { id: "selectToken", duration: 3500 },
  { id: "processing", duration: 3200 },
  { id: "complete", duration: 3500 },
  { id: "cta", duration: 3500 },
];

// ─── Shared Components ───
function GradientText({ children, from = "#CF276B", to = "#FF6B9D" }) {
  return (
    <span style={{
      background: `linear-gradient(135deg, ${from} 0%, ${to} 50%, ${from} 100%)`,
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      backgroundClip: "text", animation: "shimmer 3s linear infinite",
    }}>{children}</span>
  );
}

function ChainDot({ color, symbol, size = 20 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `${color}30`, border: `1.5px solid ${color}77`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color, flexShrink: 0,
    }}>{symbol}</div>
  );
}

function ProgressTimeline({ current, total }) {
  return (
    <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5, zIndex: 100 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 22 : 6, height: 4, borderRadius: 2,
          background: i === current ? "#CF276B" : i < current ? "rgba(207,39,107,0.45)" : "rgba(255,255,255,0.1)",
          transition: "all 0.4s ease",
        }} />
      ))}
    </div>
  );
}

// Prediction market card
function MarketCard({ title, yesPercent, volume, active, highlighted, delay = 0 }) {
  return (
    <div style={{
      padding: "11px 13px", borderRadius: 12,
      background: highlighted ? "rgba(207,39,107,0.06)" : "rgba(255,255,255,0.025)",
      border: highlighted ? "1px solid rgba(207,39,107,0.3)" : "1px solid rgba(255,255,255,0.05)",
      animation: active ? `floatUp 0.35s ease-out ${delay}s forwards` : "none",
      opacity: active ? 1 : 0,
      transition: "background 0.3s, border 0.3s",
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 8, lineHeight: 1.35 }}>{title}</div>
      {/* Probability bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, #10B981, #34D399)`, width: `${yesPercent}%`, transition: "width 0.8s ease" }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#10B981", minWidth: 32, textAlign: "right" }}>{yesPercent}%</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 5 }}>
          <div style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 10, fontWeight: 700, color: "#10B981" }}>Yes</div>
          <div style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 10, fontWeight: 700, color: "#EF4444" }}>No</div>
        </div>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>${volume} Vol</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SCENE 1: HOOK
// ═══════════════════════════════════════════
function HookScene() {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(true); }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(207,39,107,0.35)", animation: "ripple 2s ease-out infinite", transform: "translate(-50%, -50%)" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(207,39,107,0.35)", animation: "ripple 2s ease-out 0.7s infinite", transform: "translate(-50%, -50%)" }} />

      <div style={{ animation: show ? "fadeInScale 0.6s ease-out forwards" : "none", opacity: 0, textAlign: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: "3px", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>What if your prediction market</div>
        <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.15, letterSpacing: "-1px" }}>
          <span style={{ color: "#fff" }}>Accepted deposits from</span><br />
          <GradientText>any chain?</GradientText>
        </div>
      </div>

      <div style={{ animation: show ? "floatUp 0.6s ease-out 0.6s forwards" : "none", opacity: 0, marginTop: 24 }}>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {[
            { s: "ETH", c: "#627EEA" }, { s: "SOL", c: "#9945FF" }, { s: "BTC", c: "#F7931A" },
            { s: "SUI", c: "#4DA2FF" }, { s: "ARB", c: "#28A0F0" }, { s: "BASE", c: "#0052FF" },
          ].map((ch, i) => (
            <div key={i} style={{ animation: `fadeInScale 0.3s ease-out ${0.8 + i * 0.1}s forwards`, opacity: 0 }}>
              <ChainDot color={ch.c} symbol={ch.s} size={32} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ animation: show ? "floatUp 0.6s ease-out 1.4s forwards" : "none", opacity: 0, marginTop: 20 }}>
        <div style={{ padding: "8px 20px", borderRadius: 50, border: "1px solid rgba(207,39,107,0.35)", fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: "1px" }}>
          NO BRIDGING. NO SWAPPING. JUST DEPOSIT.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SCENE 2: THE PROBLEM
// ═══════════════════════════════════════════
function ProblemScene() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 400);
    const t2 = setTimeout(() => setStep(2), 1100);
    const t3 = setTimeout(() => setStep(3), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const steps = [
    { icon: "🌉", text: "Bridge SOL to Ethereum", time: "~5 min" },
    { icon: "🔄", text: "Swap ETH for USDC", time: "~2 min" },
    { icon: "💸", text: "Deposit USDC on platform", time: "~1 min" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
      <div style={{ animation: "fadeInScale 0.4s ease-out forwards", opacity: 0 }}>
        <div style={{ fontSize: 13, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6, textAlign: "center" }}>Today's user experience</div>
        <div style={{ fontSize: 28, fontWeight: 800, textAlign: "center", color: "#fff" }}>
          3 steps just to <span style={{ color: "#EF4444" }}>deposit</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 340, marginTop: 8 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px", borderRadius: 12,
            background: step > i ? "rgba(239,68,68,0.06)" : "transparent",
            border: step > i ? "1px solid rgba(239,68,68,0.15)" : "1px solid transparent",
            animation: step > i ? `slideInRight 0.4s ease-out forwards` : "none",
            opacity: step > i ? 1 : 0,
          }}>
            <span style={{ fontSize: 22 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Step {i + 1}: {s.text}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{s.time}</div>
            </div>
            <span style={{ color: "#EF4444", fontSize: 16 }}>✕</span>
          </div>
        ))}
      </div>

      {step >= 3 && (
        <div style={{ animation: "floatUp 0.3s ease-out forwards", marginTop: 4 }}>
          <div style={{ fontSize: 12, color: "#EF4444", fontWeight: 600 }}>8+ minutes. Multiple gas fees. Users drop off.</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SCENE 3: YOUR PLATFORM (Polymarket-style)
// ═══════════════════════════════════════════
function PlatformScene() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 400);
    const t2 = setTimeout(() => setStep(2), 1200);
    const t3 = setTimeout(() => setStep(3), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 24px" }}>
      <div style={{ animation: "fadeInScale 0.4s ease-out forwards", opacity: 0, marginBottom: 14 }}>
        <div style={{ fontSize: 13, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>Your prediction market</div>
      </div>

      {/* Platform chrome */}
      <div style={{
        width: "100%", maxWidth: 380,
        background: "rgba(255,255,255,0.02)", borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.05)",
        overflow: "hidden",
        animation: step >= 1 ? "floatUp 0.4s ease-out forwards" : "none",
        opacity: step >= 1 ? 1 : 0,
      }}>
        {/* Nav bar */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>🔮 CryptoPredict</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ padding: "5px 12px", borderRadius: 8, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              Balance: $0.00
            </div>
            <div style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 10, fontWeight: 700,
              background: step >= 3 ? "linear-gradient(135deg, #CF276B, #FF6B9D)" : "rgba(207,39,107,0.15)",
              color: step >= 3 ? "#fff" : "rgba(207,39,107,0.5)",
              transition: "all 0.4s ease",
              animation: step >= 3 ? "pulseGlow 1.5s ease-in-out infinite" : "none",
            }}>
              Deposit
            </div>
          </div>
        </div>

        {/* Market cards */}
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <MarketCard title="Will BTC hit $200k by Dec 2027?" yesPercent={67} volume="24.5M" active={step >= 2} highlighted={false} delay={0} />
          <MarketCard title="Will ETH flip SOL in market cap?" yesPercent={23} volume="8.2M" active={step >= 2} highlighted={false} delay={0.1} />
          <MarketCard title="Will a spot XRP ETF launch in 2026?" yesPercent={78} volume="12.1M" active={step >= 2} highlighted={false} delay={0.2} />
        </div>
      </div>

      {step >= 3 && (
        <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.25)", animation: "fadeIn 0.3s ease-out", textAlign: "center" }}>
          ↑ User clicks Deposit — enters CoinVoyage flow...
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SCENE 4: DEPOSIT FORM
// ═══════════════════════════════════════════
function DepositScene() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 400);
    const t2 = setTimeout(() => setStep(2), 1300);
    const t3 = setTimeout(() => setStep(3), 2200);
    const t4 = setTimeout(() => setStep(4), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const networks = [
    { name: "Ethereum", c: "#627EEA" }, { name: "Solana", c: "#9945FF" },
    { name: "SUI", c: "#4DA2FF" }, { name: "Bitcoin", c: "#F7931A" },
    { name: "Base", c: "#0052FF" }, { name: "Arbitrum", c: "#28A0F0" },
  ];

  const tokens = ["USDC", "ETH", "SOL", "USDT", "DAI", "WBTC", "SUI"];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <div style={{ animation: "fadeInScale 0.35s ease-out forwards", opacity: 0, marginBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800, textAlign: "center", color: "#fff" }}>
          <GradientText>Deposit Funds</GradientText> — from any chain
        </div>
      </div>

      {step >= 1 && (
        <div style={{
          width: 310, background: "#1c1c1e", borderRadius: 18, padding: "20px 18px",
          animation: "modalSlideUp 0.4s ease-out forwards",
          boxShadow: "0 16px 50px rgba(0,0,0,0.5), 0 0 25px rgba(207,39,107,0.06)",
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 3 }}>Deposit Funds</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>Deposit into your prediction market account.</div>

          {/* Amount */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 5, fontWeight: 600 }}>Amount</div>
            <div style={{
              display: "flex", alignItems: "center",
              background: "rgba(255,255,255,0.035)", borderRadius: 10,
              border: step >= 2 ? "1px solid rgba(207,39,107,0.35)" : "1px solid rgba(255,255,255,0.07)",
              padding: "9px 13px", transition: "border 0.3s",
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: step >= 2 ? "#fff" : "rgba(255,255,255,0.2)", fontFamily: "monospace", transition: "color 0.3s" }}>
                {step >= 2 ? "500" : "0"}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#2775CA", fontWeight: 600 }}>USDC</span>
            </div>
          </div>

          {/* Network pills */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 5, fontWeight: 600 }}>Network</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {networks.map((n, i) => {
                const selected = (step >= 3 && i === 1) || (step < 3 && i === 0);
                return (
                  <div key={n.name} style={{
                    padding: "5px 10px", borderRadius: 7, fontSize: 10, fontWeight: 600,
                    background: selected ? `${n.c}18` : "rgba(255,255,255,0.03)",
                    border: selected ? `1px solid ${n.c}44` : "1px solid rgba(255,255,255,0.05)",
                    color: selected ? n.c : "rgba(255,255,255,0.35)",
                    transition: "all 0.4s ease",
                  }}>{n.name}</div>
                );
              })}
            </div>
          </div>

          {/* Token row */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 5, fontWeight: 600 }}>Token</div>
            <div style={{ display: "flex", gap: 5, overflow: "hidden" }}>
              {tokens.map((t, i) => (
                <div key={t} style={{
                  padding: "5px 9px", borderRadius: 7, fontSize: 10, fontWeight: 600, flexShrink: 0,
                  background: i === 0 ? "rgba(207,39,107,0.08)" : "rgba(255,255,255,0.03)",
                  border: i === 0 ? "1px solid rgba(207,39,107,0.25)" : "1px solid rgba(255,255,255,0.05)",
                  color: i === 0 ? "#CF276B" : "rgba(255,255,255,0.35)",
                }}>{t}</div>
              ))}
            </div>
          </div>

          {/* Deposit button */}
          <div style={{
            padding: "11px 0", borderRadius: 11, marginTop: 4,
            background: step >= 4 ? "linear-gradient(135deg, #CF276B, #FF6B9D)" : "rgba(207,39,107,0.12)",
            textAlign: "center", fontSize: 13, fontWeight: 700,
            color: step >= 4 ? "#fff" : "rgba(207,39,107,0.45)",
            transition: "all 0.4s ease",
            animation: step >= 4 ? "pulseGlow 1.5s ease-in-out infinite" : "none",
          }}>
            Deposit 500 USDC
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SCENE 5: SELECT METHOD (CoinVoyage modal)
// ═══════════════════════════════════════════
function SelectMethodScene() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 400);
    const t2 = setTimeout(() => setStep(2), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const chainIcons = [
    { s: "BTC", c: "#F7931A" }, { s: "ETH", c: "#627EEA" }, { s: "SOL", c: "#9945FF" },
    { s: "SUI", c: "#4DA2FF" }, { s: "OP", c: "#FF0420" }, { s: "ARB", c: "#28A0F0" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
      {step >= 1 && (
        <div style={{
          width: 290, background: "#1c1c1e", borderRadius: 18, padding: "16px 0",
          animation: "modalSlideUp 0.4s ease-out forwards",
          boxShadow: "0 16px 50px rgba(0,0,0,0.6), 0 0 30px rgba(207,39,107,0.08)",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginBottom: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>?</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Select Method</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>✕</div>
          </div>

          <div style={{ textAlign: "center", padding: "4px 0 8px" }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#fff", letterSpacing: "-1px" }}>$500.00</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 12 }}>
            {chainIcons.map((c, i) => <ChainDot key={i} color={c.c} symbol={c.s} size={16} />)}
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginLeft: 4 }}>1000+ tokens accepted</span>
          </div>

          <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "Pay with Wallet", icons: [{ s: "🦊", c: "#F7931A" }, { s: "🔵", c: "#3b99fc" }] },
              { label: "Pay to Address", icons: [{ s: "E", c: "#627EEA" }, { s: "S", c: "#9945FF" }] },
              { label: "Pay with Card", icons: [] },
            ].map((opt, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 13px", borderRadius: 12,
                background: (step >= 2 && i === 0) ? "rgba(207,39,107,0.07)" : "rgba(255,255,255,0.03)",
                border: (step >= 2 && i === 0) ? "1px solid rgba(207,39,107,0.3)" : "1px solid rgba(255,255,255,0.05)",
                transition: "all 0.4s ease",
                animation: (step >= 2 && i === 0) ? "selectPulse 0.5s ease-out" : "none",
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{opt.label}</span>
                <div style={{ display: "flex", gap: 3 }}>
                  {opt.icons.length ? opt.icons.map((ic, j) => (
                    <span key={j} style={{ fontSize: 16 }}>{ic.s.length > 2 ? ic.s : ""}</span>
                  )) : (
                    <div style={{ width: 18, height: 12, borderRadius: 3, border: "1.5px solid rgba(255,255,255,0.2)" }} />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "linear-gradient(135deg, #CF276B, #FF6B9D)" }} />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>Powered by CoinVoyage</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SCENE 6: SELECT TOKEN (with wallet balances)
// ═══════════════════════════════════════════
function SelectTokenScene() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 300);
    const t2 = setTimeout(() => setStep(2), 1000);
    const t3 = setTimeout(() => setStep(3), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const tokens = [
    { symbol: "SOL", name: "Solana", balance: "42.5", usd: "$6,375", color: "#9945FF", chain: "Solana" },
    { symbol: "ETH", name: "Ethereum", balance: "1.28", usd: "$4,327", color: "#627EEA", chain: "Ethereum" },
    { symbol: "USDC", name: "USD Coin", balance: "2,150", usd: "$2,150", color: "#2775CA", chain: "Base" },
    { symbol: "SUI", name: "Sui", balance: "1,200", usd: "$4,800", color: "#4DA2FF", chain: "Sui" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <div style={{
        width: 290, background: "#1c1c1e", borderRadius: 18, padding: "16px 0",
        animation: step >= 1 ? "modalSlideUp 0.4s ease-out forwards" : "none",
        opacity: step >= 1 ? 1 : 0,
        boxShadow: "0 16px 50px rgba(0,0,0,0.6), 0 0 30px rgba(207,39,107,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginBottom: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>←</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Select Payment</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>✕</div>
        </div>

        {step < 2 && (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 5 }}>⟳</span>
              Scanning wallet balances...
            </span>
          </div>
        )}

        <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 5 }}>
          {tokens.map((t, i) => (
            <div key={t.symbol} style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "9px 11px", borderRadius: 11,
              background: (step >= 3 && i === 0) ? `${t.color}0d` : "rgba(255,255,255,0.025)",
              border: (step >= 3 && i === 0) ? `1px solid ${t.color}33` : "1px solid rgba(255,255,255,0.04)",
              animation: step >= 2 ? `slideInRight 0.3s ease-out ${i * 0.07}s forwards` : "none",
              opacity: step >= 2 ? 1 : 0,
              transition: "background 0.3s, border 0.3s",
            }}>
              <ChainDot color={t.color} symbol={t.symbol.charAt(0)} size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{t.name}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{t.chain}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{t.balance} {t.symbol}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{t.usd}</div>
              </div>
            </div>
          ))}
        </div>

        {step >= 3 && (
          <div style={{ margin: "10px 12px 0", padding: "8px 11px", borderRadius: 9, background: "rgba(153,69,255,0.06)", border: "1px solid rgba(153,69,255,0.15)", animation: "fadeIn 0.3s ease-out", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
            Paying <span style={{ color: "#9945FF", fontWeight: 600 }}>42.5 SOL</span> from Solana → receives <span style={{ color: "#2775CA", fontWeight: 600 }}>500 USDC</span> on platform
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "linear-gradient(135deg, #CF276B, #FF6B9D)" }} />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>Powered by CoinVoyage</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SCENE 7: PROCESSING
// ═══════════════════════════════════════════
function ProcessingScene() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 300);
    const t2 = setTimeout(() => setStep(2), 800);
    const t3 = setTimeout(() => setStep(3), 1500);
    const t4 = setTimeout(() => setStep(4), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const stages = [
    { label: "Transaction detected", sub: "Solana network" },
    { label: "Swapping SOL → USDC", sub: "Via Jupiter" },
    { label: "Bridging to platform chain", sub: "Via CCTP" },
    { label: "Depositing to your account", sub: "500 USDC" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <div style={{
        width: 290, background: "#1c1c1e", borderRadius: 18, padding: "16px 0",
        animation: step >= 1 ? "modalSlideUp 0.4s ease-out forwards" : "none",
        opacity: step >= 1 ? 1 : 0,
        boxShadow: "0 16px 50px rgba(0,0,0,0.6), 0 0 30px rgba(207,39,107,0.08)",
      }}>
        <div style={{ textAlign: "center", padding: "0 16px", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Processing Deposit</div>
        </div>

        <div style={{ textAlign: "center", margin: "4px 0 12px" }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%",
            border: "3px solid rgba(207,39,107,0.12)", borderTopColor: "#CF276B",
            animation: "spin 0.8s linear infinite", margin: "0 auto",
          }} />
        </div>

        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 7 }}>
          {stages.map((s, i) => {
            const done = step > i + 1;
            const active = step === i + 1;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 9,
                animation: step > i ? "fadeIn 0.3s ease-out forwards" : "none",
                opacity: step > i ? 1 : 0.12,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  background: done ? "rgba(16,185,129,0.12)" : active ? "rgba(207,39,107,0.12)" : "rgba(255,255,255,0.03)",
                  border: done ? "1.5px solid #10B981" : active ? "1.5px solid #CF276B" : "1.5px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, color: done ? "#10B981" : "#CF276B",
                }}>
                  {done ? "✓" : active ? "●" : "○"}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: done || active ? "#fff" : "rgba(255,255,255,0.2)" }}>{s.label}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{s.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ margin: "12px 16px 0", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #CF276B, #FF6B9D)", width: `${Math.min(step * 25, 100)}%`, transition: "width 0.5s ease" }} />
        </div>

        <div style={{ textAlign: "center", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "linear-gradient(135deg, #CF276B, #FF6B9D)" }} />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>Powered by CoinVoyage</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// SCENE 8: COMPLETE — back on platform
// ═══════════════════════════════════════════
function CompleteScene() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 400);
    const t2 = setTimeout(() => setStep(2), 1200);
    const t3 = setTimeout(() => setStep(3), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 24px" }}>
      {/* Success flash */}
      <div style={{ animation: step >= 1 ? "fadeInScale 0.4s ease-out forwards" : "none", opacity: 0, marginBottom: 16, textAlign: "center" }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "linear-gradient(135deg, #10B981, #34D399)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, color: "#fff", margin: "0 auto 10px",
          animation: step >= 1 ? "checkBounce 0.5s ease-out forwards" : "none",
          transform: "scale(0)",
        }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Deposit Complete!</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
          <span style={{ color: "#9945FF", fontWeight: 600 }}>42.5 SOL</span> → <span style={{ color: "#2775CA", fontWeight: 600 }}>500 USDC</span> in <span style={{ color: "#10B981", fontWeight: 600 }}>18 seconds</span>
        </div>
      </div>

      {/* Platform with updated balance */}
      {step >= 2 && (
        <div style={{
          width: "100%", maxWidth: 360, borderRadius: 14,
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
          overflow: "hidden", animation: "floatUp 0.4s ease-out forwards",
        }}>
          <div style={{ padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>🔮 CryptoPredict</div>
            <div style={{ padding: "5px 12px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#10B981" }}>
              Balance: $500.00
            </div>
          </div>

          {step >= 3 && (
            <div style={{ padding: "10px 12px", animation: "fadeIn 0.3s ease-out" }}>
              <MarketCard title="Will BTC hit $200k by Dec 2027?" yesPercent={67} volume="24.5M" active={true} highlighted={true} />
              <div style={{ marginTop: 8, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                Ready to trade with <span style={{ color: "#10B981", fontWeight: 600 }}>$500.00</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SCENE 9: CTA
// ═══════════════════════════════════════════
function CTAScene() {
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 200); }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", position: "relative" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(207,39,107,0.3)", animation: "ripple 2.5s ease-out infinite", transform: "translate(-50%, -50%)" }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(207,39,107,0.3)", animation: "ripple 2.5s ease-out 0.8s infinite", transform: "translate(-50%, -50%)" }} />

      <div style={{ animation: show ? "fadeInScale 0.5s ease-out forwards" : "none", opacity: 0, textAlign: "center" }}>
        <div style={{ fontSize: 14, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>No bridging. No swapping.</div>
        <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.15 }}>
          <span style={{ color: "#fff" }}>Let users deposit from</span><br />
          <GradientText>any chain</GradientText>
        </div>
      </div>

      <div style={{ animation: show ? "floatUp 0.5s ease-out 0.4s forwards" : "none", opacity: 0, marginTop: 20, display: "flex", gap: 10 }}>
        <div style={{ padding: "12px 28px", borderRadius: 50, background: "linear-gradient(135deg, #CF276B, #FF6B9D)", fontSize: 14, fontWeight: 700, color: "#fff", animation: "pulseGlow 2s ease-in-out infinite" }}>
          Integrate CoinVoyage →
        </div>
      </div>

      <div style={{ animation: show ? "floatUp 0.5s ease-out 0.7s forwards" : "none", opacity: 0, marginTop: 18, display: "flex", gap: 6, alignItems: "center" }}>
        {[{ s: "ETH", c: "#627EEA" }, { s: "SOL", c: "#9945FF" }, { s: "BTC", c: "#F7931A" }, { s: "SUI", c: "#4DA2FF" }, { s: "ARB", c: "#28A0F0" }, { s: "BASE", c: "#0052FF" }, { s: "OP", c: "#FF0420" }, { s: "POL", c: "#8247E5" }, { s: "BNB", c: "#F3BA2F" }].map((ch, i) => (
          <ChainDot key={i} color={ch.c} symbol={ch.s} size={24} />
        ))}
      </div>

      <div style={{ animation: show ? "floatUp 0.5s ease-out 0.9s forwards" : "none", opacity: 0, marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.2)", letterSpacing: "1px" }}>
        coinvoyage.io
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
export default function CoinVoyageDepositViral() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) return;
    const advance = () => {
      setSceneIndex((prev) => {
        const next = prev + 1;
        if (next >= SCENES.length) { setIsPlaying(false); return 0; }
        return next;
      });
    };
    timeoutRef.current = setTimeout(advance, SCENES[sceneIndex].duration);
    return () => clearTimeout(timeoutRef.current);
  }, [sceneIndex, isPlaying]);

  const handleReplay = () => { setSceneIndex(0); setIsPlaying(true); };

  const sceneMap = {
    hook: HookScene,
    problem: ProblemScene,
    platform: PlatformScene,
    deposit: DepositScene,
    selectMethod: SelectMethodScene,
    selectToken: SelectTokenScene,
    processing: ProcessingScene,
    complete: CompleteScene,
    cta: CTAScene,
  };

  const CurrentScene = sceneMap[SCENES[sceneIndex].id];

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ width: "100%", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", padding: 20, boxSizing: "border-box" }}>
        <div style={{
          width: 600, height: 600, maxWidth: "100%",
          background: "radial-gradient(ellipse at center, #0d0a14 0%, #080810 50%, #000 100%)",
          borderRadius: 20, overflow: "hidden", position: "relative",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          color: "#fff", flexShrink: 0,
        }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(153,69,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(153,69,255,0.02) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />

          <div style={{ position: "relative", width: "100%", height: "100%", zIndex: 10 }}>
            <CurrentScene key={sceneIndex} />
          </div>

          <ProgressTimeline current={sceneIndex} total={SCENES.length} />

          {!isPlaying && (
            <button onClick={handleReplay} style={{
              position: "absolute", top: 16, right: 16, zIndex: 100,
              padding: "7px 14px", borderRadius: 50,
              background: "rgba(207,39,107,0.2)", border: "1px solid rgba(207,39,107,0.35)",
              color: "#CF276B", fontSize: 12, fontWeight: 600, cursor: "pointer",
              animation: "fadeInScale 0.3s ease-out forwards",
            }}>▶ Replay</button>
          )}

          <div style={{ position: "absolute", top: 16, left: 16, fontSize: 10, fontWeight: 700, color: "rgba(207,39,107,0.3)", letterSpacing: "1px", zIndex: 100 }}>
            COINVOYAGE
          </div>
        </div>
      </div>
    </>
  );
}
