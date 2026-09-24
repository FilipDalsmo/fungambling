import { NextRequest } from "next/server";
import { DomainError, ensure } from "@/domain/errors";
import { atomic, database } from "@/server/db";
import { sessionUser } from "@/server/auth";
import { errorResponse } from "@/server/http";
import { maintain } from "@/server/maintenance";
import { snapshot } from "@/server/state";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const connections = new Map<string, number>();
export async function GET(req: NextRequest) {
  try {
    const db = database(),
      token = req.cookies.get("fg_session")?.value;
    const user = sessionUser(db, token);
    ensure(user, "Please sign in", 401);
    ensure(
      (connections.get(user.id) ?? 0) < 5,
      "Too many live connections",
      429,
    );
    connections.set(user.id, (connections.get(user.id) ?? 0) + 1);
    let cleanup = () => {};
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        const encoder = new TextEncoder();
        const timer = setInterval(tick, 1000);
        const expiry = setTimeout(close, 5 * 60_000);
        function close() {
          if (closed) return;
          closed = true;
          clearInterval(timer);
          clearTimeout(expiry);
          connections.set(
            user!.id,
            Math.max(0, (connections.get(user!.id) ?? 1) - 1),
          );
          req.signal.removeEventListener("abort", close);
          try {
            controller.close();
          } catch {
            /* already canceled */
          }
        }
        function tick() {
          if (closed) return;
          try {
            if (!sessionUser(db, token)) {
              controller.enqueue(
                encoder.encode("event: signedout\ndata: {}\n\n"),
              );
              close();
              return;
            }
            maintain(db);
            const state = atomic(db, () =>
              snapshot(
                db,
                user!.id,
                req.nextUrl.searchParams.get("table") ?? undefined,
              ),
            );
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(state)}\n\n`),
            );
          } catch (error) {
            if (error instanceof DomainError && error.status === 404) {
              controller.enqueue(
                encoder.encode("event: unavailable\ndata: {}\n\n"),
              );
            }
            close();
          }
        }
        cleanup = close;
        req.signal.addEventListener("abort", close);
        tick();
      },
      cancel() {
        cleanup();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
