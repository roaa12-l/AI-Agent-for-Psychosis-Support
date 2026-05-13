import { heroConversation } from "@/lib/min-jun";
import { UserMessage } from "@/components/chat/user-message";
import { AIMessage } from "@/components/chat/ai-message";
import { VerificationCard } from "@/components/chat/verification-card";

function formatClock(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function formatDateHeader(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

export default function PatientChatPage() {
  const firstAt = heroConversation[0]?.at;
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Scrolling thread */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {firstAt ? (
          <div className="flex justify-center">
            <span className="text-[11px] tracking-wider uppercase text-muted bg-bg/70 border border-line px-2.5 py-1 rounded-full">
              {formatDateHeader(firstAt)}
            </span>
          </div>
        ) : null}

        {heroConversation.map((turn, i) => {
          if (turn.role === "user") {
            return (
              <UserMessage
                key={i}
                text={turn.text}
                timeLabel={formatClock(turn.at)}
              />
            );
          }
          return (
            <div key={i} className="space-y-2.5">
              {turn.verifications?.map((v, j) => (
                <VerificationCard key={`${i}-v${j}`} data={v} />
              ))}
              <AIMessage text={turn.text} timeLabel={formatClock(turn.at)} />
            </div>
          );
        })}

        <div className="flex justify-center pt-2">
          <div className="text-[11px] text-muted italic max-w-[80%] text-center leading-relaxed">
            Anchor capped this conversation at 4 turns and logged it as a
            moderate episode. Your clinician will see it in tomorrow&apos;s
            digest.
          </div>
        </div>
      </div>

      {/* Composer (visual only for now — wired up in Milestone 4) */}
      <div className="border-t border-line bg-card px-3 py-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-bg border border-line rounded-2xl px-3.5 py-2.5">
            <span className="text-[14.5px] text-muted">
              Tell Anchor what&apos;s happening…
            </span>
          </div>
          <button
            type="button"
            disabled
            aria-label="Send"
            className="shrink-0 w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 12L19 12M19 12L13 6M19 12L13 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="text-[10.5px] text-muted mt-1.5 px-1">
          Composer wires up in Milestone 4 when Claude&apos;s tool-use is plumbed in.
        </p>
      </div>
    </div>
  );
}
