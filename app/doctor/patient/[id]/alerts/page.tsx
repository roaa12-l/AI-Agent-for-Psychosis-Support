import { minJun } from "@/lib/min-jun";
import { readAllEpisodes } from "@/lib/episodes";
import { getRecentEscalations, type RecentEscalation } from "@/lib/slack";

// Crisis escalations are time-sensitive — never serve a stale cache.
export const dynamic = "force-dynamic";

function stripSlackMarkup(text: string): string {
  return text
    .replace(/:rotating_light:/g, "🚨")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^>\s?/gm, "");
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

function fmtAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export default async function AlertsPage(
  props: PageProps<"/doctor/patient/[id]/alerts">
) {
  const { id } = await props.params;
  if (id !== minJun.id) {
    return <div className="p-10 text-ink-soft">Patient {id} not found.</div>;
  }

  // Pull live crisis escalations from the #min-jun-care Slack channel.
  // Each post is an Anchor-generated escalation from the patient runtime.
  const escalations = await getRecentEscalations(20);

  // Last 24h crisis count drives the hero banner color/state.
  const activeCrisis = escalations.filter(
    (e) => Date.now() - new Date(e.postedAt).getTime() < 24 * 60 * 60 * 1000
  );

  // Info tier = non-crisis episodes from the local store. Newest 5.
  const allEpisodes = await readAllEpisodes();
  const infoAlerts = allEpisodes
    .filter((e) => !e.escalated && e.severity !== "crisis")
    .slice(0, 5);

  return (
    <div className="max-w-[1080px] px-10 py-10">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted font-semibold mb-2">
        Alerts
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-8">
        {minJun.name} — alert center
      </h1>

      {activeCrisis.length > 0 ? (
        <div className="bg-rose-soft border border-rose/40 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <span className="w-2 h-2 rounded-full bg-rose mt-2 shrink-0 animate-pulse" />
          <div className="text-[14px] text-ink">
            <strong className="text-rose">
              {activeCrisis.length} active crisis alert
              {activeCrisis.length === 1 ? "" : "s"}.
            </strong>{" "}
            <span className="text-ink-soft">
              In the last 24 hours. Each was posted to{" "}
              <code className="font-mono text-[12px] bg-bg px-1.5 py-0.5 rounded">
                #min-jun-care
              </code>{" "}
              for clinician acknowledgement.
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-sage-soft border border-sage/30 rounded-2xl p-5 mb-6 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-sage" />
          <div className="text-[14px] text-ink">
            <strong>No active crisis alerts.</strong>{" "}
            <span className="text-ink-soft">
              All recent episodes were resolved without escalation.
            </span>
          </div>
        </div>
      )}

      {/* Crisis-tier alerts — from Slack */}
      {escalations.length > 0 ? (
        <>
          <div className="text-[11px] tracking-[0.14em] uppercase text-muted font-semibold mb-3 flex items-center justify-between">
            <span>Crisis escalations · live</span>
            <span className="text-[10px] tracking-wider text-muted">
              from #min-jun-care via Slack MCP
            </span>
          </div>
          <ul className="space-y-3 mb-8">
            {escalations.map((e) => (
              <CrisisAlertCard key={e.ts} escalation={e} />
            ))}
          </ul>
        </>
      ) : null}

      {/* Informational tier — local episode log */}
      <div className="text-[11px] tracking-[0.14em] uppercase text-muted font-semibold mb-3">
        Recent informational alerts
      </div>
      {infoAlerts.length === 0 ? (
        <div className="bg-card border border-dashed border-line rounded-xl p-6 text-center text-[12.5px] text-muted leading-relaxed">
          No informational episodes logged yet. Resolved-without-escalation
          conversations will appear here.
        </div>
      ) : (
        <ul className="space-y-3">
          {infoAlerts.map((ep) => (
            <li
              key={ep.id}
              className="bg-card border border-line border-l-4 border-l-accent rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <div className="text-[13.5px] font-semibold text-ink">
                    Episode logged: {ep.theme}
                  </div>
                  <div className="text-[11.5px] text-muted">
                    {fmtAbsolute(ep.startedAt)} · {ep.durationMin}m ·{" "}
                    {ep.aiTurns} turns
                  </div>
                </div>
                <span className="bg-accent-soft text-accent text-[10.5px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full shrink-0">
                  Info
                </span>
              </div>
              <p className="text-[12.5px] text-ink-soft mt-1.5 leading-relaxed">
                {ep.outcome}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CrisisAlertCard({ escalation }: { escalation: RecentEscalation }) {
  const cleaned = stripSlackMarkup(escalation.text);
  return (
    <li className="bg-card border border-line border-l-4 border-l-rose rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-[13.5px] font-semibold text-ink flex items-center gap-2">
            <span className="text-rose">🚨</span>
            <span>Crisis escalation</span>
          </div>
          <div className="text-[11.5px] text-muted mt-0.5">
            {fmtRelative(escalation.postedAt)} ·{" "}
            {fmtAbsolute(escalation.postedAt)}
          </div>
        </div>
        <span className="bg-rose-soft text-rose text-[10.5px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full shrink-0">
          Crisis
        </span>
      </div>
      <pre className="text-[12.5px] text-ink-soft leading-relaxed whitespace-pre-wrap font-sans mt-2">
        {cleaned}
      </pre>
    </li>
  );
}
