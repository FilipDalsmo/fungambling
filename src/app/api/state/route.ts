import { NextRequest, NextResponse } from "next/server";
import { ensure } from "@/domain/errors";
import { atomic, database } from "@/server/db";
import { sessionUser } from "@/server/auth";
import { errorResponse } from "@/server/http";
import { maintain } from "@/server/maintenance";
import { snapshot } from "@/server/state";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const db = database();
    const user = sessionUser(db, req.cookies.get("fg_session")?.value);
    ensure(user, "Please sign in", 401);
    maintain(db);
    const data = atomic(db, () =>
      snapshot(db, user.id, req.nextUrl.searchParams.get("table") ?? undefined),
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
