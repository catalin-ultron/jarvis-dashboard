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

    const wsId = workspace.id;

    const agg = await db
      .prepare(
        `SELECT COUNT(*) as totalSessions,
                COALESCE(SUM(total_tokens), 0) as totalTokens,
                COALESCE(SUM(total_cost), 0) as totalCost,
                COALESCE(SUM(message_count), 0) as totalMessages,
                COALESCE(SUM(tool_count), 0) as totalToolCount
         FROM sessions WHERE workspace_id = ?`
      )
      .bind(wsId)
      .first<{
        totalSessions: number;
        totalTokens: number;
        totalCost: number;
        totalMessages: number;
        totalToolCount: number;
      }>();

    // model breakdown from session model_breakdown JSON
    const modelRows = await db
      .prepare(
        `SELECT COALESCE(model, 'unknown') as model, COUNT(*) as count,
                COALESCE(SUM(total_cost), 0) as cost
         FROM sessions WHERE workspace_id = ? GROUP BY model`
      )
      .bind(wsId)
      .all<{ model: string; count: number; cost: number }>();

    const modelList = modelRows.results || [];
    const favoriteModel =
      modelList.length > 0
        ? modelList.reduce((a, b) => (a.count > b.count ? a : b)).model
        : "";

    const totalSessions = Number(agg?.totalSessions ?? 0);

    const dailyRows = await db
      .prepare(
        `SELECT DATE(start_time) as day,
                COUNT(*) as sessions,
                COALESCE(SUM(message_count), 0) as messages,
                COALESCE(SUM(total_cost), 0) as cost
         FROM sessions WHERE workspace_id = ? GROUP BY day ORDER BY day`
      )
      .bind(wsId)
      .all<{ day: string; sessions: number; messages: number; cost: number }>();

    const hourlyRows = await db
      .prepare(
        `SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hour,
                COUNT(*) as count
         FROM messages
         WHERE session_id IN (SELECT id FROM sessions WHERE workspace_id = ?)
         GROUP BY hour ORDER BY hour`
      )
      .bind(wsId)
      .all<{ hour: number; count: number }>();

    const recentRows = await db
      .prepare(
        `SELECT id, session_name, model, total_tokens, total_cost,
                message_count, tool_count, uploaded_at
         FROM sessions WHERE workspace_id = ?
         ORDER BY uploaded_at DESC LIMIT 20`
      )
      .bind(wsId)
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
      totalSessions,
      totalMessages: Number(agg?.totalMessages ?? 0),
      totalTokens: Number(agg?.totalTokens ?? 0),
      totalCost: Number(agg?.totalCost ?? 0),
      toolCount: Number(agg?.totalToolCount ?? 0),
      favoriteModel,
      modelBreakdown: modelList.map((m) => ({
        model: m.model || "unknown",
        count: Number(m.count),
        cost: Number(m.cost),
      })),
      dailyActivity: (dailyRows.results || []).map((r) => ({
        day: r.day,
        sessions: Number(r.sessions),
        messages: Number(r.messages),
        cost: Number(r.cost),
      })),
      hourlyActivity: (hourlyRows.results || []).map((r) => ({
        hour: r.hour,
        count: r.count,
      })),
      recentSessions: (recentRows.results || []).map((r) => ({
        id: r.id,
        sessionName: r.session_name,
        model: r.model || "unknown",
        totalTokens: r.total_tokens,
        totalCost: r.total_cost,
        messageCount: r.message_count,
        toolCount: r.tool_count,
        uploadedAt: r.uploaded_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
