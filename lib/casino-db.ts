// Server-only SQLite ledger for the casino. Imported only from API routes.
// Schema is created on first import. The DB file lives in ./casino-data/casino.db
// (gitignored). Balances are stored as integer cents to avoid float drift.

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_DIR = path.join(process.cwd(), "casino-data");
const DB_PATH = path.join(DB_DIR, "casino.db");

fs.mkdirSync(DB_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    address TEXT PRIMARY KEY,
    balance_cents INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT UNIQUE,
    address TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    raw_event TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_deposits_address ON deposits(address);

  CREATE TABLE IF NOT EXISTS seeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    server_seed TEXT NOT NULL,
    server_seed_hash TEXT NOT NULL,
    client_seed TEXT NOT NULL,
    nonce INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    revealed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    revealed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_seeds_address_active ON seeds(address, active);

  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    game TEXT NOT NULL,
    bet_cents INTEGER NOT NULL,
    payload TEXT,
    result TEXT,
    payout_cents INTEGER NOT NULL DEFAULT 0,
    seed_id INTEGER NOT NULL,
    nonce INTEGER NOT NULL,
    server_seed_hash TEXT NOT NULL,
    client_seed TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (seed_id) REFERENCES seeds(id)
  );
  CREATE INDEX IF NOT EXISTS idx_bets_address ON bets(address);

  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    tx_hash TEXT,
    requested_at INTEGER NOT NULL,
    processed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_withdrawals_address ON withdrawals(address);
`);

// ---------- helpers ----------
const now = () => Date.now();

export function normalizeAddress(addr: string): string {
  return (addr || "").trim().toLowerCase();
}

export function ensureUser(address: string): void {
  const a = normalizeAddress(address);
  if (!a) throw new Error("missing address");
  const t = now();
  db.prepare(
    `INSERT INTO users (address, balance_cents, created_at, updated_at)
     VALUES (?, 0, ?, ?)
     ON CONFLICT(address) DO NOTHING`,
  ).run(a, t, t);
}

export function getBalance(address: string): number {
  const a = normalizeAddress(address);
  const row = db.prepare("SELECT balance_cents FROM users WHERE address = ?").get(a) as
    | { balance_cents: number }
    | undefined;
  return row?.balance_cents ?? 0;
}

export function adjustBalance(address: string, deltaCents: number): number {
  const a = normalizeAddress(address);
  ensureUser(a);
  const tx = db.transaction(() => {
    const current = (db
      .prepare("SELECT balance_cents FROM users WHERE address = ?")
      .get(a) as { balance_cents: number }).balance_cents;
    const next = current + deltaCents;
    if (next < 0) throw new Error("insufficient balance");
    db.prepare("UPDATE users SET balance_cents = ?, updated_at = ? WHERE address = ?").run(
      next,
      now(),
      a,
    );
    return next;
  });
  return tx();
}

// idempotent on payment_id (UNIQUE constraint).
export function recordDeposit(params: {
  paymentId: string | null;
  address: string;
  amountCents: number;
  status: string;
  source: string;
  rawEvent?: any;
}): { credited: boolean; balance: number } {
  const a = normalizeAddress(params.address);
  ensureUser(a);

  // dedupe via payment_id
  if (params.paymentId) {
    const existing = db
      .prepare("SELECT id FROM deposits WHERE payment_id = ?")
      .get(params.paymentId);
    if (existing) {
      return { credited: false, balance: getBalance(a) };
    }
  }

  const t = now();
  db.prepare(
    `INSERT INTO deposits (payment_id, address, amount_cents, status, source, raw_event, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    params.paymentId,
    a,
    params.amountCents,
    params.status,
    params.source,
    params.rawEvent ? JSON.stringify(params.rawEvent) : null,
    t,
  );

  const newBalance = adjustBalance(a, params.amountCents);
  return { credited: true, balance: newBalance };
}

// ---------- seeds (provably fair) ----------
export type SeedRow = {
  id: number;
  address: string;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  active: number;
  revealed: number;
  created_at: number;
  revealed_at: number | null;
};

export function getActiveSeed(address: string): SeedRow | undefined {
  const a = normalizeAddress(address);
  return db
    .prepare("SELECT * FROM seeds WHERE address = ? AND active = 1 ORDER BY id DESC LIMIT 1")
    .get(a) as SeedRow | undefined;
}

export function createSeed(address: string, serverSeed: string, serverSeedHash: string, clientSeed: string): SeedRow {
  const a = normalizeAddress(address);
  // deactivate any prior seed
  db.prepare("UPDATE seeds SET active = 0 WHERE address = ? AND active = 1").run(a);
  const t = now();
  const result = db
    .prepare(
      `INSERT INTO seeds (address, server_seed, server_seed_hash, client_seed, nonce, active, revealed, created_at)
       VALUES (?, ?, ?, ?, 0, 1, 0, ?)`,
    )
    .run(a, serverSeed, serverSeedHash, clientSeed, t);
  return db.prepare("SELECT * FROM seeds WHERE id = ?").get(result.lastInsertRowid) as SeedRow;
}

export function bumpSeedNonce(seedId: number): number {
  const updated = db
    .prepare("UPDATE seeds SET nonce = nonce + 1 WHERE id = ? RETURNING nonce")
    .get(seedId) as { nonce: number };
  return updated.nonce;
}

