import {
  getConnectedServices,
  type ConnectedService,
} from "@/lib/services";

// Service status is computed from env vars + on-disk tokens —
// always reflect the current configuration.
export const dynamic = "force-dynamic";

const statusStyles: Record<
  ConnectedService["status"],
  { pill: string; label: string }
> = {
  connected: { pill: "bg-sage-soft text-sage", label: "Connected" },
  pending: { pill: "bg-amber-soft text-amber", label: "Not yet connected" },
  error: { pill: "bg-rose-soft text-rose", label: "Reconnect needed" },
};

const kindEmoji: Record<ConnectedService["kind"], string> = {
  calendar: "📅",
  gmail: "📧",
  drive: "📁",
  slack: "💬",
};

export default async function PatientServicesPage() {
  const services = await getConnectedServices();

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">
          Connected services
        </h1>
        <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
          What Anchor is allowed to read on your behalf. Read-only access
          only. You can revoke any one of these from Google or Slack at any
          time.
        </p>
      </header>

      <ul className="space-y-3">
        {services.map((s) => {
          const style = statusStyles[s.status];
          return (
            <li
              key={s.kind}
              className="bg-card border border-line rounded-2xl p-4 flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-bg flex items-center justify-center text-xl shrink-0">
                {kindEmoji[s.kind]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[14px] font-semibold text-ink truncate">
                    {s.label}
                  </span>
                  <span
                    className={`${style.pill} text-[10.5px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full shrink-0`}
                  >
                    {style.label}
                  </span>
                </div>
                <div className="text-[12px] text-muted truncate">
                  {s.account}
                </div>
                <p className="text-[11.5px] text-ink-soft mt-1 leading-relaxed">
                  {s.detail}
                </p>
                <div className="text-[11.5px] text-ink-soft mt-2">
                  Scopes:{" "}
                  {s.scopes.map((sc) => (
                    <span
                      key={sc}
                      className="inline-block bg-bg border border-line text-[10.5px] font-mono px-1.5 py-0.5 rounded mr-1"
                    >
                      {sc}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 bg-accent-soft border border-accent/20 rounded-xl p-4 text-[12.5px] text-ink-soft leading-relaxed">
        <span className="font-semibold text-accent">Anchor never writes.</span>{" "}
        Calendar events are only read, never modified. Emails are only
        scanned for verification — never sent on your behalf. Slack
        permissions are scoped to a single private channel for your care
        team.
      </div>
    </div>
  );
}
