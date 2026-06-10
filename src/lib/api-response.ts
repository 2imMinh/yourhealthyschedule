// src/lib/api-response.ts
// Centralizes the JSON envelope and error->status mapping so route handlers
// stay thin: they just `return handle(async () => { ... })`. Thrown errors are
// converted to the { error: { code, message } } shape from src/types.

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { UnauthorizedError } from "@/server/auth/current-user";
import type { ApiError } from "@/types";

/** Domain error route handlers can throw to control the HTTP response. */
export class ApiException extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiException";
  }
}

export const notFound = (msg = "Not found") =>
  new ApiException(404, "NOT_FOUND", msg);
export const forbidden = (msg = "Forbidden") =>
  new ApiException(403, "FORBIDDEN", msg);
export const badRequest = (msg: string, details?: unknown) =>
  new ApiException(400, "BAD_REQUEST", msg, details);
export const rationed = (msg: string) =>
  new ApiException(429, "RATIONED", msg);
export const premiumRequired = (msg = "Premium plan required") =>
  new ApiException(402, "PREMIUM_REQUIRED", msg);

/** Success envelope. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiError = { error: { code, message, ...(details ? { details } : {}) } };
  return NextResponse.json(body, { status });
}

/**
 * Wraps an async handler, mapping known errors to consistent responses.
 * Usage:
 *   export const GET = () => handle(async () => { ... return ok(data); });
 */
export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return errorResponse(401, "UNAUTHORIZED", err.message);
    }
    if (err instanceof ZodError) {
      return errorResponse(422, "VALIDATION_ERROR", "Invalid request", err.flatten());
    }
    if (err instanceof ApiException) {
      return errorResponse(err.status, err.code, err.message, err.details);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation -> 409 Conflict
      if (err.code === "P2025") return errorResponse(404, "NOT_FOUND", "Record not found");
      if (err.code === "P2002") return errorResponse(409, "CONFLICT", "Resource already exists");
      // Log the real Prisma code/meta server-side (visible in Vercel logs) but
      // return a clean, generic message — never leak internals to the client.
      console.error("[api] prisma error:", err.code, err.message, err.meta);
      return errorResponse(400, "DB_ERROR", "Database request failed");
    }
    // Prisma initialization / connection failures (can't reach DB, bad URL, etc.)
    if (
      err instanceof Prisma.PrismaClientInitializationError ||
      err instanceof Prisma.PrismaClientRustPanicError
    ) {
      console.error("[api] prisma init/connection error:", err);
      return errorResponse(503, "DB_UNAVAILABLE", "Cannot reach the database");
    }

    // Unknown: log server-side, return opaque 500 (never leak internals).
    console.error("[api] unhandled error:", err);
    return errorResponse(500, "INTERNAL_ERROR", "Something went wrong");
  }
}
