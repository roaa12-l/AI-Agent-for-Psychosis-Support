"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ChatTurn,
  VerificationCardData,
} from "@/lib/min-jun";
import type {
  RespondRequest,
  RespondResponse,
} from "@/app/api/respond/route";
import { UserMessage } from "@/components/chat/user-message";
import { AIMessage } from "@/components/chat/ai-message";
import { VerificationCard } from "@/components/chat/verification-card";
import { toolCallToCard } from "@/lib/format-tool-calls";

type Props = {
  initial: ChatTurn[];
};

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

export function ChatThread({ initial }: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>(initial);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [escalated, setEscalated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Autoscroll to bottom whenever turns change.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, sending]);

  // Soft cap from the patient settings page.
  const turnsUsed = turns.filter((t) => t.role === "user").length;
  const hardCapped = turnsUsed >= 8;

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || sending || hardCapped || escalated) return;

    const now = new Date().toISOString();
    const userTurn: ChatTurn = { role: "user", at: now, text };
    setTurns((prev) => [...prev, userTurn]);
    setDraft("");
    setSending(true);
    setError(null);

    // Build history payload (flatten existing turns to role+text, mapping
    // our internal "ai" role to the API's "assistant").
    const history = turns.map<{ role: "user" | "assistant"; text: string }>(
      (t) => ({
        role: t.role === "ai" ? "assistant" : "user",
        text: t.text,
      })
    );

    const body: RespondRequest = { message: text, history };

    try {
      const res = await fetch("/api/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as RespondResponse;

      const verifications: VerificationCardData[] = data.toolCalls
        .map((tc) => toolCallToCard(tc))
        .filter((c): c is VerificationCardData => c !== null);

      const aiTurn: ChatTurn = {
        role: "ai",
        at: new Date().toISOString(),
        text: data.message,
        verifications: verifications.length > 0 ? verifications : undefined,
      };
      setTurns((prev) => [...prev, aiTurn]);
      if (data.shouldEscalate) setEscalated(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setSending(false);
    }
  }

  const firstAt = turns[0]?.at;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
      >
        {firstAt ? (
          <div className="flex justify-center">
            <span className="text-[11px] tracking-wider uppercase text-muted bg-bg/70 border border-line px-2.5 py-1 rounded-full">
              {formatDateHeader(firstAt)}
            </span>
          </div>
        ) : null}

        {turns.map((turn, i) => {
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

        {sending ? <TypingDots /> : null}

        {escalated ? (
          <div className="flex justify-center pt-2">
            <div className="bg-rose-soft border border-rose/30 rounded-xl px-4 py-3 text-[12.5px] text-rose font-medium max-w-[85%] text-center leading-relaxed">
              Crisis escalation — Anchor has paused and Dr. Lee Hye-jin has
              been notified.
            </div>
          </div>
        ) : hardCapped ? (
          <div className="flex justify-center pt-2">
            <div className="text-[11px] text-muted italic max-w-[80%] text-center leading-relaxed">
              You&apos;ve hit your conversation cap for this episode. That&apos;s
              by design — too much chat tonight is a trigger, not a relief.
              Try a walk, or text Mom.
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex justify-center pt-2">
            <div className="bg-amber-soft border border-amber/30 rounded-xl px-4 py-2.5 text-[12px] text-amber max-w-[85%] text-center">
              {error}
            </div>
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="border-t border-line bg-card px-3 py-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              escalated
                ? "Anchor is paused — wait for Dr. Lee."
                : hardCapped
                  ? "Conversation cap reached."
                  : "Tell Anchor what's happening…"
            }
            disabled={sending || hardCapped || escalated}
            rows={1}
            className="flex-1 bg-bg border border-line rounded-2xl px-3.5 py-2.5 text-[14.5px] text-ink placeholder:text-muted resize-none focus:outline-none focus:border-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={
              sending || hardCapped || escalated || draft.trim().length === 0
            }
            aria-label="Send"
            className="shrink-0 w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
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
          {sending
            ? "Anchor is checking your calendar…"
            : `${turnsUsed} / 8 turns this episode`}
        </p>
      </form>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-card border border-line rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-muted rounded-full animate-pulse [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-muted rounded-full animate-pulse [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-muted rounded-full animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  );
}
