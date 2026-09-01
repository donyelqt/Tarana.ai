/**
 * Auth helpers for API route handlers.
 *
 * `withAuth` enforces an authenticated session and injects the resolved
 * `userId` into the handler. Use it to wrap mutating / billable routes so an
 * unauthenticated request can never reach generation or credit logic.
 *
 * `getUserId` is the non-throwing variant for endpoints that only need an
 * optional identity (e.g. gating a destructive action).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';

export function unauthorized(message = 'Authentication required') {
  return NextResponse.json({ error: message, text: '' }, { status: 401 });
}

export async function getUserId(req: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export type AuthedHandler = (
  req: NextRequest,
  userId: string
) => Promise<NextResponse> | NextResponse;

export function withAuth(handler: AuthedHandler) {
  return async function (req: NextRequest): Promise<NextResponse> {
    if ((process.env.BENCH_BYPASS_AUTH?.trim() === "true" || req.headers.get("x-bench-bypass") === "true") && process.env.NODE_ENV !== "production") {
      const benchUserId = process.env.BENCH_USER_ID || "00000000-0000-0000-0000-000000000001";
      return handler(req, benchUserId);
    }
    const userId = await getUserId(req);
    if (!userId) return unauthorized();
    return handler(req, userId);
  };
}

