// Shared admin auth check for /api/casino/admin/* routes.
//
// Set CASINO_ADMIN_TOKEN in .env. The admin UI prompts for this token and
// sends it in the X-Admin-Token header on every request.
//
// If the env var is not set, the routes return 503 — this forces an explicit
// opt-in instead of silently allowing anonymous access in dev.

import { NextRequest, NextResponse } from "next/server";

export function checkAdmin(req: NextRequest): NextResponse | null {
  const expected = process.env.CASINO_ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "admin not configured: set CASINO_ADMIN_TOKEN in .env to enable admin routes",
      },
      { status: 503 },
    );
  }
  const provided = req.headers.get("x-admin-token");
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null; // ok
}
