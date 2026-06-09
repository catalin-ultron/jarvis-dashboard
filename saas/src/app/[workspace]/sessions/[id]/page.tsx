"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

/* ─────────── inline types matching actual API ─────────── */

interface ApiSession {
  id: string;
  sessionName: string;
  fileName: string;
  uploadedAt: string;
  totalCost: number;
  totalTokens: number;
  messageCount: number;
  toolCount: number;
  durationSeconds: number;
  model: string;
  startTime: string;
  endTime: string;
}

interface ApiMessage {
  id: string;
  role: "user" | "assistant";
  model: string;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  timestamp: string;
  toolName: string;
  toolInput: string;
  content: string;
}

/* ─────────── helpers ─────────── */

function formatCost(cost: number | null): string {
  if (cost == null) return "—";
  return `$${cost.toFixed(6)}`;
}

function formatTokens(tokens: number | null): string {
  if (tokens == null) return "—";
  return tokens.toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

/* ─────────── page ─────────── */

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace, id } = React.use(params);

  const [session, setSession] = useState<ApiSession | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toggleExpand = (messageId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  useEffect(() => {
    async function load() {
      try {
        const apiKey = localStorage.getItem("jarvis_api_key") || "";
        const res = await fetch(`/api/sessions/${id}`, {
          headers: { "x-api-key": apiKey },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSession(data.session as ApiSession);
        setMessages(data.messages as ApiMessage[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load session");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0a1a" }}>
        <div className="text-[#6b7b8d]">Loading session…</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0a1a" }}>
        <div className="text-red-400">{error || "Session not found"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a1a", color: "#e0e6ed" }}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6" style={{ color: "#6b7b8d" }}>
          <Link href={`/${workspace}`} className="hover:text-[#00d4ff] transition-colors">
            {workspace}
          </Link>
          <span>/</span>
          <Link href={`/${workspace}/sessions`} className="hover:text-[#00d4ff] transition-colors">
            Sessions
          </Link>
          <span>/</span>
          <span className="text-[#e0e6ed] truncate max-w-xs">{session.sessionName}</span>
        </nav>

        {/* Back button */}
        <Link
          href={`/${workspace}`}
          className="mb-6 inline-flex items-center gap-2 text-sm hover:text-[#00d4ff] transition-colors"
          style={{ color: "#6b7b8d" }}
        >
          ← Back to dashboard
        </Link>

        {/* Header */}
        <div
          className="rounded-xl border p-6 mb-8"
          style={{ backgroundColor: "#0d1117", borderColor: "rgba(0,212,255,0.12)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold" style={{ color: "#e0e6ed" }}>
              {session.sessionName}
            </h1>
            <span
              className="text-xs px-2 py-1 rounded-full border"
              style={{ borderColor: "rgba(0,212,255,0.12)", color: "#6b7b8d" }}
            >
              {session.model}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: "#6b7b8d" }}>Cost</div>
              <div className="text-sm font-medium mt-1">{formatCost(session.totalCost)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: "#6b7b8d" }}>Tokens</div>
              <div className="text-sm font-medium mt-1">{formatTokens(session.totalTokens)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: "#6b7b8d" }}>Messages</div>
              <div className="text-sm font-medium mt-1">{session.messageCount ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: "#6b7b8d" }}>Tools</div>
              <div className="text-sm font-medium mt-1">{session.toolCount ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: "#6b7b8d" }}>Duration</div>
              <div className="text-sm font-medium mt-1">{formatDuration(session.durationSeconds)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: "#6b7b8d" }}>Created</div>
              <div className="text-sm font-medium mt-1">{formatTimestamp(session.uploadedAt)}</div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {messages.length === 0 ? (
          <div
            className="rounded-xl border p-12 text-center"
            style={{ backgroundColor: "#0d1117", borderColor: "rgba(0,212,255,0.12)", color: "#6b7b8d" }}
          >
            <p className="text-lg mb-2">No messages</p>
            <p className="text-sm">This session doesn&apos;t have any messages yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const isExpanded = expanded.has(msg.id);
              const preview = msg.content || "";
              const hasTool = !!msg.toolName;

              return (
                <div
                  key={msg.id}
                  className="rounded-xl border p-5"
                  style={{ backgroundColor: "#0d1117", borderColor: "rgba(0,212,255,0.12)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: isUser ? "rgba(107,123,141,0.15)" : "rgba(0,212,255,0.12)",
                          color: isUser ? "#6b7b8d" : "#00d4ff",
                        }}
                      >
                        {isUser ? "User" : "Assistant"}
                      </span>
                      {!isUser && msg.model && (
                        <span className="text-xs" style={{ color: "#6b7b8d" }}>
                          {msg.model}
                        </span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: "#6b7b8d" }}>
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>

                  {(msg.tokensInput != null || msg.tokensOutput != null) && (
                    <div className="flex items-center gap-4 mb-3 text-xs" style={{ color: "#6b7b8d" }}>
                      {msg.tokensInput != null && <span>In: {formatTokens(msg.tokensInput)}</span>}
                      {msg.tokensOutput != null && <span>Out: {formatTokens(msg.tokensOutput)}</span>}
                      {msg.cost != null && <span>Cost: {formatCost(msg.cost)}</span>}
                    </div>
                  )}

                  {hasTool && (
                    <div
                      className="mb-3 rounded-lg p-3 text-xs"
                      style={{ backgroundColor: "rgba(0,212,255,0.06)", color: "#e0e6ed" }}
                    >
                      <div className="font-semibold mb-1" style={{ color: "#00d4ff" }}>
                        Tool: {msg.toolName}
                      </div>
                      {msg.toolInput && (
                        <pre className="overflow-x-auto font-mono text-[11px]" style={{ color: "#6b7b8d" }}>
                          {msg.toolInput}
                        </pre>
                      )}
                    </div>
                  )}

                  {preview && (
                    <div className="text-sm leading-relaxed" style={{ color: "#e0e6ed" }}>
                      {isExpanded ? preview : preview.slice(0, 200) + (preview.length > 200 ? "…" : "")}
                      {preview.length > 200 && (
                        <button
                          onClick={() => toggleExpand(msg.id)}
                          className="ml-2 text-xs hover:underline"
                          style={{ color: "#00d4ff" }}
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
