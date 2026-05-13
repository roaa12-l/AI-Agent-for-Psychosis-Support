import { minJun, recentEpisodes, type Severity } from "@/lib/min-jun";

export default async function WeeklyReportPage(
  props: PageProps<"/doctor/patient/[id]/report">
) {
  // params is Promise in Next.js 16
  const { id } = await props.params;
  // For the skeleton we only have Min-jun. Real lookups land in milestone 5+.
  if (id !== minJun.id) {
    return (
      <div className="p-10 text-ink-soft">Patient {id} not found.</div>
    );
  }

  // Quick aggregates from the fixture
  const themeCounts = new Map<string, number>();
  for (const e of recentEpisodes) {
    themeCounts.set(e.theme, (themeCounts.get(e.theme) ?? 0) + 1);
  }
  const themes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxTheme = themes[0]?.[1] ?? 1;

  const hourBuckets = new Array(24).fill(0) as number[];
  for (const e of recentEpisodes) {
    const h = new Date(e.at).getHours();
    hourBuckets[h] += 1;
  }
  const maxHour = Math.max(1, ...hourBuckets);

  return (
    <div className="max-w-[1080px] px-10 py-10">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted font-semibold mb-2">
        Weekly report
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-1">
        {minJun.name} — last 30 days
      </h1>
      <p className="text-[14px] text-ink-soft mb-8">
        {recentEpisodes.length} episodes · {minJun.diagnosis}
      </p>

      <div className="grid grid-cols-[1.4fr_1fr] gap-6">
        {/* Left column */}
        <div className="space-y-5">
          <section className="bg-card border border-line rounded-2xl p-6">
            <div className="text-[11px] tracking-[0.14em] uppercase text-muted font-semibold mb-3">
              AI-generated summary
            </div>
            <div className="space-y-3 text-[14px] text-ink-soft leading-relaxed">
              <p>
                Min-jun&apos;s episodes this month cluster strongly around{" "}
                <strong className="text-ink">workplace persecution</strong>{" "}
                themes — three of the five logged episodes involve his
                manager, and two of those followed a 1:1 with him. The most
                recent (Tue night) resolved through calendar verification
                within 14 minutes, with no escalation.
              </p>
              <p>
                Time-of-day pattern is consistent with prior months: episodes
                concentrate between <strong className="text-ink">22:00 and 02:00</strong>.
                In two of the five he self-reported missed evening Risperidone
                or under-sleep — both flagged triggers. Recommend revisiting
                medication-adherence support and considering an earlier
                evening dose reminder at his next session.
              </p>
            </div>
          </section>

          <section className="bg-card border border-line rounded-2xl p-6">
            <div className="text-[11px] tracking-[0.14em] uppercase text-muted font-semibold mb-3">
              Chronological episode log
            </div>
            <ul className="divide-y divide-line">
              {recentEpisodes.map((ep) => (
                <li key={ep.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                      <div className="text-[13.5px] font-semibold text-ink">
                        {ep.theme}
                      </div>
                      <div className="text-[11.5px] text-muted">
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        }).format(new Date(ep.at))}
                        {" · "}
                        {ep.durationMin} min · {ep.aiTurns} turns
                      </div>
                    </div>
                    <SeverityChip sev={ep.severity} />
                  </div>
                  <p className="text-[12.5px] text-ink-soft mt-1.5 leading-relaxed">
                    {ep.outcome}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <section className="bg-card border border-line rounded-2xl p-6">
            <div className="text-[11px] tracking-[0.14em] uppercase text-muted font-semibold mb-3">
              Theme breakdown
            </div>
            <ul className="space-y-3">
              {themes.map(([theme, n]) => (
                <li key={theme}>
                  <div className="flex items-center justify-between text-[12.5px] mb-1">
                    <span className="text-ink font-medium">{theme}</span>
                    <span className="text-muted font-mono">{n}</span>
                  </div>
                  <div className="h-2 bg-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${(n / maxTheme) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-card border border-line rounded-2xl p-6">
            <div className="text-[11px] tracking-[0.14em] uppercase text-muted font-semibold mb-3">
              Hour-of-day distribution
            </div>
            <div className="flex items-end gap-[3px] h-24">
              {hourBuckets.map((n, h) => (
                <div
                  key={h}
                  className="flex-1 bg-bg rounded-sm relative"
                  title={`${h}:00 — ${n} episodes`}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-plum rounded-sm"
                    style={{ height: `${(n / maxHour) * 100}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted font-mono mt-2">
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>23</span>
            </div>
            <p className="text-[11.5px] text-muted mt-3 leading-relaxed italic">
              Late-night clustering visible: most episodes between 22:00 and
              02:00.
            </p>
          </section>

          <section className="bg-card border border-line rounded-2xl p-6">
            <div className="text-[11px] tracking-[0.14em] uppercase text-muted font-semibold mb-3">
              Trigger correlations
            </div>
            <ul className="space-y-2 text-[12.5px] text-ink-soft">
              {minJun.knownTriggers.map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="w-1 h-1 mt-2 rounded-full bg-muted shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function SeverityChip({ sev }: { sev: Severity }) {
  const map: Record<Severity, string> = {
    low: "bg-sage-soft text-sage",
    moderate: "bg-amber-soft text-amber",
    high: "bg-rose-soft text-rose",
    crisis: "bg-rose-soft text-rose",
  };
  return (
    <span
      className={`${map[sev]} text-[10.5px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full shrink-0`}
    >
      {sev}
    </span>
  );
}
