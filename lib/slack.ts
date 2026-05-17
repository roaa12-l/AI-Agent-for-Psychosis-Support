/**
 * Slack helper — posts structured crisis escalations to the
 * clinician channel, and reads recent posts back for the doctor
 * dashboard's "Recent escalations" panel.
 *
 * Channel discovery uses SLACK_ESCALATION_CHANNEL_ID directly
 * (Slack's bot conversations.list won't return private channels
 * the bot was invited to without scope tricks, and our care
 * channel is intentionally private).
 *
 * All Slack tool calls go through getMcpClient().callTool(), which
 * enforces the SERVER_ALLOWED_TOOLS allowlist. The patient-facing
 * Claude model never sees Slack tools.
 *
 * Best-effort design: Slack failures log and degrade silently.
 * The patient's safety message and the escalation banner do not
 * depend on Slack succeeding.
 */

import { getMcpClient } from "./mcp-client";
import { minJun } from "./min-jun";

export type EscalationContext = {
  patientName: string;
  patientNameKo: string;
  triggerMessage: string;
  /**
   * Last few turns of conversation context. Role uses the API wire
   * format ("user" / "assistant"). Timestamps are optional — we
   * fall back to no clock label if missing.
   */
  recentTurns: Array<{
    role: "user" | "assistant";
    text: string;
    at?: string;
  }>;
};

export type RecentEscalation = {
  ts: string; // Slack message timestamp ("1715637246.000200")
  postedAt: string; // ISO string derived from ts
  text: string;
};

/** Format a clock label for the escalation body. */
function fmtLocalTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    hour12: true,
  }).format(d);
}

function fmtTurn(t: {
  role: "user" | "assistant";
  text: string;
  at?: string;
}): string {
  let time = "—";
  if (t.at) {
    const clock = new Date(t.at);
    if (!Number.isNaN(clock.getTime())) {
      time = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(clock);
    }
  }
  const who = t.role === "user" ? minJun.name : "Anchor";
  // Slack truncates long messages in alert previews; keep turns short.
  const oneLine = t.text.replace(/\s+/g, " ").trim();
  const truncated =
    oneLine.length > 200 ? oneLine.slice(0, 200) + "…" : oneLine;
  return `> *${time} — ${who}:* ${truncated}`;
}

/**
 * Compose the markdown body of the escalation message. Designed for
 * a clinician scanning a Slack channel — patient identity, time,
 * trigger, last 3 turns of context, and pointers to the dashboard.
 */
function buildEscalationMessage(ctx: EscalationContext): string {
  const now = new Date().toISOString();
  const contextTurns =
    ctx.recentTurns.length === 0
      ? "_no prior context — this was the first message_"
      : ctx.recentTurns.map(fmtTurn).join("\n");

  return [
    `:rotating_light: *Crisis escalation — ${ctx.patientName} (${ctx.patientNameKo})*`,
    "",
    `*Patient:* ${ctx.patientName} · ${minJun.diagnosis}`,
    `*Time:* ${fmtLocalTime(now)}`,
    "",
    `*Triggering message:*`,
    `> ${ctx.triggerMessage.replace(/\s+/g, " ").trim()}`,
    "",
    `*Recent context:*`,
    contextTurns,
    "",
    `*Anchor action:* paused the conversation, surfaced clinician-handoff banner to patient. No further verification will run until you respond.`,
    "",
    `Dashboard → http://localhost:3000/doctor/patient/${minJun.id}/alerts`,
  ].join("\n");
}

/**
 * Post a crisis escalation to the configured Slack channel.
 * Best-effort: any failure is logged but not rethrown — the patient's
 * safety message is the source of truth, Slack is the human handoff.
 */
export async function postCrisisEscalation(
  ctx: EscalationContext
): Promise<{ ok: boolean; error?: string }> {
  const channelId = process.env.SLACK_ESCALATION_CHANNEL_ID;
  if (!channelId) {
    const msg = "SLACK_ESCALATION_CHANNEL_ID not configured; skipping post.";
    console.warn(msg);
    return { ok: false, error: msg };
  }

  try {
    const text = buildEscalationMessage(ctx);
    await getMcpClient().callTool("slack_post_message", {
      channel_id: channelId,
      text,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Slack escalation post failed:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Read the most recent N messages from the escalation channel.
 * Used by the doctor dashboard to render a "Recent escalations" panel.
 * Returns an empty array on any failure — degrades silently so the
 * dashboard never crashes if Slack is offline.
 */
export async function getRecentEscalations(
  limit: number = 5
): Promise<RecentEscalation[]> {
  const channelId = process.env.SLACK_ESCALATION_CHANNEL_ID;
  if (!channelId) return [];

  try {
    const raw = await getMcpClient().callTool("slack_get_channel_history", {
      channel_id: channelId,
      limit,
    });

    // The Slack MCP returns Slack's conversations.history JSON
    // payload as a single text block — try to parse it.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("messages" in parsed) ||
      !Array.isArray((parsed as { messages: unknown }).messages)
    ) {
      return [];
    }

    const messages = (
      parsed as { messages: Array<{ ts?: string; text?: string }> }
    ).messages;

    return messages
      .filter((m) => typeof m.ts === "string" && typeof m.text === "string")
      .map<RecentEscalation>((m) => ({
        ts: m.ts!,
        postedAt: new Date(parseFloat(m.ts!) * 1000).toISOString(),
        text: m.text!,
      }));
  } catch (err) {
    console.error(
      "Failed to fetch Slack channel history:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}
