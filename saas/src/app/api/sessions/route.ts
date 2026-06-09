import { NextRequest, NextResponse } from "next/server";
import { getDB, D1Database } from "@/lib/db";

function getApiKey(req: NextRequest): string | null {
  return req.headers.get("x-api-key");
}

async function resolveWorkspace(db: D1Database, apiKey: string) {
  return db
    .prepare("SELECT id FROM workspaces WHERE api_key = ?")
    .bind(apiKey)
    .first<{ id: string }>();
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = getApiKey(req);
    if (!apiKey) {
      return NextResponse.json({ error: "Missing x-api-key header" }, { status: 401 });
    }

    const db = getDB();
    const workspace = await resolveWorkspace(db, apiKey);
    if (!workspace) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(Number(searchParams.get("offset") || "0"), 0);

    const rows = await db
      .prepare(
        `SELECT id, session_name, model, total_tokens, total_cost,
                message_count, tool_count, uploaded_at
         FROM sessions WHERE workspace_id = ?
         ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`
      )
      .bind(workspace.id, limit, offset)
      .all<{
        id: string;
        session_name: string;
        model: string | null;
        total_tokens: number;
        total_cost: number;
        message_count: number;
        tool_count: number;
        uploaded_at: string;
      }>();

    return NextResponse.json({
      sessions: (rows.results || []).map((s) => ({
        id: s.id,
        sessionName: s.session_name,
        model: s.model || "unknown",
        totalTokens: s.total_tokens,
        totalCost: s.total_cost,
        messageCount: s.message_count,
        toolCount: s.tool_count,
        uploadedAt: s.uploaded_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
