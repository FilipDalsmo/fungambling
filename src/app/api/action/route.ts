import { NextRequest, NextResponse } from "next/server";
import { ensure } from "@/domain/errors";
import { database } from "@/server/db";
import { limit, sessionUser } from "@/server/auth";
import { command } from "@/server/commands";
import { checkOrigin, errorResponse, readBody } from "@/server/http";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    const db = database();
    const user = sessionUser(db, req.cookies.get("fg_session")?.value);
    ensure(user, "Please sign in", 401);
    limit(db, `actions:${user.id}`, 120, 60_000);
    const result = command(db, user.id, await readBody(req));
    return NextResponse.json(
      { ok: true, result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
