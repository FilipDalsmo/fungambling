import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database } from "@/server/db";
import { hashToken, limit, login, recover, register } from "@/server/auth";
import {
  checkOrigin,
  clientKey,
  errorResponse,
  origin,
  readBody,
} from "@/server/http";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    const db = database();
    const body = z
      .object({
        action: z.enum(["register", "login", "recover", "logout"]),
        username: z.string().max(100).optional(),
      })
      .passthrough()
      .parse(await readBody(req));
    if (body.action === "logout") {
      const token = req.cookies.get("fg_session")?.value;
      if (token)
        db.prepare("DELETE FROM sessions WHERE hash=?").run(hashToken(token));
      const res = NextResponse.json({ ok: true });
      res.cookies.delete("fg_session");
      return res;
    }
    limit(
      db,
      `auth-ip:${clientKey(req)}`,
      process.env.TRUST_PROXY === "true" ? 30 : 100,
      15 * 60_000,
    );
    limit(db, `auth-name:${body.username?.toLowerCase()}`, 10, 15 * 60_000);
    const result =
      body.action === "register"
        ? await register(db, body)
        : body.action === "recover"
          ? await recover(db, body)
          : await login(db, body);
    const res = NextResponse.json({
      ok: true,
      recovery: "recovery" in result ? result.recovery : undefined,
    });
    res.cookies.set("fg_session", result.token, {
      httpOnly: true,
      secure: origin().startsWith("https:"),
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 86400,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
