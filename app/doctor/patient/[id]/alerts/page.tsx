import { minJun, recentEpisodes } from "@/lib/min-jun";

export default async function AlertsPage(
  props: PageProps<"/doctor/patient/[id]/alerts">
) {
  const { id } = await props.params;
  if (id !== minJun.id) {
    return <div className="p-10 text-ink-soft">Patient {id} not found.</div>;
  }

  // Map episodes to alert cards. None are crisis-level — this is the
  // "no active alerts" path. Milestone 6 (Slack MCP) sends real
  // crisis-tier alerts here.
  const infoAlerts = recentEpisodes.slice(0, 3);

  return (
    <div className="max-w-[1080px] px-10 py-10">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted font-semibold mb-2">
        Alerts
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-8">
        {minJun.name} — alert center
      </h1>

      <div className="bg-sage-soft border border-sage/30 rounded-2xl p-5 mb-6 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-sage" />
        <div className="text-[14px] text-ink">
          <strong>No active crisis alerts.</strong>{" "}
          <span className="text-ink-soft">
            All recent episodes were resolved without escalation.
          </span>
        </div>
      </div>

      <div className="text-[11px] tracking-[0.14em] uppercase text-muted font-semibold mb-3">
        Recent informational alerts
      </div>
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
                  {new Intl.DateTimeFormat("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  }).format(new Date(ep.at))}
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

      <div className="mt-8 bg-card border border-dashed border-line rounded-2xl p-6 text-center">
        <div className="text-[12.5px] text-muted leading-relaxed">
          Crisis-tier alerts arrive in real time and are also posted to{" "}
          <code className="font-mono text-ink bg-bg px-1.5 py-0.5 rounded">
            #min-jun-care
          </code>{" "}
          on Slack. Milestone 6 wires the Slack MCP.
        </div>
      </div>
    </div>
  );
}
