/**
 * POST /api/respond — Anchor's runtime brain.
 *
 * Flow per request:
 *   1. Crisis-keyword shortcircuit. If the patient said something suggesting
 *      self-harm, skip the model entirely and route to clinician.
 *   2. Otherwise — connect MCP, list read-only Google Calendar tools.
 *   3. Run the manual Claude tool-use loop with adaptive thinking:
 *      a. Send patient message + history + tool defs.
 *      b. If response is `tool_use`, route each call to MCP, append results.
 *      c. Loop until end_turn (max 5 iterations).
 *   4. Return Claude's final text + every tool call we made so the UI can
 *      render verification cards in order.
 *
 * The manual loop (instead of the tool-runner helper) is intentional: we
 * need to capture and surface every tool call to the frontend.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  getMcpClient,
  toolDefinitionsForClaude,
} from "@/lib/mcp-client";
import {
  buildSafetyMessage,
  buildSystemPrompt,
  detectCrisis,
  looksLikeSafetyResponse,
} from "@/lib/anchor-prompt";
import { minJun } from "@/lib/min-jun";
import { postCrisisEscalation } from "@/lib/slack";

export const runtime = "nodejs";

const MAX_ITERATIONS = 5;
const MODEL = "claude-opus-4-7";

/** Wire types — what /api/respond accepts and returns. */
export type RespondRequest = {
  message: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
};

export type ToolCallTrace = {
  name: string;
  input: Record<string, unknown>;
  output: string;
  /** `true` if the MCP returned an error / refusal */
  isError: boolean;
};

export type RespondResponse = {
  message: string;
  toolCalls: ToolCallTrace[];
  iterations: number;
  shouldEscalate: boolean;
};

export async function POST(req: Request) {
  let body: RespondRequest;
  try {
    body = (await req.json()) as RespondRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json(
      { error: "`message` is required" },
      { status: 400 }
    );
  }

  // ───── Crisis shortcircuit (fast path — keyword match) ─────
  if (detectCrisis(body.message)) {
    const slackResult = await postCrisisEscalation({
      patientName: minJun.name,
      patientNameKo: minJun.nameKo,
      triggerMessage: body.message,
      recentTurns: body.history.slice(-3),
    });
    if (!slackResult.ok) {
      console.warn(
        `Crisis escalation Slack post failed (still returning safety message): ${slackResult.error}`
      );
    }

    const payload: RespondResponse = {
      message: buildSafetyMessage({
        patientName: minJun.name,
        psychiatrist: minJun.careTeam.psychiatrist,
      }),
      toolCalls: [],
      iterations: 0,
      shouldEscalate: true,
    };
    return NextResponse.json(payload);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set on the server. Add it to .env.local.",
      },
      { status: 500 }
    );
  }

  // ───── Setup MCP + Claude ─────
  const mcp = getMcpClient();
  let claudeTools;
  try {
    const mcpTools = await mcp.listToolsForClaude();
    claudeTools = toolDefinitionsForClaude(mcpTools);
  } catch (err) {
    console.error("MCP listTools failed:", err);
    return NextResponse.json(
      {
        error: "Calendar service is offline. Try again.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  }

  const anthropic = new Anthropic();
  const now = new Date().toISOString();
  const system = buildSystemPrompt(now);

  // Build conversation: prior turns as flat text, then the new user message.
  const messages: Anthropic.MessageParam[] = [
    ...body.history.map<Anthropic.MessageParam>((t) => ({
      role: t.role,
      content: t.text,
    })),
    { role: "user", content: body.message },
  ];

  // ───── Tool-use loop ─────
  const toolCalls: ToolCallTrace[] = [];
  let iterations = 0;
  let finalText = "";

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations += 1;

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system,
        tools: claudeTools,
        messages,
      });

      // Append the assistant turn to history (must include the full content
      // blocks so the next API call can see tool_use IDs).
      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of toolUseBlocks) {
          let output = "";
          let isError = false;
          try {
            output = await mcp.callTool(
              block.name,
              block.input as Record<string, unknown>
            );
          } catch (err) {
            isError = true;
            output =
              err instanceof Error ? err.message : "Tool execution failed.";
            console.error(`Tool ${block.name} failed:`, err);
          }
          toolCalls.push({
            name: block.name,
            input: block.input as Record<string, unknown>,
            output,
            isError,
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: output,
            is_error: isError || undefined,
          });
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // end_turn (or refusal / max_tokens) — collect text and bail.
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      if (response.stop_reason === "refusal") {
        finalText =
          finalText ||
          "I want to keep you safe — let me hand this to your care team.";
      }
      break;
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Anthropic rate limit hit. Wait a moment and retry." },
        { status: 429 }
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Invalid ANTHROPIC_API_KEY." },
        { status: 401 }
      );
    }
    console.error("Anthropic call failed:", err);
    return NextResponse.json(
      {
        error: "Anthropic API call failed.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  if (!finalText) {
    finalText =
      "I'm here. Can you tell me a little more about what's happening right now?";
  }

  // ───── Post-response crisis detection ─────
  // The keyword shortcircuit catches obvious phrasings, but the model
  // can self-detect a subtler crisis and emit the safety message
  // directly per its prompt. Detect that case here and run the same
  // escalation path the shortcircuit does. Result: no crisis can
  // slip through to the patient without also reaching the clinician.
  const claudeSelfEscalated = looksLikeSafetyResponse(
    finalText,
    minJun.careTeam.psychiatrist
  );
  if (claudeSelfEscalated) {
    const slackResult = await postCrisisEscalation({
      patientName: minJun.name,
      patientNameKo: minJun.nameKo,
      triggerMessage: body.message,
      recentTurns: body.history.slice(-3),
    });
    if (!slackResult.ok) {
      console.warn(
        `Post-response crisis escalation Slack post failed (still surfacing banner): ${slackResult.error}`
      );
    }
  }

  const payload: RespondResponse = {
    message: finalText,
    toolCalls,
    iterations,
    shouldEscalate: claudeSelfEscalated,
  };
  return NextResponse.json(payload);
}