export function revealSeed(seedId: number): SeedRow | undefined {
  const t = now();
  db.prepare(
    "UPDATE seeds SET revealed = 1, active = 0, revealed_at = ? WHERE id = ?",
  ).run(t, seedId);
  return db.prepare("SELECT * FROM seeds WHERE id = ?").get(seedId) as SeedRow | undefined;
}

// ---------- bets ----------
export function recordBet(params: {
  address: string;
  game: string;
  betCents: number;
  payload: any;
  result: any;
  payoutCents: number;
  seedId: number;
  nonce: number;
  serverSeedHash: string;
  clientSeed: string;
}): number {
  const a = normalizeAddress(params.address);
  const t = now();
  const r = db
    .prepare(
      `INSERT INTO bets
        (address, game, bet_cents, payload, result, payout_cents, seed_id, nonce, server_seed_hash, client_seed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      a,
      params.game,
      params.betCents,
      JSON.stringify(params.payload),
      JSON.stringify(params.result),
      params.payoutCents,
      params.seedId,
      params.nonce,
      params.serverSeedHash,
      params.clientSeed,
      t,
    );
  return r.lastInsertRowid as number;
}

export function recentBets(address: string, limit = 25) {
  const a = normalizeAddress(address);
  return db
    .prepare("SELECT * FROM bets WHERE address = ? ORDER BY id DESC LIMIT ?")
    .all(a, limit);
}

// ---------- withdrawals ----------
export function queueWithdrawal(address: string, amountCents: number): { id: number; balance: number } {
  const a = normalizeAddress(address);
  // debit balance immediately so the user can't double-spend while it's queued
  const balance = adjustBalance(a, -amountCents);
  const t = now();
  const r = db
    .prepare(
      `INSERT INTO withdrawals (address, amount_cents, status, requested_at)
       VALUES (?, ?, 'queued', ?)`,
    )
    .run(a, amountCents, t);
  return { id: r.lastInsertRowid as number, balance };
}

export function listWithdrawals(address: string) {
  const a = normalizeAddress(address);
  return db
    .prepare("SELECT * FROM withdrawals WHERE address = ? ORDER BY id DESC LIMIT 25")
    .all(a);
}

// ---------- admin: deposits ----------
export function listAllDeposits(limit = 200) {
  return db
    .prepare("SELECT * FROM deposits ORDER BY id DESC LIMIT ?")
    .all(limit);
}

export function depositStats() {
  const row = db
    .prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(amount_cents), 0) as total_cents FROM deposits",
    )
    .get() as { count: number; total_cents: number };
  return row;
}

// ---------- admin: withdrawals ----------
export function listAllWithdrawals(status?: string, limit = 200) {
  if (status && status !== "all") {
    return db
      .prepare("SELECT * FROM withdrawals WHERE status = ? ORDER BY id DESC LIMIT ?")
      .all(status, limit);
  }
  return db.prepare("SELECT * FROM withdrawals ORDER BY id DESC LIMIT ?").all(limit);
}

export function withdrawalStats() {
  const rows = db
    .prepare(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(amount_cents), 0) as total_cents
       FROM withdrawals GROUP BY status`,
    )
    .all() as Array<{ status: string; count: number; total_cents: number }>;
  const summary: Record<string, { count: number; total_cents: number }> = {};
  for (const r of rows) summary[r.status] = { count: r.count, total_cents: r.total_cents };
  return summary;
}

export function approveWithdrawal(id: number, txHash?: string): { ok: boolean; row?: any; error?: string } {
  const row = db.prepare("SELECT * FROM withdrawals WHERE id = ?").get(id) as
    | { id: number; status: string }
    | undefined;
  if (!row) return { ok: false, error: "not found" };
  if (row.status !== "queued" && row.status !== "processing") {
    return { ok: false, error: `cannot approve withdrawal in status: ${row.status}` };
  }
  const t = now();
  db.prepare(
    "UPDATE withdrawals SET status = 'sent', tx_hash = ?, processed_at = ? WHERE id = ?",
  ).run(txHash ?? null, t, id);
  return { ok: true, row: db.prepare("SELECT * FROM withdrawals WHERE id = ?").get(id) };
}

export function rejectWithdrawal(id: number): { ok: boolean; row?: any; error?: string; refunded_cents?: number } {
  const row = db.prepare("SELECT * FROM withdrawals WHERE id = ?").get(id) as
    | { id: number; status: string; address: string; amount_cents: number }
    | undefined;
  if (!row) return { ok: false, error: "not found" };
  if (row.status !== "queued" && row.status !== "processing") {
    return { ok: false, error: `cannot reject withdrawal in status: ${row.status}` };
  }
  const t = now();
  // refund the user's balance, mark rejected — atomic
  const tx = db.transaction(() => {
    adjustBalance(row.address, row.amount_cents);
    db.prepare(
      "UPDATE withdrawals SET status = 'rejected', processed_at = ? WHERE id = ?",
    ).run(t, id);
  });
  tx();
  return {
    ok: true,
    refunded_cents: row.amount_cents,
    row: db.prepare("SELECT * FROM withdrawals WHERE id = ?").get(id),
  };
}
