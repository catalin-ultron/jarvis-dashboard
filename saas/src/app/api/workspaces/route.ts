import { NextRequest, NextResponse } from "next/server";
import { getDB, createId, generateApiKey, generateSlug } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { name?: string; email?: string };
    const name = body?.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const db = getDB();
    const id = createId();
    const slug = generateSlug(name);
    const apiKey = generateApiKey();
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO workspaces (id, name, slug, api_key, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, name, slug, apiKey, now)
      .run();

    return NextResponse.json({
      id,
      name,
      slug,
      apiKey,
      createdAt: now,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = getDB();
    const rows = await db
      .prepare(
        "SELECT id, name, slug, api_key, created_at FROM workspaces ORDER BY created_at DESC"
      )
      .all<{
        id: string;
        name: string;
        slug: string;
        api_key: string;
        created_at: string;
      }>();

    return NextResponse.json({
      workspaces: (rows.results || []).map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        apiKey: w.api_key,
        createdAt: w.created_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
