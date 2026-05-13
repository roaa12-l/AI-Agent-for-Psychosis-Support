import type { VerificationCardData } from "@/lib/min-jun";

type Props = {
  data: VerificationCardData;
};

function KindIcon({ kind }: { kind: VerificationCardData["kind"] }) {
  const cls = "w-3.5 h-3.5";
  switch (kind) {
    case "calendar":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="3.5"
            y="5"
            width="17"
            height="15"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M3.5 9.5H20.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M8 3.5V6.5M16 3.5V6.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "gmail":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="3.5"
            y="5.5"
            width="17"
            height="13"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M4 7L12 13L20 7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "drive":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M9 4L4 14L7 19H17L20 14L15 4H9Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9 4L14 14H4" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "slack":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="4"
            y="9"
            width="11"
            height="3"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="9"
            y="4"
            width="3"
            height="11"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="9"
            y="12"
            width="11"
            height="3"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="12"
            y="9"
            width="3"
            height="11"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      );
  }
}

function StatusPill({ status }: { status: VerificationCardData["status"] }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 bg-sage-soft text-sage text-[11px] font-semibold px-2 py-0.5 rounded-full">
        <svg
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 12L10 17L19 7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Verified
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span className="inline-flex items-center gap-1 bg-amber-soft text-amber text-[11px] font-semibold px-2 py-0.5 rounded-full">
        ! Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-rose-soft text-rose text-[11px] font-semibold px-2 py-0.5 rounded-full">
      × Conflict
    </span>
  );
}

const kindLabel: Record<VerificationCardData["kind"], string> = {
  calendar: "Google Calendar",
  gmail: "Gmail",
  drive: "Google Drive",
  slack: "Slack",
};

export function VerificationCard({ data }: Props) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[82%] w-full bg-sage-soft/60 border border-sage/30 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sage">
            <KindIcon kind={data.kind} />
          </span>
          <span className="text-[11px] tracking-[0.1em] uppercase font-semibold text-sage">
            {kindLabel[data.kind]}
          </span>
          <span className="ml-auto">
            <StatusPill status={data.status} />
          </span>
        </div>
        <div className="text-[14px] font-semibold text-ink mb-1">
          {data.title}
        </div>
        <div className="text-[13.5px] text-ink-soft leading-relaxed whitespace-pre-wrap">
          {data.body}
        </div>
      </div>
    </div>
  );
}
