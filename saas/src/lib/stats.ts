// ── Stats Engine – aggregate parsed Claude Code sessions ────────
// Ported from jarvis-dashboard/src/services/stats-engine.js
// ────────────────────────────────────────────────────────────────

import { ParsedSession, getModelFamily, formatCost, formatTokens } from "./parser";

export interface ModelBreakdown {
  model: string;
  count: number;
  pct: number;
  cost: number;
}

export interface DailyActivity {
  messages: number;
  sessions: number;
  cost: number;
}

export interface AggregatedStats {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  totalCostFormatted: string;
  totalTokensFormatted: string;
  toolCount: number;
  favoriteModel: string;
  favoriteModelPct: number;
  modelBreakdown: ModelBreakdown[];
  dailyActivity: Record<string, DailyActivity>;
  hourlyActivity: number[];
}

export function aggregateSessions(sessions: ParsedSession[]): AggregatedStats {
  let totalMessages = 0;
  let totalTokens = 0;
  let totalCost = 0;
  let toolCount = 0;
  const modelCounts: Record<string, number> = {};
  const modelCosts: Record<string, number> = {};
  const dailyActivity: Record<string, DailyActivity> = {};
  const hourlyActivity = new Array(24).fill(0);

  for (const s of sessions) {
    totalMessages += s.messageCount;
    totalTokens += s.totalTokens;
    totalCost += s.totalCost;
    toolCount += s.toolCount;

    const fam = s.modelFamily;
    modelCounts[fam] = (modelCounts[fam] || 0) + 1;
    modelCosts[fam] = (modelCosts[fam] || 0) + s.totalCost;

    if (s.startTime) {
      const dateKey = s.startTime.slice(0, 10);
      if (!dailyActivity[dateKey]) {
        dailyActivity[dateKey] = { messages: 0, sessions: 0, cost: 0 };
      }
      dailyActivity[dateKey].messages += s.messageCount;
      dailyActivity[dateKey].sessions += 1;
      dailyActivity[dateKey].cost += s.totalCost;
    }

    for (const [hStr, count] of Object.entries(s.hourlyActivity)) {
      const idx = Number(hStr);
      if (idx >= 0 && idx < 24) {
        hourlyActivity[idx] += count;
      }
    }
  }

  const totalSessions = sessions.length;

  // favorite model
  let favoriteModel = "sonnet";
  let maxCount = 0;
  for (const [m, c] of Object.entries(modelCounts)) {
    if (c > maxCount) {
      maxCount = c;
      favoriteModel = m;
    }
  }
  const favoriteModelPct =
    totalSessions > 0 ? Math.round((maxCount / totalSessions) * 100) : 0;

  // model breakdown
  const modelBreakdown: ModelBreakdown[] = Object.entries(modelCounts)
    .map(([model, count]) => ({
      model,
      count,
      pct: totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0,
      cost: modelCosts[model] || 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalSessions,
    totalMessages,
    totalTokens,
    totalCost,
    totalCostFormatted: formatCost(totalCost),
    totalTokensFormatted: formatTokens(totalTokens),
    toolCount,
    favoriteModel,
    favoriteModelPct,
    modelBreakdown,
    dailyActivity,
    hourlyActivity,
  };
}
