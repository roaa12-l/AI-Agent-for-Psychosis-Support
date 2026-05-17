/**
 * Runtime MCP client — spawns one stdio subprocess per upstream MCP
 * server, merges their tool catalogs, and routes tool calls back to
 * the right server. Used by `/api/respond` and by server-side
 * helpers (e.g. lib/slack.ts).
 *
 * Architecture:
 *   Next.js API route
 *     → AnchorMcpClient (this file)
 *         ├── google-calendar     (subprocess: @cocal/google-calendar-mcp)
 *         ├── gmail               (subprocess: @gongrzhe/server-gmail-autoauth-mcp)
 *         └── slack               (subprocess: @modelcontextprotocol/server-slack)
 *
 * SECURITY MODEL — two distinct allowlists.
 *
 * `CLAUDE_ALLOWED_TOOLS` is the read-only subset of tools that Anchor
 * exposes to the Claude model via `listToolsForClaude()`. Tools not
 * on this list are NEVER seen by the model — it can't reference what
 * it can't see. This means the patient-facing AI is structurally
 * incapable of asking to send email or post to Slack.
 *
 * `SERVER_ALLOWED_TOOLS` is the wider set the trusted server-side
 * code is permitted to call directly via `callTool()`. It is a
 * superset of `CLAUDE_ALLOWED_TOOLS` plus the action-oriented tools
 * we need for clinician handoff (slack_post_message,
 * slack_get_channel_history). Server code authors this list
 * explicitly; nothing outside it ever runs.
 *
 * Singleton via globalThis so Next.js HMR doesn't spawn fresh
 * subprocesses on every save during dev.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tools the Claude model is allowed to see and call.
 * Strictly read-only across every MCP server.
 */
const CLAUDE_ALLOWED_TOOLS = new Set([
  // Google Calendar (@cocal/google-calendar-mcp)
  "list-events",
  "search-events",
  "get-event",
  "get-current-time",
  "list-calendars",
  "get-freebusy",
  "list-colors",

  // Gmail (@gongrzhe/server-gmail-autoauth-mcp) — read-only subset
  "read_email",
  "search_emails",
  "list_email_labels",
]);

/**
 * Tools the trusted server side (route handlers, lib/slack.ts) may
 * call directly. Superset of CLAUDE_ALLOWED_TOOLS plus actions
 * required for clinician handoff and dashboards.
 */
const SERVER_ALLOWED_TOOLS = new Set([
  ...CLAUDE_ALLOWED_TOOLS,
  // Slack — server-only. The patient-facing model never sees these.
  "slack_post_message",
  "slack_get_channel_history",
  "slack_list_channels",
]);

export type McpTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

type ServerSpec = {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
};

/**
 * Build the set of MCP subprocesses to spawn. Slack is conditional:
 * if SLACK_BOT_TOKEN isn't set we skip it (the app still works —
 * Calendar + Gmail verification keeps running; only escalation is
 * silently no-op'd).
 */
function buildServerSpecs(): ServerSpec[] {
  const credsPath = process.env.GOOGLE_OAUTH_CREDENTIALS;
  if (!credsPath) {
    throw new Error(
      "GOOGLE_OAUTH_CREDENTIALS env var is not set. Add it to .env.local."
    );
  }

  const specs: ServerSpec[] = [
    {
      name: "google-calendar",
      command: "npx",
      args: ["-y", "@cocal/google-calendar-mcp@latest"],
      env: { GOOGLE_OAUTH_CREDENTIALS: credsPath },
    },
    {
      name: "gmail",
      command: "npx",
      args: ["-y", "@gongrzhe/server-gmail-autoauth-mcp"],
      env: { GMAIL_OAUTH_PATH: credsPath },
    },
  ];

  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  const slackTeamId = process.env.SLACK_TEAM_ID;
  if (slackBotToken && slackTeamId) {
    specs.push({
      name: "slack",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-slack"],
      env: {
        SLACK_BOT_TOKEN: slackBotToken,
        SLACK_TEAM_ID: slackTeamId,
      },
    });
  } else {
    console.warn(
      "Slack MCP not spawned — SLACK_BOT_TOKEN or SLACK_TEAM_ID missing. " +
        "Clinician escalation will no-op."
    );
  }

  return specs;
}

