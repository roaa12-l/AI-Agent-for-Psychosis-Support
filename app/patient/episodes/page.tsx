import { recentEpisodes, type Severity } from "@/lib/min-jun";

function formatDate(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

const sevStyles: Record<Severity, { bg: string; text: string; label: string }> = {
  low: { bg: "bg-sage-soft", text: "text-sage", label: "Low" },
  moderate: { bg: "bg-amber-soft", text: "text-amber", label: "Moderate" },
  high: { bg: "bg-rose-soft", text: "text-rose", label: "High" },
  crisis: { bg: "bg-rose-soft", text: "text-rose", label: "Crisis" },
};

export default function PatientEpisodesPage() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-5">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">
          Your episode log
        </h1>
        <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
          Each time we talk, Anchor saves a short summary. You see it. Your
          care team sees it. Nothing is hidden.
        </p>
      </header>

      <ul className="space-y-3">
        {recentEpisodes.map((ep) => {
          const sev = sevStyles[ep.severity];
          return (
            <li
              key={ep.id}
              className="bg-card border border-line rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-[13px] font-semibold text-ink">
                    {ep.theme}
                  </div>
                  <div className="text-[11.5px] text-muted mt-0.5">
                    {formatDate(ep.at)} · {formatTime(ep.at)}
                  </div>
                </div>
                <span
                  className={`${sev.bg} ${sev.text} text-[10.5px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full`}
                >
                  {sev.label}
                </span>
              </div>
              <p className="text-[13px] text-ink-soft leading-relaxed">
                {ep.outcome}
              </p>
              <div className="mt-2.5 text-[11px] text-muted flex gap-3">
                <span>{ep.durationMin} min</span>
                <span>·</span>
                <span>{ep.aiTurns} AI turns</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
