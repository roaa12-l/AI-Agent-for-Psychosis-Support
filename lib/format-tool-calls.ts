/**
 * Convert tool calls returned by /api/respond into verification cards
 * rendered inline in the patient chat thread.
 *
 * The MCP's `list-events` etc. return JSON-encoded strings. We try to parse
 * them and present a clean, scannable card. If parsing fails for any reason,
 * we fall back to showing the raw text (better than crashing the UI).
 */

import type { VerificationCardData } from "@/lib/min-jun";
import type { ToolCallTrace } from "@/app/api/respond/route";

const CALENDAR_TOOLS = new Set([
  "list-events",
  "search-events",
  "get-event",
  "list-calendars",
  "get-freebusy",
]);

// Tools that exist for context only — never render as a verification card.
const SILENT_TOOLS = new Set(["get-current-time", "list-colors"]);

type RawEvent = {
  summary?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
};

function fmtDate(iso?: string): string {
  if (!iso) return "";
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

function fmtDateOnly(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function summarizeEvent(ev: RawEvent): string {
  const title = ev.summary ?? "(no title)";
  const startIso = ev.start?.dateTime ?? ev.start?.date;
  const isAllDay = !!ev.start?.date && !ev.start?.dateTime;
  const when = isAllDay ? fmtDateOnly(startIso) : fmtDate(startIso);
  return `${title} · ${when}`;
}

function titleForRange(timeMin?: string, timeMax?: string): string {
  if (!timeMin || !timeMax) return "Calendar";
  const a = new Date(timeMin);
  const b = new Date(timeMax);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return "Calendar window";
  }
  // Single-day window
  const sameDay =
    a.toDateString() === new Date(b.getTime() - 1).toDateString();
  if (sameDay) {
    return `Calendar — ${new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(a)}`;
  }
  return `Calendar — ${fmtDateOnly(timeMin)} to ${fmtDateOnly(timeMax)}`;
}

export function toolCallToCard(
  call: ToolCallTrace
): VerificationCardData | null {
  if (SILENT_TOOLS.has(call.name)) return null;
  if (!CALENDAR_TOOLS.has(call.name)) return null;

  if (call.isError) {
    return {
      kind: "calendar",
      title: "Calendar check failed",
      body: call.output.slice(0, 240),
      status: "conflict",
      observedAt: new Date().toISOString(),
    };
  }

  // Try to parse the MCP's JSON response.
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(call.output);
  } catch {
    parsed = null;
  }

  // list-events / search-events → { events: [...], totalCount: n }
  if (
    (call.name === "list-events" || call.name === "search-events") &&
    parsed &&
    typeof parsed === "object" &&
    "events" in parsed
  ) {
    const events = (parsed as { events: RawEvent[] }).events ?? [];
    const timeMin =
      (call.input.timeMin as string | undefined) ?? undefined;
    const timeMax =
      (call.input.timeMax as string | undefined) ?? undefined;

    const baseTitle =
      call.name === "search-events"
        ? `Calendar search: ${(call.input.query as string) ?? ""}`.trim()
        : titleForRange(timeMin, timeMax);

    if (events.length === 0) {
      return {
        kind: "calendar",
        title: baseTitle,
        body: "No events scheduled in this window.",
        status: "verified",
        observedAt: new Date().toISOString(),
      };
    }

    const body = events
      .slice(0, 8)
      .map((ev) => `• ${summarizeEvent(ev)}`)
      .join("\n");
    const overflow =
      events.length > 8 ? `\n…and ${events.length - 8} more` : "";

    return {
      kind: "calendar",
      title: baseTitle,
      body: body + overflow,
      status: "verified",
      observedAt: new Date().toISOString(),
    };
  }

  // get-event → single event object
  if (call.name === "get-event" && parsed && typeof parsed === "object") {
    const ev = parsed as RawEvent;
    return {
      kind: "calendar",
      title: "Calendar event",
      body: summarizeEvent(ev),
      status: "verified",
      observedAt: new Date().toISOString(),
    };
  }

  // Fallback — show raw text trimmed.
  const trimmed = call.output.trim();
  return {
    kind: "calendar",
    title: "Calendar check",
    body: trimmed.length > 300 ? trimmed.slice(0, 300) + "…" : trimmed,
    status: "verified",
    observedAt: new Date().toISOString(),
  };
}
