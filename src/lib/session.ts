import type { Session } from "next-auth";
import { auth } from "@/lib/auth";

/**
 * Wraps `auth()` so a stale or malformed JWT cookie (JWTSessionError) is
 * treated as "no session" instead of crashing the request. Auth.js destroys
 * the offending cookie when it logs this error, so returning null here is
 * the correct recovery path.
 */
export async function getSession(): Promise<Session | null> {
  try {
    return await auth();
  } catch {
    return null;
  }
}