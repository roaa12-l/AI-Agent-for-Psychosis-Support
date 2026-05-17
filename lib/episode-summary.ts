/**
 * AI-generated weekly summary for the doctor's report page.
 *
 * Replaces the hardcoded summary paragraphs with a live Claude call
 * over the actual episode log. The prompt instructs Claude to write
 * in clinical case-note prose — short, factual, two paragraphs.
 *
 * Best-effort: any failure returns a fallback static line so the
 * report page never crashes. Token cost is minimal — episodes are
 * summarized as compact JSON; the system prompt is small and cacheable.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Episode } from "./episodes";
import { minJun } from "./min-jun";

export async function generateWeeklySummary(
  episodes: Episode[]
): Promise<string> {
  if (episodes.length === 0) {
    return "No episodes logged in this period. Patient has not initiated any conversations with Anchor.";
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackSummary(episodes);
  }

  try {
    const compact = episodes.map((e) => ({
      at: e.startedAt,
      theme: e.theme,
      severity: e.severity,
      durationMin: e.durationMin,
      aiTurns: e.aiTurns,
      toolCallsCount: e.toolCallsCount,
      escalated: e.escalated,
      outcome: e.outcome,
    }));

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 600,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Patient: ${minJun.name}, ${minJun.age}, ${minJun.diagnosis}.\n\nEpisodes (newest first), as JSON:\n${JSON.stringify(compact, null, 2)}\n\nWrite the summary now.`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return text || fallbackSummary(episodes);
  } catch (err) {
    console.error(
      "Weekly summary generation failed:",
      err instanceof Error ? err.message : err
    );
    return fallbackSummary(episodes);
  }
}

const SYSTEM_PROMPT = `
You write 2-paragraph clinical case-note summaries of a psychotic-disorder patient's recent episodes for the patient's psychiatrist.

STYLE:
  - Clinical-professional. The reader is a psychiatrist reviewing between sessions.
  - Concrete. Cite counts ("3 of the 5 episodes..."), times ("most clustered 22:00–02:00"), themes ("workplace persecution"), trigger correlations.
  - Brief. Two paragraphs, ~3–5 sentences each. No preamble, no greeting.
  - Plain prose. No markdown formatting, no lists, no headings.
  - Honest about uncertainty — say "I cannot determine X from this data" when true.

PARAGRAPH 1: pattern analysis. Theme clustering, time-of-day clustering, severity distribution.

PARAGRAPH 2: clinical observations and a single concrete recommendation if warranted. May reference patient's known triggers (under-sleep, missed evening Risperidone, late shifts, isolation).

CONSTRAINTS:
  - Do not invent details that aren't in the episode data.
  - Do not give a diagnosis or treatment plan — only observations.
  - If the data is too sparse to draw conclusions (fewer than 3 episodes), say so explicitly in paragraph 1, then offer paragraph 2 as a brief observation only.
`.trim();

function fallbackSummary(episodes: Episode[]): string {
  const themes = new Map<string, number>();
  for (const e of episodes) themes.set(e.theme, (themes.get(e.theme) ?? 0) + 1);
  const sorted = [...themes.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const crisisCount = episodes.filter((e) => e.escalated).length;
  return (
    `${episodes.length} episodes logged. ` +
    (top
      ? `Most common theme: ${top[0]} (${top[1]} occurrence${top[1] === 1 ? "" : "s"}). `
      : "") +
    (crisisCount > 0
      ? `${crisisCount} crisis escalation${crisisCount === 1 ? "" : "s"} routed to clinician.`
      : "No crisis escalations in this period.")
  );
}
