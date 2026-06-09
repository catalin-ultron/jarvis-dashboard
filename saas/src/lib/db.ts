// ── D1 Database Helpers ─────────────────────────────────────────
// Cloudflare Pages + D1 runtime bindings
// ────────────────────────────────────────────────────────────────

import { getRequestContext } from "@cloudflare/next-on-pages";

export interface Env {
  DB: D1Database;
}

export function getDB(): D1Database {
  const { env } = getRequestContext();
  if (!env.DB) {
    throw new Error("D1 database binding (DB) is not configured");
  }
  return env.DB;
}

export function createId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function generateApiKey(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function withAuth(
  req: Request,
  db: D1Database
): Promise<{ workspaceId: string; slug: string; name: string } | null> {
  const auth = req.headers.get("x-api-key");
  if (!auth) return null;
  const row = await db
    .prepare("SELECT id as workspaceId, slug, name FROM workspaces WHERE api_key = ?")
    .bind(auth)
    .first<{ workspaceId: string; slug: string; name: string }>();
  return row || null;
}
