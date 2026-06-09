"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Workspace = {
  id: string;
  slug: string;
  apiKey: string;
};

export default function LandingPage() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setWorkspace(null);
    if (!workspaceName.trim()) {
      setError("Workspace name is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create workspace");
      }
      const data: Workspace = await res.json();
      localStorage.setItem("jarvis_api_key", data.apiKey);
      setWorkspace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function copyKey() {
    if (!workspace) return;
    navigator.clipboard.writeText(workspace.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main
      className="min-h-full flex flex-col items-center px-6 py-20"
      style={{ background: "#0a0a1a", color: "#e0e6ed" }}
    >
      {/* Hero */}
      <section className="text-center max-w-2xl mb-16">
        <h1
          className="text-5xl font-bold tracking-tight mb-4"
          style={{ color: "#00d4ff", textShadow: "0 0 20px rgba(0,212,255,0.25)" }}
        >
          JARVIS Analytics
        </h1>
        <p className="text-xl" style={{ color: "#9fb0c7" }}>
          Claude Code session analytics for teams
        </p>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl w-full mb-16">
        {[
          { icon: "⬆️", title: "Upload JSONL", desc: "Import session logs in one click." },
          { icon: "💰", title: "Track costs", desc: "Monitor spend across models and days." },
          { icon: "📊", title: "Model breakdown", desc: "See which LLMs your team uses most." },
          { icon: "🔥", title: "Activity heatmap", desc: "Visualise daily and hourly usage." },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl p-6 transition-all duration-300 hover:shadow-lg"
            style={{
              background: "#0d1117",
              border: "1px solid rgba(0,212,255,0.12)",
            }}
          >
            <div className="text-2xl mb-2">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
            <p className="text-sm" style={{ color: "#9fb0c7" }}>
              {f.desc}
            </p>
          </div>
        ))}
      </section>

      {/* Workspace creation form */}
      <section className="w-full max-w-md">
        <div
          className="rounded-xl p-8"
          style={{
            background: "#0d1117",
            border: "1px solid rgba(0,212,255,0.12)",
          }}
        >
          <h2 className="text-2xl font-semibold mb-6 text-center">
            Create workspace
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Workspace name"
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-200"
              style={{
                background: "#0a0a1a",
                border: "1px solid rgba(0,212,255,0.12)",
                color: "#e0e6ed",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "rgba(0,212,255,0.35)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "rgba(0,212,255,0.12)")
              }
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
              style={{
                background: "#00d4ff",
                color: "#0a0a1a",
              }}
            >
              {loading ? "Creating…" : "Create workspace"}
            </button>
            {error && (
              <p className="text-sm text-center" style={{ color: "#ff6b6b" }}>
                {error}
              </p>
            )}
          </form>

          {workspace && (
            <div className="mt-6 pt-6" style={{ borderTop: "1px solid rgba(0,212,255,0.12)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">API key</span>
                <button
                  onClick={copyKey}
                  className="text-xs font-semibold px-3 py-1 rounded-md transition-colors"
                  style={{
                    background: "rgba(0,212,255,0.08)",
                    color: "#00d4ff",
                    border: "1px solid rgba(0,212,255,0.12)",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <code
                className="block text-xs rounded-lg px-3 py-2 break-all"
                style={{ background: "#0a0a1a" }}
              >
                {workspace.apiKey}
              </code>
              <p className="text-xs mt-3" style={{ color: "#9fb0c7" }}>
                Store this somewhere safe. You will need it for uploads.
              </p>
              <a
                href={`/${workspace.slug}`}
                className="mt-4 inline-block w-full text-center rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 hover:opacity-90"
                style={{
                  background: "rgba(0,212,255,0.1)",
                  color: "#00d4ff",
                  border: "1px solid rgba(0,212,255,0.25)",
                }}
              >
                Go to dashboard →
              </a>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
