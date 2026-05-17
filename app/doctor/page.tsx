import Link from "next/link";
import { minJun, recentEpisodes } from "@/lib/min-jun";
import { getRecentEscalations, type RecentEscalation } from "@/lib/slack";

// Always re-fetch from Slack on every render — escalations are
// time-sensitive and a stale cache here is worse than a slow page.
export const dynamic = "force-dynamic";

function isThisWeek(iso: string) {
  const d = new Date(iso).getTime();
  const now = Date.now();
  return now - d < 7 * 24 * 60 * 60 * 1000;
}

/** Strip Slack markup for plain rendering in the dashboard panel. */
function stripSlackMarkup(text: string): string {
  return text
    .replace(/:rotating_light:/g, "🚨")
    .replace(/\*(.+?)\*/g, "$1") // strip *bold* markers
    .replace(/^>\s?/gm, ""); // strip > quote markers
}

function fmtRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.round(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default async function DoctorOverviewPage() {
  const thisWeek = recentEpisodes.filter((e) => isThisWeek(e.at));
  const escalations = await getRecentEscalations(5);
  const status =
    escalations.length > 0 &&
    Date.now() - new Date(escalations[0].postedAt).getTime() <
      24 * 60 * 60 * 1000
      ? "active"
      : "stable";

  return (
    <div className="max-w-[1080px] px-10 py-10">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted font-semibold mb-2">
        Patient overview
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-1">{minJun.name}</h1>
      <p className="text-[14px] text-ink-soft mb-8">
        {minJun.age} · {minJun.diagnosis}
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Status"
          value={status === "stable" ? "Stable" : "Active"}
          tone={status === "stable" ? "sage" : "rose"}
        />
        <StatCard
          label="Episodes this week"
          value={String(thisWeek.length)}
          tone="accent"
        />
        <StatCard
          label="Crisis escalations"
          value={String(escalations.length)}
          tone={escalations.length > 0 ? "rose" : "muted"}
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
            AI-summarised episode patterns, heatmap, and trigger correlations
            for Min-jun.
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
            {escalations.length === 0
              ? "Crisis-keyword detections and escalations. None active."
              : `${escalations.length} recent escalation${escalations.length === 1 ? "" : "s"} via Slack handoff.`}
          </p>
        </Link>
      </div>

      <div className="bg-card border border-line rounded-2xl p-6 mb-6">
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

      {/* ───── Recent escalations (live from Slack) ───── */}
      <RecentEscalationsPanel escalations={escalations} />
    </div>
  );
}

function RecentEscalationsPanel({
  escalations,
}: {
  escalations: RecentEscalation[];
}) {
  return (
    <div className="bg-card border border-line rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-line">
        <div>
          <div className="text-[11px] tracking-[0.14em] uppercase text-muted font-semibold mb-1">
            Live from #min-jun-care
          </div>
          <h2 className="text-[15px] font-semibold text-ink">
            Recent crisis escalations
          </h2>
        </div>
        <div className="text-[11px] text-muted">
          via Slack MCP
        </div>
      </div>

      {escalations.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-[13.5px] text-ink-soft mb-1">No escalations yet.</p>
          <p className="text-[12px] text-muted">
            Crisis-keyword detections will appear here in real time, posted to{" "}
            <code className="text-[11.5px] bg-bg px-1.5 py-0.5 rounded">
              #min-jun-care
            </code>{" "}
            by Anchor and read back via the Slack MCP server.
          </p>
        </div>
      ) : (
        <ul>
          {escalations.map((e) => (
            <li
              key={e.ts}
              className="px-6 py-4 border-b border-line last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="text-[12px] font-semibold text-rose tracking-wide">
                  🚨 Escalation
                </div>
                <div className="text-[11.5px] text-muted shrink-0">
                  {fmtRelative(e.postedAt)}
                </div>
              </div>
              <pre className="text-[13px] text-ink-soft leading-relaxed whitespace-pre-wrap font-sans">
                {stripSlackMarkup(e.text)}
              </pre>
            </li>
          ))}
        </ul>
      )}
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
  tone: "sage" | "accent" | "muted" | "rose";
}) {
  const toneCls = {
    sage: "text-sage",
    accent: "text-accent",
    muted: "text-ink-soft",
    rose: "text-rose",
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
