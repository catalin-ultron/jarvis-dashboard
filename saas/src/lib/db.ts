// ── In-Memory D1-compatible Database ───────────────────────────
// Drop-in replacement for Cloudflare D1 for Vercel deployment.
// Implements the exact D1 API surface used by the app routes.
// ────────────────────────────────────────────────────────────────

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(stmts: D1PreparedStatement[]): Promise<D1Result[]>;
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

export interface D1Result {
  success: boolean;
  results?: unknown[];
  meta?: unknown;
}

// ── table schemas ──────────────────────────────────────────────

interface Workspace {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  created_at: string;
}

interface SessionRow {
  id: string;
  workspace_id: string;
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
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  model: string | null;
  tokens_input: number;
  tokens_output: number;
  cost: number;
  timestamp: string;
  tool_name: string | null;
  tool_input: string | null;
  content: string | null;
}

interface Tables {
  workspaces: Workspace[];
  sessions: SessionRow[];
  messages: MessageRow[];
}

// ── singleton store ────────────────────────────────────────────

const STORE: Tables = {
  workspaces: [
    {
      id: "ws-demo-001",
      name: "Demo Workspace",
      slug: "demo",
      api_key: "demo-api-key-jarvis-saas-demo",
      created_at: "2024-01-01T00:00:00.000Z",
    },
  ],
  sessions: [],
  messages: [],
};

// ── sql normalizer ─────────────────────────────────────────────

function normalize(sql: string): string {
  return sql
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*\(\s*/g, " (")
    .replace(/\s*\)\s*/g, ") ")
    .trim()
    .toLowerCase();
}

// ── query handlers (exact SQL patterns used in app) ───────────

type Handler = (tables: Tables, values: any[]) => any[];

const _n = normalize;

