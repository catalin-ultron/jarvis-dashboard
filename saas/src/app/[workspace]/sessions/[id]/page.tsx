"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

/* ─────────── types ─────────── */

interface SessionMessage {
  id: string;
  role: "user" | "assistant" | string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  timestamp: string;
  toolName: string | null;
  toolInput: string | null;
  content: string;
}

interface SessionDetail {
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

interface SessionDetailResponse {
  session: SessionDetail;
  messages: SessionMessage[];
}

/* ─────────── helpers ─────────── */

function formatCurrency(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hrs}h ${remainingMins}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

const CONTENT_COLLAPSE_THRESHOLD = 500;

/* ─────────── message card ─────────── */

function MessageCard({ msg }: { msg: SessionMessage }) {
  const [expanded, setExpanded] = useState(false);
  const isUser = msg.role === "user";
  const contentLong = msg.content.length > CONTENT_COLLAPSE_THRESHOLD;

  const displayedContent =
    contentLong && !expanded
      ? msg.content.slice(0, CONTENT_COLLAPSE_THRESHOLD) + "…"
      : msg.content;

  return (
    <div
      className="rounded-xl border p-5 transition-colors"
      style={{
        backgroundColor: "#0d1117",
        borderColor: isUser
          ? "rgba(0, 212, 255, 0.15)"
          : "rgba(0, 212, 255, 0.12)",
        borderLeftWidth: 3,
        borderLeftColor: isUser ? "#00d4ff" : "rgba(0,212,255,0.2)",
      }}
    >
      {/* header row */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: isUser
                ? "rgba(0, 212, 255, 0.12)"
                : "rgba(124, 107, 255, 0.12)",
              color: isUser ? "#00d4ff" : "#7c6bff",
            }}
          >
            {msg.role}
          </span>
          <span className="text-xs" style={{ color: "#6b7b8d" }}>
            {msg.model}
          </span>
        </div>
        <span className="text-xs tabular-nums" style={{ color: "#6b7b8d" }}>
          {formatDate(msg.timestamp)}
        </span>
      </div>

      {/* token / cost meta */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mb-4 text-xs tabular-nums" style={{ color: "#6b7b8d" }}>
        <span>
          In: <span style={{ color: "#e0e6ed" }}>{formatNumber(msg.tokensInput)}</span>
        </span>
        <span>
          Out: <span style={{ color: "#e0e6ed" }}>{formatNumber(msg.tokensOutput)}</span>
        </span>
        <span>
          Cost: <span style={{ color: "#e0e6ed" }}>{formatCurrency(msg.cost)}</span>
        </span>
      </div>

      {/* tool call */}
      {msg.toolName && (
        <div
          className="rounded-lg border p-3 mb-4 text-sm"
          style={{
            backgroundColor: "rgba(255, 107, 53, 0.06)",
            borderColor: "rgba(255, 107, 53, 0.15)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#ff6b35" }}>
              Tool call
            </span>
            <span className="text-xs font-medium" style={{ color: "#ff6b35" }}>
              {msg.toolName}
            </span>
          </div>
          {msg.toolInput && (
            <pre
              className="mt-1 text-xs whitespace-pre-wrap break-all"
              style={{ color: "#e0e6ed", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
            >
              {msg.toolInput}
            </pre>
          )}
        </div>
      )}

      {/* content */}
      <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#e0e6ed" }}>
        {displayedContent || (
          <span className="italic" style={{ color: "#6b7b8d" }}>
            No content
          </span>
        )}
      </div>

      {contentLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs font-medium transition-colors hover:underline"
          style={{ color: "#00d4ff" }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/* ─────────── page ─────────── */

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace, id } = React.use(params);

  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSession() {
      const apiKey = localStorage.getItem("jarvis_api_key") || "";
      if (!apiKey) {
        setError("No API key found. Please log in.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/sessions/${id}`, {
          headers: { "x-api-key": apiKey },
        });
        if (!res.ok) {
          if (res.status === 401) throw new Error("Unauthorized — invalid API key");
          if (res.status === 404) throw new Error("Session not found.");
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as SessionDetailResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load session");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSession();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0a1a" }}>
        <div style={{ color: "#6b7b8d" }}>Loading session…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a1a", color: "#e0e6ed" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "#0a0a1a", borderColor: "rgba(0,212,255,0.12)" }}
      >
        <nav className="flex items-center gap-2 text-sm">
          <Link href={`/${workspace}`} className="transition-colors hover:underline" style={{ color: "#00d4ff" }}>
            {workspace}
          </Link>
          <span style={{ color: "#6b7b8d" }}>/</span>
          <span className="font-medium" style={{ color: "#e0e6ed" }}>
            Sessions
          </span>
          <span style={{ color: "#6b7b8d" }}>/</span>
          <span className="truncate max-w-[12rem] sm:max-w-[18rem] md:max-w-[24rem]" style={{ color: "#6b7b8d" }}>
            {data?.session.sessionName ?? id}
          </span>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div
            className="rounded-lg border p-4 text-sm text-red-400"
            style={{ backgroundColor: "#0d1117", borderColor: "rgba(231,76,60,0.3)" }}
          >
            {error}
          </div>
        )}

        {/* Session metadata panel */}
        {data && (
          <section
            className="rounded-xl border p-6"
            style={{ backgroundColor: "#0d1117", borderColor: "rgba(0,212,255,0.12)" }}
          >
            <h1 className="text-xl font-semibold tracking-tight mb-1" style={{ color: "#e0e6ed" }}>
              {data.session.sessionName}
            </h1>
            <p className="text-sm mb-5" style={{ color: "#6b7b8d" }}>
              {data.session.fileName}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <MetaItem label="Model" value={data.session.model} />
              <MetaItem label="Total cost" value={formatCurrency(data.session.totalCost)} />
              <MetaItem label="Total tokens" value={formatNumber(data.session.totalTokens)} />
              <MetaItem label="Messages" value={formatNumber(data.session.messageCount)} />
              <MetaItem label="Tool calls" value={formatNumber(data.session.toolCount)} />
              <MetaItem label="Duration" value={formatDuration(data.session.durationSeconds)} />
              <MetaItem label="Start" value={formatDate(data.session.startTime)} colSpan />
              <MetaItem label="End" value={formatDate(data.session.endTime)} colSpan />
            </div>
          </section>
        )}

        {/* Messages timeline */}
        {data && data.messages.length > 0 && (
          <section>
            <h2
              className="text-sm font-semibold uppercase tracking-widest mb-4"
              style={{ color: "#6b7b8d", letterSpacing: "0.08em" }}
            >
              Messages
            </h2>
            <div className="space-y-4">
              {data.messages.map((msg) => (
                <MessageCard key={msg.id} msg={msg} />
              ))}
            </div>
          </section>
        )}

        {data && data.messages.length === 0 && !error && (
          <div
            className="rounded-xl border p-12 text-center text-sm"
            style={{ backgroundColor: "#0d1117", borderColor: "rgba(0,212,255,0.12)", color: "#6b7b8d" }}
          >
            No messages in this session.
          </div>
        )}
      </main>
    </div>
  );
}

/* ─────────── meta item ─────────── */

function MetaItem({
  label,
  value,
  colSpan,
}: {
  label: string;
  value: string;
  colSpan?: boolean;
}) {
  return (
    <div className={colSpan ? "col-span-2" : undefined}>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#6b7b8d", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div className="text-sm font-medium" style={{ color: "#e0e6ed" }}>
        {value}
      </div>
    </div>
  );
}
