import { formatCurrency } from "@/lib/format";

type Stat = {
  label: string;
  value: number;
  tone?: "neutral" | "good" | "warning" | "danger";
};

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <section className="stat-strip" aria-label="本月摘要">
      {stats.map((stat) => (
        <div className={`stat-cell tone-${stat.tone ?? "neutral"}`} key={stat.label}>
          <span>{stat.label}</span>
          <strong>{formatCurrency(stat.value)}</strong>
        </div>
      ))}
    </section>
  );
}
