-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL
);

-- Workspaces (teams/organizations)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  owner_id TEXT REFERENCES users(id),
  api_key TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

-- Sessions (Claude Code JSONL sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  session_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  total_cost REAL DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  tool_count INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  model_breakdown TEXT, -- JSON string
  start_time TEXT,
  end_time TEXT
);

-- Messages (individual records within a session)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL, -- 'user', 'assistant', 'system', 'progress'
  model TEXT,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  timestamp TEXT,
  tool_name TEXT,
  tool_input TEXT,
  content TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
