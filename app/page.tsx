import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-2xl w-full">
        <div className="text-[11px] tracking-[0.18em] uppercase text-muted font-semibold mb-4">
          KCF 2026 · Prototype
        </div>
        <h1 className="text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight mb-5">
          Anchor.{" "}
          <span className="text-accent">Grounding with evidence.</span>
        </h1>
        <p className="text-lg text-ink-soft leading-relaxed mb-10 max-w-xl">
          An AI agent that doesn&apos;t argue with paranoid thoughts — it
          checks the patient&apos;s real calendar, email, and messages, and
          gently shows them what&apos;s actually there.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/patient/chat"
            className="group block bg-card border border-line rounded-2xl p-7 hover:border-accent transition-colors"
          >
            <div className="text-[11px] tracking-[0.15em] uppercase text-muted font-semibold mb-2">
              Mobile surface
            </div>
            <div className="text-xl font-semibold mb-1.5">Patient app →</div>
            <p className="text-sm text-ink-soft leading-relaxed">
              The mobile experience Min-jun uses at home. Chat-first, with
              inline verification cards quoting his own data.
            </p>
          </Link>

          <Link
            href="/doctor"
            className="group block bg-card border border-line rounded-2xl p-7 hover:border-plum transition-colors"
          >
            <div className="text-[11px] tracking-[0.15em] uppercase text-muted font-semibold mb-2">
              Desktop surface
            </div>
            <div className="text-xl font-semibold mb-1.5">
              Clinician dashboard →
            </div>
            <p className="text-sm text-ink-soft leading-relaxed">
              What Dr. Lee sees on Monday morning. Weekly report, episode
              patterns, escalation alerts.
            </p>
          </Link>
        </div>

        <div className="mt-12 text-xs text-muted leading-relaxed">
          Educational prototype. Not a medical device. No clinical claims.
        </div>
      </div>
    </main>
  );
}
