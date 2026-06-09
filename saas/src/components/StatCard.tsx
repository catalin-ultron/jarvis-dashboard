type StatColor = "accent" | "green" | "purple" | "orange" | "gold" | "red";

const colorMap: Record<StatColor, string> = {
  accent: "#00d4ff",
  green: "#44c98f",
  purple: "#7c6bff",
  orange: "#ff6b35",
  gold: "#f6d365",
  red: "#e74c3c",
};

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  color?: StatColor;
}

export default function StatCard({
  label,
  value,
  subtext,
  color = "accent",
}: StatCardProps) {
  const barColor = colorMap[color];

  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: "#0d1117",
        border: "1px solid rgba(0, 212, 255, 0.12)",
        borderTop: `3px solid ${barColor}`,
      }}
    >
      <p
        className="text-xs font-medium uppercase tracking-widest"
        style={{ color: "#6b7b8d", letterSpacing: "0.08em" }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-2xl font-bold tracking-tight"
        style={{ color: "#e0e6ed" }}
      >
        {value}
      </p>
      {subtext && (
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "#6b7b8d" }}>
          {subtext}
        </p>
      )}
    </div>
  );
}
