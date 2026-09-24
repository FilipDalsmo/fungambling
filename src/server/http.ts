import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError, ensure } from "@/domain/errors";
export const origin = () => process.env.APP_ORIGIN ?? "http://localhost:3000";
export function checkOrigin(req: Request) {
  ensure(
    req.headers.get("origin") === origin(),
    "Request origin is not allowed",
    403,
  );
  ensure(
    req.headers.get("content-type")?.split(";")[0] === "application/json",
    "JSON body required",
    415,
  );
}
export async function readBody(req: Request) {
  ensure(
    Number(req.headers.get("content-length") ?? 0) <= 8192,
    "Request is too large",
    413,
  );
  const reader = req.body?.getReader();
  ensure(reader, "Request body is required");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new DomainError("Request is too large", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DomainError("Invalid JSON");
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof DomainError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  console.error("Request failed", error);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
export function clientKey(req: Request) {
  return process.env.TRUST_PROXY === "true"
    ? (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown")
    : "shared";
}
