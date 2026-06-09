import { NextRequest, NextResponse } from "next/server";
import { getDB, createId, D1Database } from "@/lib/db";
import { parseClaudeJSONL } from "@/lib/parser";

function getApiKey(req: NextRequest): string | null {
  return req.headers.get("x-api-key");
}

async function resolveWorkspace(db: D1Database, apiKey: string) {
  return db
    .prepare("SELECT id, name, slug FROM workspaces WHERE api_key = ?")
    .bind(apiKey)
    .first<{ id: string; name: string; slug: string }>();
}

export async function POST(req: NextRequest) {
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

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }

    const fileName = (file as File).name || "session.jsonl";
    if (!fileName.endsWith(".jsonl")) {
      return NextResponse.json({ error: "Only .jsonl files accepted" }, { status: 400 });
    }

    const text = await file.text();
    const sessionData = parseClaudeJSONL(text, fileName);

    const sessionId = createId();
    const now = new Date().toISOString();

    // Insert session
    await db
      .prepare(
        `INSERT INTO sessions
         (id, workspace_id, session_name, file_name, uploaded_at,
          total_cost, total_tokens, message_count, tool_count,
          duration_seconds, model_breakdown, start_time, end_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        sessionId,
        workspace.id,
        sessionData.sessionName,
        sessionData.fileName,
        now,
        sessionData.totalCost,
        sessionData.totalTokens,
        sessionData.messageCount,
        sessionData.toolCount,
        sessionData.durationSeconds,
        JSON.stringify({ [sessionData.modelFamily]: sessionData.totalCost }),
        sessionData.startTime || now,
        sessionData.endTime || now
      )
      .run();

    // Insert messages
    if (sessionData.messages.length > 0) {
      const stmt = db.prepare(
        `INSERT INTO messages
         (id, session_id, role, model, tokens_input, tokens_output,
          cost, timestamp, tool_name, tool_input, content)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const batch = sessionData.messages.map((msg) =>
        stmt.bind(
          createId(),
          sessionId,
          msg.role,
          msg.model || null,
          msg.tokensInput,
          msg.tokensOutput,
          msg.cost,
          msg.timestamp || now,
          msg.toolName || null,
          msg.toolInput || null,
          msg.content || null
        )
      );

      await db.batch(batch);
    }

    return NextResponse.json({
      sessionId,
      cost: sessionData.totalCost,
      tokens: sessionData.totalTokens,
      messages: sessionData.messageCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
