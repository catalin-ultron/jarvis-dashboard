"use client";

import { useState } from "react";

export interface HeatmapDay {
  date: string; // ISO 8601, e.g. "2024-01-15"
  cost: number; // in cents or dollars
}

interface HeatmapProps {
  data: HeatmapDay[];
  weeks?: number; // default 26 ≈ 6 months
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getIntensityClass(cost: number, max: number): string {
  if (max === 0) return "opacity-10";
  const ratio = cost / max;
  if (ratio <= 0.1) return "opacity-10";
  if (ratio <= 0.25) return "opacity-25";
  if (ratio <= 0.5) return "opacity-50";
  if (ratio <= 0.75) return "opacity-75";
  return "opacity-100";
}

export default function Heatmap({ data, weeks = 26 }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    date: string;
    cost: number;
  } | null>(null);

  // Build a map date -> cost
  const costMap = new Map<string, number>();
  data.forEach((d) => costMap.set(d.date, d.cost));

  // Determine date range: end on the most recent Saturday, start N weeks prior
  const today = new Date();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
  const startOfRange = new Date(endOfWeek);
  startOfRange.setDate(endOfWeek.getDate() - weeks * 7 + 1);

  // Build columns
  const columns: { date: string; cost: number }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: { date: string; cost: number }[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(startOfRange);
      d.setDate(startOfRange.getDate() + w * 7 + dow);
      const iso = d.toISOString().slice(0, 10);
      col.push({ date: iso, cost: costMap.get(iso) ?? 0 });
    }
    columns.push(col);
  }

  const maxCost = Math.max(...data.map((d) => d.cost), 1);

  const cellSize = 12;
  const gap = 3;

  return (
    <div className="relative">
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] pr-2 pt-5">
          {DAYS.map((day) => (
            <span
              key={day}
              className="flex items-center text-[9px] font-medium uppercase"
              style={{
                color: "#6b7b8d",
                height: `${cellSize}px`,
                lineHeight: `${cellSize}px`,
              }}
            >
              {day}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-[3px] overflow-x-auto">
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((cell, ri) => {
                const opacityClass = getIntensityClass(cell.cost, maxCost);
                return (
                  <div
                    key={ri}
                    className={`rounded-sm transition-opacity duration-150 hover:ring-1 ${opacityClass}`}
                    style={{
                      width: `${cellSize}px`,
                      height: `${cellSize}px`,
                      backgroundColor: "#00d4ff",
                    }}
                    onMouseEnter={(e) =>
                      setTooltip({
                        x: e.clientX,
                        y: e.clientY,
                        date: cell.date,
                        cost: cell.cost,
                      })
                    }
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 12,
            backgroundColor: "#0d1117",
            border: "1px solid rgba(0, 212, 255, 0.2)",
            color: "#e0e6ed",
          }}
        >
          <div className="font-medium">{tooltip.date}</div>
          <div style={{ color: "#00d4ff" }}>
            ${tooltip.cost.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      )}
    </div>
  );
}
