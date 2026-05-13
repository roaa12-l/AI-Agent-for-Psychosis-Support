/**
 * Runtime MCP client — spawns one stdio subprocess per upstream MCP
 * server, merges their tool catalogs, and routes tool calls back to
 * the right server. Used by `/api/respond`.
 *
 * Architecture:
 *   Next.js API route
 *     → AnchorMcpClient (this file)
 *         ├── google-calendar     (subprocess: @cocal/google-calendar-mcp)
 *         └── gmail               (subprocess: @gongrzhe/server-gmail-autoauth-mcp)
 *
 * Both subprocesses reuse the OAuth tokens cached by Claude Code's
 * one-time auth handshakes (separate token caches per server).
 *
 * SECURITY NOTE — defense in depth.
 * The Gmail MCP we use requests broader OAuth scopes than we need
 * (gmail.modify / gmail.settings.basic, not just gmail.readonly).
 * The off-the-shelf MCP exposes ~20 tools including send, draft,
 * delete, and label manipulation. Anchor's safety boundary is the
 * READ_ONLY_TOOLS allowlist below: tools not on this list are
 * filtered out before they ever reach Claude. Claude literally
 * cannot ask to send an email because it cannot see the tool. In
 * production, we would also reduce the OAuth grant by maintaining a
 * forked Gmail MCP that requests gmail.readonly only — but the
 * application-layer filter is the actual security control.
 *
 * Singleton via globalThis so Next.js HMR doesn't spawn fresh
 * subprocesses on every save during dev.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Read-only allowlist — the ONLY tools Anchor will ever expose to Claude.
 * Adding a new MCP server means adding its read tools here. Any tool not
 * on this list is filtered out of the listTools response, so the model
 * can't request it even by name.
 */
const READ_ONLY_TOOLS = new Set([
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

export type McpTool = {
  /** Server-qualified name as exposed to Claude */
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

/** Read each server's config from the project's `.mcp.json`. */
function buildServerSpecs(): ServerSpec[] {
  const credsPath = process.env.GOOGLE_OAUTH_CREDENTIALS;
  if (!credsPath) {
    throw new Error(
      "GOOGLE_OAUTH_CREDENTIALS env var is not set. Add it to .env.local."
    );
  }
  return [
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
  /** Tool name → which server owns it. Populated by listTools(). */
  private toolOwners: Map<string, string> = new Map();

  constructor() {
    this.servers = new Map();
    for (const spec of buildServerSpecs()) {
      this.servers.set(spec.name, new ServerHandle(spec));
    }
  }

  /**
   * Merged read-only tool catalog across every connected MCP. If one
   * server is unreachable we log and continue with whatever IS reachable —
   * a missing Gmail token shouldn't take Calendar verification down too.
   */
  async listTools(): Promise<McpTool[]> {
    const merged: McpTool[] = [];
    this.toolOwners.clear();

    for (const [serverName, handle] of this.servers) {
      try {
        const client = await handle.getClient();
        const { tools } = await client.listTools();
        for (const t of tools) {
          if (!READ_ONLY_TOOLS.has(t.name)) continue;
          if (this.toolOwners.has(t.name)) {
            // Name collision between servers — keep the first wins, log.
            console.warn(
              `MCP tool name collision: "${t.name}" exists on both ` +
                `${this.toolOwners.get(t.name)} and ${serverName}. ` +
                `Keeping the first.`
            );
            continue;
          }
          this.toolOwners.set(t.name, serverName);
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
   * Route a tool call to its owning MCP server. Throws if the tool is
   * unknown, on the writable-blocklist, or if the owning server fails.
   */
  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<string> {
    if (!READ_ONLY_TOOLS.has(name)) {
      throw new Error(
        `Tool "${name}" is not on the read-only allowlist. Refusing.`
      );
    }
    const ownerName = this.toolOwners.get(name);
    if (!ownerName) {
      throw new Error(
        `Tool "${name}" was requested before listTools() registered an owner. ` +
          `Did the upstream MCP server crash?`
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
