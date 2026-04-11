"use client";

import CoinVoyageDepositViral from "./coinvoyage-viral";

export default function ViralPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        padding: 20,
      }}
    >
      <CoinVoyageDepositViral />
    </div>
  );
}