const HANDLERS: Record<string, Handler> = {
  // --- workspaces ---

  [_n("SELECT id as workspaceId, slug, name FROM workspaces WHERE api_key = ?")]:
    (t, v) => t.workspaces
      .filter((w) => w.api_key === v[0])
      .map((w) => ({ workspaceId: w.id, slug: w.slug, name: w.name })),

  [_n("SELECT id, name, slug, api_key, created_at FROM workspaces ORDER BY created_at DESC")]:
    (t) => [...t.workspaces].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),

  [_n("INSERT INTO workspaces (id, name, slug, api_key, created_at) VALUES (?, ?, ?, ?, ?)")]:
    (t, v) => {
      t.workspaces.push({ id: v[0], name: v[1], slug: v[2], api_key: v[3], created_at: v[4] });
      return [];
    },

  [_n("SELECT id FROM workspaces WHERE api_key = ?")]:
    (t, v) => t.workspaces.filter((w) => w.api_key === v[0]).map((w) => ({ id: w.id })),

  // --- sessions ---

  [_n(`INSERT INTO sessions (id, workspace_id, session_name, file_name, uploaded_at,
          total_cost, total_tokens, message_count, tool_count,
          duration_seconds, model_breakdown, start_time, end_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)]:
    (t, v) => {
      t.sessions.push({
        id: v[0],
        workspace_id: v[1],
        session_name: v[2],
        file_name: v[3],
        uploaded_at: v[4],
        total_cost: Number(v[5]),
        total_tokens: Number(v[6]),
        message_count: Number(v[7]),
        tool_count: Number(v[8]),
        duration_seconds: Number(v[9]),
        model_breakdown: v[10],
        start_time: v[11],
        end_time: v[12],
        model: null,
      });
      return [];
    },

  [_n(`SELECT id, session_name, model, total_tokens, total_cost,
                message_count, tool_count, uploaded_at
         FROM sessions WHERE workspace_id = ?
         ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`)]:
    (t, v) =>
      [...t.sessions]
        .filter((s) => s.workspace_id === v[0])
        .sort((a, b) =>
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
        )
        .slice(Number(v[2]), Number(v[2]) + Number(v[1]))
        .map((s) => ({
          id: s.id,
          session_name: s.session_name,
          model: s.model,
          total_tokens: s.total_tokens,
          total_cost: s.total_cost,
          message_count: s.message_count,
          tool_count: s.tool_count,
          uploaded_at: s.uploaded_at,
        })),

  [_n(`SELECT COUNT(*) as totalSessions,
                COALESCE(SUM(total_tokens), 0) as totalTokens,
                COALESCE(SUM(total_cost), 0) as totalCost,
                COALESCE(SUM(message_count), 0) as totalMessages,
                COALESCE(SUM(tool_count), 0) as totalToolCount
         FROM sessions WHERE workspace_id = ?`)]:
    (t, v) => {
      const filtered = t.sessions.filter((s) => s.workspace_id === v[0]);
      return [
        {
          totalSessions: filtered.length,
          totalTokens: filtered.reduce((sum, s) => sum + s.total_tokens, 0),
          totalCost: Number(
            filtered.reduce((sum, s) => sum + s.total_cost, 0).toFixed(6)
          ),
          totalMessages: filtered.reduce((sum, s) => sum + s.message_count, 0),
          totalToolCount: filtered.reduce((sum, s) => sum + s.tool_count, 0),
        },
      ];
    },

  [_n(`SELECT COALESCE(model, 'unknown') as model, COUNT(*) as count,
                COALESCE(SUM(total_cost), 0) as cost
         FROM sessions WHERE workspace_id = ? GROUP BY model`)]:
    (t, v) => {
      const groups: Record<string, { count: number; cost: number }> = {};
      for (const s of t.sessions.filter((s) => s.workspace_id === v[0])) {
        const m = s.model || "unknown";
        groups[m] = groups[m] || { count: 0, cost: 0 };
        groups[m].count++;
        groups[m].cost += s.total_cost;
      }
      return Object.entries(groups).map(([model, g]) => ({
        model,
        count: g.count,
        cost: Number(g.cost.toFixed(6)),
      }));
    },

  [_n(`SELECT DATE(start_time) as day,
                COUNT(*) as sessions,
                COALESCE(SUM(message_count), 0) as messages,
                COALESCE(SUM(total_cost), 0) as cost
         FROM sessions WHERE workspace_id = ? GROUP BY day ORDER BY day`)]:
    (t, v) => {
      const groups: Record<string, { sessions: number; messages: number; cost: number }> = {};
      for (const s of t.sessions.filter((s) => s.workspace_id === v[0])) {
        const day = s.start_time.slice(0, 10);
        groups[day] = groups[day] || { sessions: 0, messages: 0, cost: 0 };
        groups[day].sessions++;
        groups[day].messages += s.message_count;
        groups[day].cost += s.total_cost;
      }
      return Object.entries(groups)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([day, g]) => ({
          day,
          sessions: g.sessions,
          messages: g.messages,
          cost: Number(g.cost.toFixed(6)),
        }));
    },

  [_n(`SELECT id, session_name, file_name, uploaded_at, total_cost,
                total_tokens, message_count, tool_count, duration_seconds,
                model, model_breakdown, start_time, end_time
         FROM sessions
         WHERE id = ? AND workspace_id = ?`)]:
    (t, v) =>
      t.sessions
        .filter((s) => s.id === v[0] && s.workspace_id === v[1])
        .map((s) => ({
          id: s.id,
          session_name: s.session_name,
          file_name: s.file_name,
          uploaded_at: s.uploaded_at,
          total_cost: s.total_cost,
          total_tokens: s.total_tokens,
          message_count: s.message_count,
          tool_count: s.tool_count,
          duration_seconds: s.duration_seconds,
          model: s.model,
          model_breakdown: s.model_breakdown,
          start_time: s.start_time,
          end_time: s.end_time,
        })),

  [_n("SELECT 1 FROM sessions WHERE id = ? AND workspace_id = ?")]:
    (t, v) =>
      t.sessions
        .filter((s) => s.id === v[0] && s.workspace_id === v[1])
        .map(() => ({ 1: 1 })),

  // --- messages ---

  [_n(`INSERT INTO messages (id, session_id, role, model, tokens_input, tokens_output,
          cost, timestamp, tool_name, tool_input, content)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)]:
    (t, v) => {
      t.messages.push({
        id: v[0],
        session_id: v[1],
        role: v[2],
        model: v[3],
        tokens_input: Number(v[4]),
        tokens_output: Number(v[5]),
        cost: Number(v[6]),
        timestamp: v[7],
        tool_name: v[8],
        tool_input: v[9],
        content: v[10],
      });
      return [];
    },

  [_n(`SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hour,
                COUNT(*) as count
         FROM messages
         WHERE session_id IN (SELECT id FROM sessions WHERE workspace_id = ?)
         GROUP BY hour ORDER BY hour`)]:
    (t, v) => {
      const wsId = v[0];
      const sIds = new Set(
        t.sessions.filter((s) => s.workspace_id === wsId).map((s) => s.id)
      );
      const groups: Record<number, number> = {};
      for (const m of t.messages.filter((m) => sIds.has(m.session_id))) {
        const hour = new Date(m.timestamp).getUTCHours();
        groups[hour] = (groups[hour] || 0) + 1;
      }
      return Object.entries(groups)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([hour, count]) => ({ hour: Number(hour), count }));
    },

  [_n(`SELECT id, role, model, tokens_input, tokens_output, cost,
                timestamp, tool_name, tool_input, content
         FROM messages
         WHERE session_id = ?
         ORDER BY timestamp ASC, id ASC`)]:
    (t, v) =>
      [...t.messages]
        .filter((m) => m.session_id === v[0])
        .sort((a, b) => {
          const cmp = a.timestamp.localeCompare(b.timestamp);
          return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
        })
        .map((m) => ({
          id: m.id,
          role: m.role,
          model: m.model,
          tokens_input: m.tokens_input,
          tokens_output: m.tokens_output,
          cost: m.cost,
          timestamp: m.timestamp,
          tool_name: m.tool_name,
          tool_input: m.tool_input,
          content: m.content,
        })),

  [_n(`SELECT id, role, model, tokens_input, tokens_output, cost,
                timestamp, tool_name, tool_input, content
         FROM messages
         WHERE session_id = ?
         ORDER BY timestamp ASC, id ASC
         LIMIT ? OFFSET ?`)]:
    (t, v) =>
      [...t.messages]
        .filter((m) => m.session_id === v[0])
        .sort((a, b) => {
          const cmp = a.timestamp.localeCompare(b.timestamp);
          return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
        })
        .slice(Number(v[2]), Number(v[2]) + Number(v[1]))
        .map((m) => ({
          id: m.id,
          role: m.role,
          model: m.model,
          tokens_input: m.tokens_input,
          tokens_output: m.tokens_output,
          cost: m.cost,
          timestamp: m.timestamp,
          tool_name: m.tool_name,
          tool_input: m.tool_input,
          content: m.content,
        })),
};

