import Link from "next/link";
import { minJun, recentEpisodes } from "@/lib/min-jun";

function isThisWeek(iso: string) {
  const d = new Date(iso).getTime();
  const now = Date.now();
  return now - d < 7 * 24 * 60 * 60 * 1000;
}

export default function DoctorOverviewPage() {
  const thisWeek = recentEpisodes.filter((e) => isThisWeek(e.at));
  const status = "stable"; // computed from episodes; static for skeleton

  return (
    <div className="max-w-[1080px] px-10 py-10">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted font-semibold mb-2">
        Patient overview
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-1">
        {minJun.name}
      </h1>
      <p className="text-[14px] text-ink-soft mb-8">
        {minJun.age} · {minJun.diagnosis}
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Status"
          value={status === "stable" ? "Stable" : "Active"}
          tone="sage"
        />
        <StatCard
          label="Episodes this week"
          value={String(thisWeek.length)}
          tone="accent"
        />
        <StatCard
          label="Crisis escalations"
          value="0"
          tone="muted"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link
          href={`/doctor/patient/${minJun.id}/report`}
          className="block bg-card border border-line rounded-2xl p-6 hover:border-plum transition-colors"
        >
          <div className="text-[11px] tracking-[0.14em] uppercase text-muted font-semibold mb-2">
            This week
          </div>
          <div className="text-lg font-semibold mb-1">Weekly report →</div>
          <p className="text-[13.5px] text-ink-soft leading-relaxed">
            AI-summarised episode patterns, heatmap, and trigger
            correlations for Min-jun.
          </p>
        </Link>

        <Link
          href={`/doctor/patient/${minJun.id}/alerts`}
          className="block bg-card border border-line rounded-2xl p-6 hover:border-rose transition-colors"
        >
          <div className="text-[11px] tracking-[0.14em] uppercase text-muted font-semibold mb-2">
            Real-time
          </div>
          <div className="text-lg font-semibold mb-1">Alert center →</div>
          <p className="text-[13.5px] text-ink-soft leading-relaxed">
            Crisis-keyword detections and escalations. None active.
          </p>
        </Link>
      </div>

      <div className="bg-card border border-line rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] tracking-[0.14em] uppercase text-muted font-semibold mb-1">
              Most recent episode
            </div>
            <div className="text-[15px] font-semibold text-ink">
              {recentEpisodes[0]?.theme} · {recentEpisodes[0]?.severity}
            </div>
          </div>
          <Link
            href={`/doctor/patient/${minJun.id}/report`}
            className="text-[12.5px] font-semibold text-accent hover:underline"
          >
            Open full report →
          </Link>
        </div>
        <p className="text-[13.5px] text-ink-soft leading-relaxed">
          {recentEpisodes[0]?.outcome}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "sage" | "accent" | "muted";
}) {
  const toneCls = {
    sage: "text-sage",
    accent: "text-accent",
    muted: "text-ink-soft",
  }[tone];
  return (
    <div className="bg-card border border-line rounded-2xl p-5">
      <div className="text-[10.5px] tracking-[0.14em] uppercase text-muted font-bold mb-2">
        {label}
      </div>
      <div className={`text-3xl font-bold tracking-tight ${toneCls}`}>
        {value}
      </div>
    </div>
  );
}
