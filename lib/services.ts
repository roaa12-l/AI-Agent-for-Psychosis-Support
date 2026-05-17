/**
 * Connected-services status — what the patient surfaces in
 * /patient/services. Derived live from env vars and on-disk tokens
 * so the screen always reflects reality, not a hand-curated mock.
 *
 * Server-only helper. Calls fs and reads process.env.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export type ServiceKind = "calendar" | "gmail" | "drive" | "slack";
export type ServiceStatus = "connected" | "pending" | "error";

export type ConnectedService = {
  kind: ServiceKind;
  label: string;
  account: string;
  status: ServiceStatus;
  scopes: string[];
  /** Short human-readable note about *why* the status is what it is */
  detail: string;
};

const MINJUN_EMAIL = "minjunkim1348@gmail.com";

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function getConnectedServices(): Promise<ConnectedService[]> {
  const home = os.homedir();

  // Calendar — @cocal/google-calendar-mcp caches tokens under
  // ~/.config/google-calendar-mcp/tokens.json after the auth flow.
  // Also need GOOGLE_OAUTH_CREDENTIALS to point to a real file.
  const calCreds = process.env.GOOGLE_OAUTH_CREDENTIALS ?? "";
  const calCredsExists = calCreds ? await fileExists(calCreds) : false;
  const calTokensExists = await fileExists(
    path.join(home, ".config", "google-calendar-mcp", "tokens.json")
  );
  const calendar: ConnectedService = {
    kind: "calendar",
    label: "Google Calendar",
    account: MINJUN_EMAIL,
    status:
      calCredsExists && calTokensExists
        ? "connected"
        : calCredsExists
          ? "error"
          : "pending",
    scopes: ["calendar.readonly"],
    detail:
      calCredsExists && calTokensExists
        ? "Read-only. Used by Anchor to verify schedule and meeting claims."
        : calCredsExists
          ? "OAuth credentials found, but token cache missing — re-run auth."
          : "Not connected.",
  };

  // Gmail — @gongrzhe/server-gmail-autoauth-mcp caches at
  // ~/.gmail-mcp/credentials.json after the auth flow. Same OAuth
  // credentials file as Calendar (multi-scope grant).
  const gmailTokensExists = await fileExists(
    path.join(home, ".gmail-mcp", "credentials.json")
  );
  const gmail: ConnectedService = {
    kind: "gmail",
    label: "Gmail",
    account: MINJUN_EMAIL,
    status:
      calCredsExists && gmailTokensExists
        ? "connected"
        : calCredsExists
          ? "error"
          : "pending",
    scopes: ["gmail.readonly (enforced at app layer)"],
    detail:
      calCredsExists && gmailTokensExists
        ? "Read-only for inbox search. Write tools blocked by app allowlist."
        : "Run the Gmail MCP auth command to connect.",
  };

  // Drive — described as roadmap; not implemented.
  const drive: ConnectedService = {
    kind: "drive",
    label: "Google Drive",
    account: MINJUN_EMAIL,
    status: "pending",
    scopes: ["drive.metadata.readonly"],
    detail:
      "Roadmap. Will verify file edit history for sabotage-paranoia claims.",
  };

  // Slack — bot token + team ID + channel ID all need to be set.
  const slackBot = !!process.env.SLACK_BOT_TOKEN;
  const slackTeam = !!process.env.SLACK_TEAM_ID;
  const slackChannel = !!process.env.SLACK_ESCALATION_CHANNEL_ID;
  const slackAll = slackBot && slackTeam && slackChannel;
  const slack: ConnectedService = {
    kind: "slack",
    label: "Slack (clinician channel)",
    account: slackChannel
      ? `Workspace ${process.env.SLACK_TEAM_ID} · channel ${process.env.SLACK_ESCALATION_CHANNEL_ID}`
      : "Not configured",
    status: slackAll ? "connected" : "pending",
    scopes: ["chat:write", "groups:write", "groups:history"],
    detail: slackAll
      ? "Anchor posts crisis escalations to #min-jun-care. Doctor dashboard reads them back."
      : "Bot token / team / channel env var missing.",
  };

  return [calendar, gmail, drive, slack];
}
