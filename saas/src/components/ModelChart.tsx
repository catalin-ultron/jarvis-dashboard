"use client";

interface ModelRow {
  name: string;
  count: number;
  cost: number;
  color: string;
}

interface ModelChartProps {
  data: ModelRow[];
}

export default function ModelChart({ data }: ModelChartProps) {
  const maxCost = Math.max(...data.map((d) => d.cost), 1);
  const totalCost = data.reduce((sum, d) => sum + d.cost, 0);

  return (
    <div className="flex flex-col gap-3">
      {data.map((row) => {
        const widthPercent = (row.cost / maxCost) * 100;
        const sharePercent = totalCost > 0 ? (row.cost / totalCost) * 100 : 0;

        return (
          <div key={row.name} className="flex items-center gap-3">
            <span
              className="w-20 shrink-0 text-right text-xs font-medium uppercase"
              style={{ color: "#e0e6ed" }}
            >
              {row.name}
            </span>
            <div className="flex-1 overflow-hidden rounded-md" style={{ backgroundColor: "rgba(0, 212, 255, 0.06)" }}>
              <div
                className="flex h-6 items-center rounded-md px-2 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  width: `${Math.max(widthPercent, 4)}%`,
                  backgroundColor: row.color,
                  color: "#0a0a1a",
                }}
              >
                {widthPercent > 12 && `${sharePercent.toFixed(0)}%`}
              </div>
            </div>
            <span
              className="w-16 shrink-0 text-right text-xs tabular-nums"
              style={{ color: "#6b7b8d" }}
            >
              {row.count.toLocaleString()}
            </span>
            <span
              className="w-20 shrink-0 text-right text-xs tabular-nums font-medium"
              style={{ color: "#e0e6ed" }}
            >
              ${row.cost.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
