// Cost calculation using Claude Code pricing (per million tokens)
// Mirrored from jarvis-dashboard config: opus $15/$75, sonnet $3/$15, haiku $0.80/$4

import { CLAUDE_PRICING, getModelFamily, ModelFamily } from "./parser";

export { CLAUDE_PRICING, getModelFamily };
export type { ModelFamily };

export function estimateCost(
  model: string | undefined,
  inputTokens: number | undefined,
  outputTokens: number | undefined
): { cost: number; tokens: number } {
  const family = getModelFamily(model);
  const rates = CLAUDE_PRICING[family] || CLAUDE_PRICING.sonnet;
  const inT = inputTokens || 0;
  const outT = outputTokens || 0;
  const cost = (inT * rates.input + outT * rates.output) / 1e6;
  return { cost: Number(cost.toFixed(6)), tokens: inT + outT };
}
