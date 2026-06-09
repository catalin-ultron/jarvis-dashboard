# SaaS Gap Assessment: J.A.R.V.I.S. Dashboard

**Date:** 2026-01-27
**Repo:** catalin-ultron/jarvis-dashboard
**Scope:** What separates the current Obsidian-native dashboard from a shippable SaaS product

---

## Current State Summary

- **Runtime:** Obsidian Electron app (desktop only, macOS-focused)
- **Codebase:** 4,694 lines of vanilla JS loaded dynamically via `new Function()` inside DataviewJS blocks
- **Data:** Local filesystem reads (`~/.claude/projects/*.jsonl`)
- **AI/Voice:** Spawns `claude` CLI and `whisper-cli` as local child processes
- **Config:** Static JSON file on disk, single-user
- **Build:** No package.json, no bundler, no CI/CD

---

## The 7 Gaps

### 1. RUNTIME & PLATFORM

| Current | SaaS Requirement |
|---|---|
| Obsidian plugin / Electron | Standalone web app + optional desktop wrapper |
| `new Function()` module loader | Proper ES modules / bundler (Vite, Webpack) |
| DataviewJS container | React/Vue/Svelte with real component tree |
| File-based CSS injection | Tailwind / styled-components / CSS modules |
| No build step | Full Node.js project with build pipeline |

**Effort:** Full frontend rebuild. Token system and widget JSON schema are reusable.

### 2. BACKEND INFRASTRUCTURE (Does Not Exist)

- API server (REST/GraphQL)
- Database (PostgreSQL/Mongo for user data, session history, configs)
- Authentication (OAuth, SSO, session management)
- Authorization (RBAC, workspace isolation, team permissions)
- Real-time layer (WebSockets or SSE — currently polls every 3s via `setInterval`)
- File storage (S3/R2 for transcripts, voice recordings)
- Job queue for async processing

**Effort:** 3-6 months for a solid backend.

### 3. DATA PIPELINE (Hard Dependency Problem)

| Current | SaaS Requirement |
|---|---|
| Reads `~/.claude/projects/*.jsonl` locally | Anthropic API integration or Claude Code sync agent |
| `child_process.spawn("claude", ...)` | Cannot spawn CLI from browser — needs API proxy or server-side worker |
| `child_process.spawn("whisper-cli", ...)` | Cloud transcription API (OpenAI Whisper, Deepgram, AssemblyAI) |
| Direct filesystem access | Secure data ingestion pipeline with user consent |

**Critical blocker:** The voice command widget spawns Claude Code CLI as a child process. This cannot work in a browser and is the hardest dependency to solve.

### 4. MULTI-TENANCY & USER MODEL

- User accounts and workspaces
- Per-user configuration (currently one global `config.json`)
- Team/organization support
- Billing/subscription tiers
- Usage quotas and limits

### 5. SECURITY & COMPLIANCE

- Data encryption at rest and in transit
- SOC 2 / GDPR for transcript data (contains potentially sensitive code/conversations)
- API key management
- Rate limiting and abuse prevention
- Audit logging

### 6. DEPLOYMENT & OPERATIONS

- CI/CD pipeline
- Monitoring, alerting, error tracking (Sentry)
- Database migrations
- Multi-region deployment if needed

### 7. PRODUCT & GTM

- Clear pricing model
- Onboarding flow
- Documentation site
- Support infrastructure
- Changelog and feature communication

---

## What Is Salvageable

The UI widget designs and config-driven layout system are well-architected:

1. **Layout JSON format** — row/column grouping with widget registry is solid for a SaaS config model
2. **Theme token system** — 15 semantic colors transfer cleanly to CSS variables / Tailwind theme
3. **Responsive grid** — ResizeObserver-based adaptive columns
4. **Animated components** — arc reactor, focus timer, heatmap can be ported to React/Vue

---

## Honest Assessment

This dashboard is functionally impressive as a **personal productivity tool** — real-time session monitoring, offline voice transcription, TTS, cost analytics. But it is architected as an **Obsidian-native, single-user, local-filesystem companion to Claude Code**.

Turning this into a SaaS is **not an incremental migration. It is a rebuild.**

The only parts that transfer cleanly are the widget designs and the layout JSON schema.

---

## Recommended Path Forward

Before committing to a full rebuild, validate demand with a narrower offering:

**Option A — Team Analytics Dashboard:**
- Build a simple Next.js + Supabase app
- Read from Anthropic API (if available) or require a desktop sync agent
- Aggregate session/cost data across a team
- Charge per seat, $10-20/month

**Option B — Voice Command as Standalone Tool:**
- Desktop app (Tauri or Electron) with cloud backend
- Pipe voice → cloud Whisper → Anthropic API → TTS
- Compete with Raycast/Cursor voice features

**Option C — Open-source + Managed Hosting:**
- Keep it Obsidian-native
- Add a cloud sync layer (subscribe to push usage data)
- Charge for hosted analytics and team features

---

## Files Analyzed

- `README.md` — Full documentation and feature list
- `Jarvis Dashboard.md` — DataviewJS entry point and module loader
- `src/config/config.json` — Theme, layout, widget configuration
- `src/services/session-parser.js` — Claude Code JSONL parser, subagent detection
- `src/services/stats-engine.js` — 30-day analytics with caching
- `src/widgets/jarvis-voice-command.js` — Arc reactor UI, Claude CLI spawning, TTS

---

**Bottom line:** ~6-9 months to a v1 SaaS with a team of 2-3 engineers. The personal tool proves the UX; the SaaS needs everything else built from scratch.
