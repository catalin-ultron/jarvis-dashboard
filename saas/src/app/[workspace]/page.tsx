"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ModelBreakdown {
  model: string;
  count: number;
  cost: number;
}

interface DailyActivity {
  day: string;
  sessions: number;
  messages: number;
  cost: number;
}

interface HourlyActivity {
  hour: number;
  sessions: number;
  messages: number;
  cost: number;
}

interface RecentSession {
  id: string;
  sessionName: string;
  model: string;
  totalTokens: number;
  totalCost: number;
  messageCount: number;
  toolCount: number;
  uploadedAt: string;
}

interface AnalyticsData {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  toolCount: number;
  favoriteModel: string;
  modelBreakdown: ModelBreakdown[];
  dailyActivity: DailyActivity[];
  hourlyActivity: HourlyActivity[];
  recentSessions: RecentSession[];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

function HeatmapCell({
  intensity,
  tooltip,
}: {
  intensity: number;
  tooltip: string;
}) {
  const opacity = Math.min(Math.max(intensity, 0.08), 1);
  return (
    <div
      title={tooltip}
      className="h-8 rounded-sm transition hover:ring-1 hover:ring-white/20"
      style={{
        backgroundColor: `rgba(0, 212, 255, ${opacity})`,
      }}
    />
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-panel border border-panel-border rounded-xl p-5 flex flex-col gap-1">
      <span className="text-muted text-xs uppercase tracking-[0.12em] font-semibold">
        {label}
      </span>
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
  );
}

export default function WorkspacePage() {
  const params = useParams<{ workspace: string }>();
  const workspace = params.workspace;

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const apiKey = typeof window !== "undefined" ? localStorage.getItem("jarvis_api_key") : null;
      if (!apiKey) {
        if (!cancelled) {
          setError("No API key found. Set jarvis_api_key in localStorage.");
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch("/api/analytics", {
          headers: { "x-api-key": apiKey },
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "Unknown error");
          throw new Error(`Analytics fetch failed: ${res.status} ${text}`);
        }
        const json: AnalyticsData = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unexpected error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxModelCost = useMemo(() => {
    if (!data?.modelBreakdown.length) return 1;
    return Math.max(...data.modelBreakdown.map((m) => m.cost));
  }, [data]);

  const heatmapMaxCost = useMemo(() => {
    if (!data?.dailyActivity.length) return 1;
    return Math.max(...data.dailyActivity.map((d) => d.cost));
  }, [data]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const apiKey = typeof window !== "undefined" ? localStorage.getItem("jarvis_api_key") : null;
    if (!apiKey) {
      setError("No API key found for upload.");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "x-api-key": apiKey },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        throw new Error(`Upload failed: ${res.status} ${text}`);
      }
      // Refresh analytics after upload
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            JARVIS Analytics
          </h1>
          <p className="text-muted mt-1">
            Workspace: <span className="text-foreground font-medium">{workspace}</span>
          </p>
        </div>
        <label className="inline-flex items-center gap-2 bg-accent text-black font-semibold rounded-lg px-4 py-2 cursor-pointer hover:brightness-110 transition select-none">
          {uploading ? "Uploading…" : "Upload Session"}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      </header>

      {error && (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-accent-red text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-muted text-sm">Loading analytics…</div>
      )}

      {!loading && data && (
        <>
          {/* Stats */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Sessions"
              value={formatNumber(data.totalSessions)}
            />
            <StatCard
              label="Total Cost"
              value={formatCurrency(data.totalCost)}
            />
            <StatCard
              label="Total Tokens"
              value={formatNumber(data.totalTokens)}
            />
            <StatCard label="Favorite Model" value={data.favoriteModel} />
          </section>

          {/* Model Usage */}
          <section className="bg-panel border border-panel-border rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-white">Model Usage</h2>
            {data.modelBreakdown.length === 0 ? (
              <p className="text-muted text-sm">No model data yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.modelBreakdown.map((m) => {
                  const pct = (m.cost / maxModelCost) * 100;
                  return (
                    <div key={m.model} className="flex items-center gap-3">
                      <span className="text-sm text-muted w-32 shrink-0 truncate">
                        {m.model}
                      </span>
                      <div className="flex-1 bg-white/5 rounded-sm overflow-hidden h-5">
                        <div
                          className="h-full rounded-sm bg-accent"
                          style={{
                            width: `${pct}%`,
                            opacity: 0.7 + (pct / 100) * 0.3,
                          }}
                        />
                      </div>
                      <span className="text-sm text-foreground w-24 text-right shrink-0">
                        {formatCurrency(m.cost)}
                      </span>
                      <span className="text-xs text-muted w-14 text-right shrink-0">
                        {formatNumber(m.count)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Activity Heatmap */}
          <section className="bg-panel border border-panel-border rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-white">
              Activity Heatmap <span className="text-muted text-sm font-normal">(Daily Cost)</span>
            </h2>
            {data.dailyActivity.length === 0 ? (
              <p className="text-muted text-sm">No daily activity yet.</p>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {data.dailyActivity.map((d) => (
                  <HeatmapCell
                    key={d.day}
                    intensity={heatmapMaxCost > 0 ? d.cost / heatmapMaxCost : 0}
                    tooltip={`${d.day} — ${formatCurrency(d.cost)} — ${d.sessions} sessions, ${d.messages} messages`}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Recent Sessions */}
          <section className="bg-panel border border-panel-border rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-white">Recent Sessions</h2>
            {data.recentSessions.length === 0 ? (
              <p className="text-muted text-sm">No sessions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-panel-border text-muted uppercase text-xs tracking-wider">
                      <th className="py-3 pr-4">Name</th>
                      <th className="py-3 pr-4">Model</th>
                      <th className="py-3 pr-4 text-right">Tokens</th>
                      <th className="py-3 pr-4 text-right">Cost</th>
                      <th className="py-3 pr-4 text-right">Messages</th>
                      <th className="py-3 pr-4 text-right">Tools</th>
                      <th className="py-3 pr-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-panel-border">
                    {data.recentSessions.map((s) => (
                      <tr key={s.id}>
                        <td className="py-3 pr-4">
                          <Link
                            href={`/${workspace}/sessions/${s.id}`}
                            className="text-accent hover:underline"
                          >
                            {s.sessionName || s.id}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-muted">{s.model}</td>
                        <td className="py-3 pr-4 text-right">
                          {formatNumber(s.totalTokens)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {formatCurrency(s.totalCost)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {formatNumber(s.messageCount)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {formatNumber(s.toolCount)}
                        </td>
                        <td className="py-3 pr-4 text-muted whitespace-nowrap">
                          {new Date(s.uploadedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
