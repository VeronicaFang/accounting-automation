import { formatCurrency } from "@/lib/format";

type Stat = {
  label: string;
  value: number;
  subtitle?: string;
  tone?: "neutral" | "good" | "warning" | "danger" | "teal" | "sky" | "orange" | "violet" | "rose";
};

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <section className="stat-strip" aria-label="本月摘要">
      {stats.map((stat) => (
        <div className={`stat-cell tone-${stat.tone ?? "neutral"}`} key={stat.label}>
          <span className="stat-label">{stat.label}</span>
          <strong className="stat-value">{formatCurrency(stat.value)}</strong>
          {stat.subtitle ? <span className="stat-subtitle">{stat.subtitle}</span> : null}
        </div>
      ))}
    </section>
  );
}
