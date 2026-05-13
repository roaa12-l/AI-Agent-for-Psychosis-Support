/**
 * Convert tool calls returned by /api/respond into verification cards
 * rendered inline in the patient chat thread.
 *
 * Each MCP server returns text in its own shape — Calendar returns
 * JSON, Gmail returns plain-text key/value blocks. We parse each
 * carefully so the verification card is scannable; we fall back to
 * showing the raw text if parsing fails (better than crashing).
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

const GMAIL_TOOLS = new Set(["search_emails", "read_email"]);

// Tools that exist for context only — never render as a verification card.
const SILENT_TOOLS = new Set([
  "get-current-time",
  "list-colors",
  "list_email_labels",
]);

// ─── Calendar helpers ──────────────────────────────────────────────

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

function calendarCard(call: ToolCallTrace): VerificationCardData {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(call.output);
  } catch {
    parsed = null;
  }

  if (
    (call.name === "list-events" || call.name === "search-events") &&
    parsed &&
    typeof parsed === "object" &&
    "events" in parsed
  ) {
    const events = (parsed as { events: RawEvent[] }).events ?? [];
    const timeMin = call.input.timeMin as string | undefined;
    const timeMax = call.input.timeMax as string | undefined;

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

  if (call.name === "get-event" && parsed && typeof parsed === "object") {
    return {
      kind: "calendar",
      title: "Calendar event",
      body: summarizeEvent(parsed as RawEvent),
      status: "verified",
      observedAt: new Date().toISOString(),
    };
  }

  const trimmed = call.output.trim();
  return {
    kind: "calendar",
    title: "Calendar check",
    body: trimmed.length > 300 ? trimmed.slice(0, 300) + "…" : trimmed,
    status: "verified",
    observedAt: new Date().toISOString(),
  };
}

// ─── Gmail helpers ─────────────────────────────────────────────────

/**
 * Parse @gongrzhe Gmail MCP's text response. `search_emails` returns
 * blocks separated by blank lines, each block looking like:
 *
 *   ID: 19e1b3d8b936150d
 *   Subject: Re: weekly tasks update
 *   From: naroa110702@gmail.com
 *   Date: Tue, 13 May 2026 18:15:00 +0000
 */
type ParsedEmailSummary = {
  id: string;
  subject: string;
  from: string;
  date: string;
};

function parseSearchEmailsOutput(text: string): ParsedEmailSummary[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && b.includes("ID:"));
  return blocks.map((block) => {
    const get = (key: string) => {
      const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
      return m ? m[1].trim() : "";
    };
    return {
      id: get("ID"),
      subject: get("Subject"),
      from: get("From"),
      date: get("Date"),
    };
  });
}

/** Extract the "--- From: PERSONA ---" line from a seeded email body. */
function extractPersonaFromBody(body: string): string | null {
  const m = body.match(/--- ?From: ([^()\n]+?)(?:\s*\([^)]*\))?\s*---/);
  return m ? m[1].trim() : null;
}

/** Format a Date header like "Tue, 13 May 2026 18:15:00 +0000" → "Tue 18:15". */
function fmtEmailDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function gmailCard(call: ToolCallTrace): VerificationCardData {
  const text = call.output.trim();

  if (call.name === "search_emails") {
    const query = (call.input.query as string) ?? "";
    const emails = parseSearchEmailsOutput(text);

    if (emails.length === 0) {
      return {
        kind: "gmail",
        title: query ? `Inbox search: ${query}` : "Inbox search",
        body: "No emails matched this search.",
        status: "verified",
        observedAt: new Date().toISOString(),
      };
    }

    const body = emails
      .slice(0, 6)
      .map((e) => {
        const when = fmtEmailDate(e.date);
        const subj = e.subject || "(no subject)";
        return `• ${subj}${when ? ` · ${when}` : ""}`;
      })
      .join("\n");
    const overflow =
      emails.length > 6 ? `\n…and ${emails.length - 6} more` : "";

    return {
      kind: "gmail",
      title: query ? `Inbox search: ${query}` : "Recent inbox",
      body: body + overflow,
      status: "verified",
      observedAt: new Date().toISOString(),
    };
  }

  if (call.name === "read_email") {
    // read_email returns: "Thread ID:\nSubject:\nFrom:\nTo:\nDate:\n\n<body>"
    const subjectMatch = text.match(/^Subject:\s*(.+)$/m);
    const fromMatch = text.match(/^From:\s*(.+)$/m);
    const dateMatch = text.match(/^Date:\s*(.+)$/m);
    const bodyStart = text.indexOf("\n\n");
    const body =
      bodyStart >= 0 ? text.slice(bodyStart + 2).trim() : text;

    const persona = extractPersonaFromBody(body);
    const subject = subjectMatch?.[1]?.trim() ?? "(no subject)";
    const dateLabel = dateMatch ? fmtEmailDate(dateMatch[1].trim()) : "";
    const fromRaw = fromMatch?.[1]?.trim() ?? "";

    const senderLine = persona
      ? `From ${persona}${dateLabel ? ` · ${dateLabel}` : ""}`
      : `From ${fromRaw}${dateLabel ? ` · ${dateLabel}` : ""}`;

    // Strip the "--- From: ... ---" header line from the displayed body
    const cleanBody = body
      .replace(/--- ?From:[^\n]*---\s*\n?/g, "")
      .trim();

    const excerpt =
      cleanBody.length > 220 ? cleanBody.slice(0, 220) + "…" : cleanBody;

    return {
      kind: "gmail",
      title: subject,
      body: `${senderLine}\n\n${excerpt}`,
      status: "verified",
      observedAt: new Date().toISOString(),
    };
  }

  // Fallback
  return {
    kind: "gmail",
    title: "Inbox check",
    body: text.length > 300 ? text.slice(0, 300) + "…" : text,
    status: "verified",
    observedAt: new Date().toISOString(),
  };
}

// ─── Public entry point ────────────────────────────────────────────

export function toolCallToCard(
  call: ToolCallTrace
): VerificationCardData | null {
  if (SILENT_TOOLS.has(call.name)) return null;

  const kind: VerificationCardData["kind"] | null = CALENDAR_TOOLS.has(
    call.name
  )
    ? "calendar"
    : GMAIL_TOOLS.has(call.name)
      ? "gmail"
      : null;
  if (!kind) return null;

  if (call.isError) {
    return {
      kind,
      title: kind === "gmail" ? "Inbox check failed" : "Calendar check failed",
      body: call.output.slice(0, 240),
      status: "conflict",
      observedAt: new Date().toISOString(),
    };
  }

  return kind === "calendar" ? calendarCard(call) : gmailCard(call);
}