class ServerHandle {
  private client: Client | null = null;
  private connecting: Promise<Client> | null = null;
  readonly spec: ServerSpec;

  constructor(spec: ServerSpec) {
    this.spec = spec;
  }

  async getClient(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const transport = new StdioClientTransport({
        command: this.spec.command,
        args: this.spec.args,
        env: {
          ...(process.env as Record<string, string>),
          ...this.spec.env,
        },
      });
      const client = new Client(
        { name: `anchor-runtime/${this.spec.name}`, version: "0.1.0" },
        { capabilities: {} }
      );
      await client.connect(transport);
      this.client = client;
      return client;
    })();

    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }
}

class AnchorMcpClient {
  private servers: Map<string, ServerHandle>;
  /** Tool name → server that owns it. Populated lazily on first listTools(). */
  private toolOwners: Map<string, string> = new Map();
  private ownersReady: Promise<void> | null = null;

  constructor() {
    this.servers = new Map();
    for (const spec of buildServerSpecs()) {
      this.servers.set(spec.name, new ServerHandle(spec));
    }
  }

  /**
   * Walk every server's catalog to populate toolOwners. Must run
   * before callTool() can dispatch by name; listToolsForClaude()
   * does this implicitly. Server-only callers should hit
   * ensureOwners() first.
   */
  private async ensureOwners(): Promise<void> {
    if (this.ownersReady) return this.ownersReady;
    this.ownersReady = (async () => {
      for (const [serverName, handle] of this.servers) {
        try {
          const client = await handle.getClient();
          const { tools } = await client.listTools();
          for (const t of tools) {
            if (this.toolOwners.has(t.name)) continue;
            this.toolOwners.set(t.name, serverName);
          }
        } catch (err) {
          console.error(
            `Failed to load tool catalog from MCP "${serverName}":`,
            err instanceof Error ? err.message : err
          );
        }
      }
    })();
    return this.ownersReady;
  }

  /**
   * Tool catalog filtered to what Claude is allowed to see.
   * Patient-facing model never sees write tools or Slack tools.
   */
  async listToolsForClaude(): Promise<McpTool[]> {
    await this.ensureOwners();
    const merged: McpTool[] = [];
    for (const [serverName, handle] of this.servers) {
      try {
        const client = await handle.getClient();
        const { tools } = await client.listTools();
        for (const t of tools) {
          if (!CLAUDE_ALLOWED_TOOLS.has(t.name)) continue;
          merged.push({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema as Record<string, unknown>,
          });
        }
      } catch (err) {
        console.error(
          `Failed to load tools from MCP "${serverName}":`,
          err instanceof Error ? err.message : err
        );
      }
    }
    return merged;
  }

  /**
   * Dispatch a tool call by name to its owning MCP server.
   * Refuses anything not on SERVER_ALLOWED_TOOLS, so even buggy
   * server code can't run an arbitrary MCP tool.
   */
  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<string> {
    if (!SERVER_ALLOWED_TOOLS.has(name)) {
      throw new Error(
        `Tool "${name}" is not on the server allowlist. Refusing.`
      );
    }
    await this.ensureOwners();
    const ownerName = this.toolOwners.get(name);
    if (!ownerName) {
      throw new Error(
        `Tool "${name}" has no registered owner. Either it doesn't exist ` +
          `on any connected MCP, or that MCP failed to start.`
      );
    }
    const handle = this.servers.get(ownerName);
    if (!handle) {
      throw new Error(`No server handle for owner "${ownerName}"`);
    }
    const client = await handle.getClient();
    const result = await client.callTool({ name, arguments: args });

    const content = (result.content ?? []) as Array<{
      type: string;
      text?: string;
    }>;
    return content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
  }
}

/** Convert MCP tools to Anthropic API tool definitions. */
export function toolDefinitionsForClaude(
  mcpTools: McpTool[]
): Anthropic.ToolUnion[] {
  return mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));
}

// Singleton across HMR
const globalForMcp = globalThis as unknown as { __anchorMcp?: AnchorMcpClient };

export function getMcpClient(): AnchorMcpClient {
  if (!globalForMcp.__anchorMcp) {
    globalForMcp.__anchorMcp = new AnchorMcpClient();
  }
  return globalForMcp.__anchorMcp;
}
