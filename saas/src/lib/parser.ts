// ── Claude Code JSONL Parser ───────────────────────────────────
// Parses Claude Code transcript files into structured session data.
// Each line is a JSON object. Key fields:
//   type: "assistant" | "user" | "progress" | "system" | "streaming"
//   timestamp: ISO string
//   slug: project name
//   message: { model, stop_reason, usage: { input_tokens, output_tokens }, content[] }
// ────────────────────────────────────────────────────────────────

export type ModelFamily = "opus" | "sonnet" | "haiku";

export interface ClaudeRecord {
  type: string;
  timestamp?: string;
  slug?: string;
  message?: {
    model?: string;
    stop_reason?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      input?: unknown;
    }>;
  };
  subtype?: string;
  duration_seconds?: number;
  data?: { type?: string; agentId?: string; parentToolUseID?: string; message?: string };
}

export interface ParsedMessage {
  role: string;
  model?: string;
  content?: string;
  toolName?: string;
  toolInput?: string;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  timestamp?: string;
}

export interface ParsedSession {
  sessionName: string;
  fileName: string;
  messages: ParsedMessage[];
  model?: string;
  modelFamily: ModelFamily;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  messageCount: number;
  toolCount: number;
  durationSeconds: number;
  startTime?: string;
  endTime?: string;
  hourlyActivity: Record<number, number>;
  dailyCost: Record<string, number>;
}

export const CLAUDE_PRICING: Record<ModelFamily, { input: number; output: number }> = {
  opus:   { input: 15,    output: 75 },
  sonnet: { input: 3,     output: 15 },
  haiku:  { input: 0.80,  output: 4 },
};

export function getModelFamily(model?: string): ModelFamily {
  if (!model) return "sonnet";
  const m = model.toLowerCase();
  if (m.includes("opus")) return "opus";
  if (m.includes("haiku")) return "haiku";
  return "sonnet";
}

export function calculateCost(inputTokens: number, outputTokens: number, model: string): number {
  const family = getModelFamily(model);
  const rates = CLAUDE_PRICING[family] || CLAUDE_PRICING.sonnet;
  const cost = (inputTokens * rates.input + outputTokens * rates.output) / 1e6;
  return Number(cost.toFixed(6));
}

export function formatTokens(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

export function formatCost(n: number): string {
  if (n >= 1000) return "$" + (n / 1000).toFixed(1) + "K";
  if (n < 0.01) return "<$0.01";
  return "$" + n.toFixed(2);
}

export function parseClaudeJSONL(text: string, fileName: string): ParsedSession {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const messages: ParsedMessage[] = [];
  let model: string | undefined;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  let toolCount = 0;
  let messageCount = 0;
  let startTime: string | undefined;
  let endTime: string | undefined;
  let durationSeconds = 0;
  const hourlyActivity: Record<number, number> = {};
  const dailyCost: Record<string, number> = {};
  let sessionName = fileName.replace(/\.jsonl$/i, "");

  for (const line of lines) {
    if (!line.startsWith("{")) continue;

    try {
      const rec = JSON.parse(line) as ClaudeRecord;

      if (rec.timestamp) {
        if (!startTime) startTime = rec.timestamp;
        endTime = rec.timestamp;
      }

      // Session name from slug
      if (rec.slug && !sessionName) {
        sessionName = rec.slug;
      }

      // System turn duration
      if (rec.type === "system" && rec.subtype === "turn_duration" && rec.duration_seconds) {
        durationSeconds += rec.duration_seconds;
        continue;
      }

      // Assistant message
      if (rec.type === "assistant" && rec.message) {
        if (!model && rec.message.model) {
          model = rec.message.model;
        }
        const inputTokens = rec.message.usage?.input_tokens || 0;
        const outputTokens = rec.message.usage?.output_tokens || 0;
        const cost = calculateCost(inputTokens, outputTokens, rec.message.model || model || "");

        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;
        totalCost += cost;
        messageCount++;

        // Extract tool uses from content
        let toolName: string | undefined;
        let toolInput: string | undefined;
        if (rec.message.content) {
          for (const block of rec.message.content) {
            if (block.type === "tool_use") {
              toolCount++;
              if (!toolName) {
                toolName = block.name;
                toolInput = block.input ? JSON.stringify(block.input).slice(0, 200) : undefined;
              }
            }
          }
        }

        // Hourly activity
        if (rec.timestamp) {
          const h = new Date(rec.timestamp).getHours();
          hourlyActivity[h] = (hourlyActivity[h] || 0) + 1;
          const day = rec.timestamp.slice(0, 10);
          dailyCost[day] = (dailyCost[day] || 0) + cost;
        }

        messages.push({
          role: "assistant",
          model: rec.message.model || model,
          content: rec.message.content
            ?.filter((b) => b.type === "text" && b.text)
            .map((b) => b.text)
            .join("\n") || undefined,
          toolName,
          toolInput,
          tokensInput: inputTokens,
          tokensOutput: outputTokens,
          cost,
          timestamp: rec.timestamp,
        });
      }

      // User message
      if (rec.type === "user" && rec.message?.content) {
        messageCount++;
        const text = rec.message.content
          .filter((b: {type: string, text?: string}) => b.type === "text")
          .map((b: {type: string, text?: string}) => b.text)
          .join("\n");

        if (rec.timestamp) {
          const h = new Date(rec.timestamp).getHours();
          hourlyActivity[h] = (hourlyActivity[h] || 0) + 1;
        }

        messages.push({
          role: "user",
          content: text || undefined,
          tokensInput: 0,
          tokensOutput: 0,
          cost: 0,
          timestamp: rec.timestamp,
        });
      }
    } catch {
      // skip malformed lines
    }
  }

  return {
    sessionName,
    fileName,
    messages,
    model,
    modelFamily: getModelFamily(model),
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCost: Number(totalCost.toFixed(6)),
    messageCount,
    toolCount,
    durationSeconds: Math.round(durationSeconds),
    startTime,
    endTime,
    hourlyActivity,
    dailyCost,
  };
}
