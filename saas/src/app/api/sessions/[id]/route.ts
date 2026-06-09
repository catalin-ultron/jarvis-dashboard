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

    const session = await db
      .prepare(
        `SELECT id, session_name, file_name, uploaded_at, total_cost,
                total_tokens, message_count, tool_count, duration_seconds,
                model, model_breakdown, start_time, end_time
         FROM sessions
         WHERE id = ? AND workspace_id = ?`
      )
      .bind(id, workspace.id)
      .first<{
        id: string;
        session_name: string;
        file_name: string;
        uploaded_at: string;
        total_cost: number;
        total_tokens: number;
        message_count: number;
        tool_count: number;
        duration_seconds: number;
        model: string | null;
        model_breakdown: string | null;
        start_time: string;
        end_time: string;
      }>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = await db
      .prepare(
        `SELECT id, role, model, tokens_input, tokens_output, cost,
                timestamp, tool_name, tool_input, content
         FROM messages
         WHERE session_id = ?
         ORDER BY timestamp ASC, id ASC`
      )
      .bind(id)
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
      session: {
        id: session.id,
        sessionName: session.session_name,
        fileName: session.file_name,
        uploadedAt: session.uploaded_at,
        totalCost: session.total_cost,
        totalTokens: session.total_tokens,
        messageCount: session.message_count,
        toolCount: session.tool_count,
        durationSeconds: session.duration_seconds,
        model: session.model || "unknown",
        modelBreakdown: session.model_breakdown
          ? JSON.parse(session.model_breakdown)
          : {},
        startTime: session.start_time,
        endTime: session.end_time,
      },
      messages: (messages.results || []).map((m) => ({
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
