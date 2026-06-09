# J.A.R.V.I.S. SaaS MVP Plan

## Goal
A minimal team dashboard for Claude Code session analytics. Users upload `.jsonl` session files, the app parses them, and shows cost breakdowns + model usage + activity heatmaps.

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Cloudflare Pages (`@cloudflare/next-on-pages`)
- D1 SQLite (users, workspaces, sessions, messages)
- KV (session cache, rate limiting)
- No external auth provider — simple API-key + workspace slug

## Data Model (D1)

### `users`
- id TEXT PRIMARY KEY
- email TEXT UNIQUE
- name TEXT
- created_at TEXT (ISO 8601)

### `workspaces`
- id TEXT PRIMARY KEY
- slug TEXT UNIQUE
- name TEXT
- owner_id TEXT → users.id
- api_key TEXT UNIQUE
- created_at TEXT

### `sessions`
- id TEXT PRIMARY KEY
- workspace_id TEXT → workspaces.id
- session_name TEXT
- file_name TEXT
- uploaded_at TEXT
- total_cost REAL
- total_tokens INTEGER
- model_breakdown TEXT (JSON)
- tool_count INTEGER
- duration_seconds INTEGER

### `messages`
- id TEXT PRIMARY KEY
- session_id TEXT → sessions.id
- role TEXT (user/assistant)
- model TEXT
- tokens_used INTEGER
- cost REAL
- timestamp TEXT
- tools_used TEXT (JSON)

## API Routes

- `POST /api/upload` — accept JSONL file, parse, store session + messages
- `GET /api/sessions` — list sessions for workspace
- `GET /api/sessions/[id]` — session detail with messages
- `GET /api/analytics` — aggregate stats (cost, tokens, model split, heatmap data)
- `POST /api/auth/setup` — create workspace + get API key

## UI Pages

- `/` — Landing (features + setup CTA)
- `/[workspace]` — Dashboard (cost cards, model pie chart, heatmap, session list)
- `/[workspace]/sessions/[id]` — Session detail (message timeline, tools, costs)

## Key Decisions
- No real auth flow — workspace slug + API key in header is MVP auth
- Parser ported from `src/services/session-parser.js` (vanilla JS → TypeScript)
- Heatmap uses 7×N grid (days × weeks) with color intensity by cost
- Charts are custom SVG (no Chart.js dependency bloat)

## Steps
1. [x] Scaffold Next.js 16 + Cloudflare adapter
2. [ ] Set up D1 schema
3. [ ] Build JSONL upload endpoint
4. [ ] Port session parser
5. [ ] Build dashboard UI with analytics
6. [ ] Add workspace auth (slug + API key)
7. [ ] Deploy to Cloudflare Pages
