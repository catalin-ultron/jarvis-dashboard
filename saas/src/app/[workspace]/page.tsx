"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import ModelChart from "@/components/ModelChart";
import Heatmap from "@/components/Heatmap";

/* ─────────── inline types matching actual API ─────────── */

interface ModelBreakdownItem {
  model: string; // e.g. "opus", "sonnet", "haiku"
  count: number;
  cost: number;
}

interface DailyActivityItem {
  day: string; // "2024-01-15"
  sessions: number;
  messages: number;
  cost: number;
}

interface HourlyActivityItem {
  hour: number; // 0–23
  sessions: number;
  messages: number;
  cost: number;
}

interface RecentSessionItem {
  id: string;
  sessionName: string;
  model: string;
  totalTokens: number;
  totalCost: number;
  messageCount: number;
  toolCount: number;
  uploadedAt: string;
}

interface AnalyticsResponse {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  toolCount: number;
  favoriteModel: string;
  modelBreakdown: ModelBreakdownItem[];
  dailyActivity: DailyActivityItem[];
  hourlyActivity: HourlyActivityItem[];
  recentSessions: RecentSessionItem[];
}

/* ─────────── helpers ─────────── */

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function modelPercent(model: string, breakdown: ModelBreakdownItem[]): string {
  const total = breakdown.reduce((s, m) => s + m.count, 0);
  const found = breakdown.find((m) => m.model === model);
  if (!found || total === 0) return "";
  return `${model} (${Math.round((found.count / total) * 100)}%)`;
}

function modelColor(model: string): string {
  if (model === "opus") return "#f6d365";
  if (model === "haiku") return "#44c98f";
  return "#00d4ff";
}

/* ─────────── page ─────────── */

