import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

function getApiKey(req: NextRequest): string | null {
  return req.headers.get("x-api-key");
}

async function resolveWorkspace(db: D1Database, apiKey: string) {
  return db
    .prepare("SELECT id FROM workspaces WHERE api_key = ?")
    .bind(apiKey)
    .first<{ id: string }>();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Verify session belongs to workspace
    const session = await db
      .prepare("SELECT 1 FROM sessions WHERE id = ? AND workspace_id = ?")
      .bind(id, workspace.id)
      .first();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || "200"), 500);
    const offset = Math.max(Number(searchParams.get("offset") || "0"), 0);

    const rows = await db
      .prepare(
        `SELECT id, role, model, tokens_input, tokens_output, cost,
                timestamp, tool_name, tool_input, content
         FROM messages
         WHERE session_id = ?
         ORDER BY timestamp ASC, id ASC
         LIMIT ? OFFSET ?`
      )
      .bind(id, limit, offset)
      .all<{
        id: string;
        role: string;
        model: string | null;
        tokens_input: number;
        tokens_output: number;
        cost: number;
        timestamp: string;
        tool_name: string | null;
        tool_input: string | null;
        content: string | null;
      }>();

    return NextResponse.json({
      messages: (rows.results || []).map((m) => ({
        id: m.id,
        role: m.role,
        model: m.model || undefined,
        tokensInput: m.tokens_input,
        tokensOutput: m.tokens_output,
        cost: m.cost,
        timestamp: m.timestamp,
        toolName: m.tool_name || undefined,
        toolInput: m.tool_input || undefined,
        content: m.content || undefined,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