// ── statement implementation ───────────────────────────────────

class InMemoryStatement implements D1PreparedStatement {
  private sql: string;
  private values: any[] = [];

  constructor(sql: string) {
    this.sql = sql;
  }

  bind(...values: any[]): D1PreparedStatement {
    const stmt = new InMemoryStatement(this.sql);
    stmt.values = values;
    return stmt;
  }

  async run(): Promise<D1Result> {
    this.dispatch();
    return { success: true };
  }

  async first<T>(): Promise<T | null> {
    return (this.dispatch()[0] as T) || null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.dispatch() as T[] };
  }

  private dispatch(): any[] {
    const key = normalize(this.sql);
    const handler = HANDLERS[key];
    if (!handler) {
      throw new Error(`InMemoryDB: unhandled SQL query: ${this.sql}`);
    }
    return handler(STORE, this.values);
  }
}

// ── database implementation ────────────────────────────────────

class InMemoryDB implements D1Database {
  prepare(sql: string): D1PreparedStatement {
    return new InMemoryStatement(sql);
  }

  async batch(stmts: D1PreparedStatement[]): Promise<D1Result[]> {
    return Promise.all(stmts.map((s) => s.run()));
  }
}

// ── singleton instance ─────────────────────────────────────────

const INSTANCE = new InMemoryDB();

export function getDB(): D1Database {
  return INSTANCE;
}

// ── utilities (unchanged API) ──────────────────────────────────

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