export default function WorkspaceDashboardPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = React.use(params);
  const apiKeyRef = useRef<string>("");

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    const apiKey = localStorage.getItem("jarvis_api_key") || "";
    apiKeyRef.current = apiKey;
    if (!apiKey) {
      setError("No API key found. Please log in.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/analytics", {
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized — invalid API key");
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as AnalyticsResponse;
      setAnalytics(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("jarvis_api_key");
    window.location.href = "/";
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const apiKey = apiKeyRef.current || localStorage.getItem("jarvis_api_key") || "";
      if (!apiKey) {
        setUploadMsg("No API key found.");
        return;
      }

      setUploading(true);
      setUploadMsg("Uploading…");

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "x-api-key": apiKey },
          body: formData,
        });

        if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
        setUploadMsg("Upload successful!");
        await fetchAnalytics();
      } catch (err) {
        setUploadMsg(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        // clear the file input so the same file can be selected again
        e.target.value = "";
      }
    },
    [fetchAnalytics]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0a1a" }}>
        <div className="text-[#6b7b8d]">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a1a", color: "#e0e6ed" }}>
      {/* Header bar */}
      <header
        className="sticky top-0 z-40 border-b px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "#0a0a1a", borderColor: "rgba(0,212,255,0.12)" }}
      >
        <h1 className="text-lg font-semibold tracking-tight capitalize">{workspace}</h1>
        <div className="flex items-center gap-3">
          <label
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity"
            style={{
              backgroundColor: "#00d4ff",
              color: "#0a0a1a",
              opacity: uploading ? 0.6 : 1,
            }}
          >
            <span>Upload session</span>
            <input
              type="file"
              accept=".jsonl"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
          <button
            onClick={handleLogout}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
            style={{ borderColor: "rgba(0,212,255,0.2)", color: "#e0e6ed" }}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        {error && (
          <div className="rounded-lg border p-4 text-sm text-red-400" style={{ backgroundColor: "#0d1117", borderColor: "rgba(231,76,60,0.3)" }}>
            {error}
          </div>
        )}

        {uploadMsg && !error && (
          <div
            className="rounded-lg border p-3 text-sm"
            style={{
              backgroundColor: uploadMsg.startsWith("Upload successful") ? "rgba(68,201,143,0.08)" : "#0d1117",
              borderColor: uploadMsg.startsWith("Upload successful") ? "rgba(68,201,143,0.2)" : "rgba(0,212,255,0.12)",
              color: uploadMsg.startsWith("Upload successful") ? "#44c98f" : "#e0e6ed",
            }}
          >
            {uploadMsg}
          </div>
        )}

        {/* ─── Stats row ─── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total sessions"
            value={analytics ? formatNumber(analytics.totalSessions) : "—"}
            color="accent"
          />
          <StatCard
            label="Total cost"
            value={analytics ? formatCurrency(analytics.totalCost) : "—"}
            color="green"
          />
          <StatCard
            label="Total tokens"
            value={analytics ? formatNumber(analytics.totalTokens) : "—"}
            color="purple"
          />
          <StatCard
            label="Favorite model"
            value={
              analytics
                ? modelPercent(analytics.favoriteModel, analytics.modelBreakdown)
                : "—"
            }
            color="orange"
          />
        </section>

        {/* ─── Model breakdown ─── */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "#6b7b8d", letterSpacing: "0.08em" }}>
            Model breakdown
          </h2>
          <div
            className="rounded-xl border p-5"
            style={{ backgroundColor: "#0d1117", borderColor: "rgba(0,212,255,0.12)" }}
          >
            {analytics && analytics.modelBreakdown.length > 0 ? (
              <ModelChart
                data={analytics.modelBreakdown.map((m) => ({
                  name: m.model.toUpperCase(),
                  count: m.count,
                  cost: m.cost,
                  color: modelColor(m.model),
                }))}
              />
            ) : (
              <p className="text-sm" style={{ color: "#6b7b8d" }}>
                No model data yet.
              </p>
            )}
          </div>
        </section>

        {/* ─── Activity heatmap ─── */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "#6b7b8d", letterSpacing: "0.08em" }}>
            Activity heatmap
          </h2>
          <div
            className="rounded-xl border p-5"
            style={{ backgroundColor: "#0d1117", borderColor: "rgba(0,212,255,0.12)" }}
          >
            {analytics && analytics.dailyActivity.length > 0 ? (
              <Heatmap
                data={analytics.dailyActivity.map((d) => ({
                  date: d.day,
                  cost: d.cost,
                }))}
                weeks={12}
              />
            ) : (
              <p className="text-sm" style={{ color: "#6b7b8d" }}>
                No activity data yet.
              </p>
            )}
          </div>
        </section>

        {/* ─── Recent sessions table ─── */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "#6b7b8d", letterSpacing: "0.08em" }}>
            Recent sessions
          </h2>
          <div
            className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: "#0d1117", borderColor: "rgba(0,212,255,0.12)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.12)" }}>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "#6b7b8d" }}>
                      Name
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "#6b7b8d" }}>
                      Model
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "#6b7b8d" }}>
                      Tokens
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "#6b7b8d" }}>
                      Cost
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "#6b7b8d" }}>
                      Messages
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "#6b7b8d" }}>
                      Tools
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "#6b7b8d" }}>
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics && analytics.recentSessions.length > 0 ? (
                    analytics.recentSessions.map((s) => (
                      <tr
                        key={s.id}
                        className="transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: "1px solid rgba(0,212,255,0.06)" }}
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/${workspace}/sessions/${s.id}`}
                            className="hover:underline"
                            style={{ color: "#00d4ff" }}
                          >
                            {s.sessionName}
                          </Link>
                        </td>
                        <td className="px-5 py-3" style={{ color: "#e0e6ed" }}>
                          {s.model}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums" style={{ color: "#e0e6ed" }}>
                          {formatNumber(s.totalTokens)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums" style={{ color: "#e0e6ed" }}>
                          {formatCurrency(s.totalCost)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums" style={{ color: "#e0e6ed" }}>
                          {formatNumber(s.messageCount)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums" style={{ color: "#e0e6ed" }}>
                          {formatNumber(s.toolCount)}
                        </td>
                        <td className="px-5 py-3" style={{ color: "#e0e6ed" }}>
                          {new Date(s.uploadedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center" style={{ color: "#6b7b8d" }}>
                        No sessions yet. Upload your first session to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
