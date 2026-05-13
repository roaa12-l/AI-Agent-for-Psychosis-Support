import { minJun } from "@/lib/min-jun";

export default function PatientSettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-5">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">Your settings</h1>
        <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
          You stay in control of how Anchor talks to you.
        </p>
      </header>

      <section className="bg-card border border-line rounded-2xl p-4 mb-4">
        <div className="text-[11px] tracking-[0.12em] uppercase text-muted font-semibold mb-3">
          About you
        </div>
        <Row label="Name" value={`${minJun.name} (${minJun.nameKo})`} />
        <Row label="Age" value={String(minJun.age)} />
        <Row label="Diagnosis" value={minJun.diagnosis} />
      </section>

      <section className="bg-card border border-line rounded-2xl p-4 mb-4">
        <div className="text-[11px] tracking-[0.12em] uppercase text-muted font-semibold mb-3">
          Care team
        </div>
        <Row label="Psychiatrist" value={minJun.careTeam.psychiatrist} />
        <Row label="Case manager" value={minJun.careTeam.caseManager} />
        <Row label="Emergency contact" value={minJun.careTeam.emergencyContact} />
      </section>

      <section className="bg-card border border-line rounded-2xl p-4 mb-4">
        <div className="text-[11px] tracking-[0.12em] uppercase text-muted font-semibold mb-3">
          Medications
        </div>
        {minJun.medications.map((m) => (
          <Row
            key={m.name}
            label={m.name}
            value={`${m.dose} · ${m.schedule}`}
          />
        ))}
      </section>

      <section className="bg-card border border-line rounded-2xl p-4 mb-4">
        <div className="text-[11px] tracking-[0.12em] uppercase text-muted font-semibold mb-3">
          Conversation limits
        </div>
        <Toggle label="Cap each episode at 8 turns" defaultOn />
        <Toggle label="Hard quiet between 03:00 — 06:00" defaultOn />
        <Toggle label="Crisis keywords route directly to Dr. Lee" defaultOn locked />
      </section>

      <section className="bg-card border border-line rounded-2xl p-4">
        <div className="text-[11px] tracking-[0.12em] uppercase text-muted font-semibold mb-3">
          Triggers you&apos;ve flagged
        </div>
        <ul className="space-y-2 text-[13px] text-ink-soft">
          {minJun.knownTriggers.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-muted" />
              {t}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-[13.5px] text-ink font-medium text-right">
        {value}
      </span>
    </div>
  );
}

function Toggle({
  label,
  defaultOn,
  locked,
}: {
  label: string;
  defaultOn?: boolean;
  locked?: boolean;
}) {
  const on = !!defaultOn;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[13.5px] text-ink pr-3">
        {label}
        {locked ? (
          <span className="ml-1.5 text-[10.5px] text-muted uppercase tracking-wider">
            locked
          </span>
        ) : null}
      </span>
      <span
        className={`relative inline-block w-9 h-5 rounded-full transition ${
          on ? "bg-accent" : "bg-line"
        } ${locked ? "opacity-70" : ""}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 ${on ? "right-0.5" : "left-0.5"} w-4 h-4 bg-white rounded-full shadow`}
        />
      </span>
    </div>
  );
}
