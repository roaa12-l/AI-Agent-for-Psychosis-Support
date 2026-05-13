/**
 * Runtime MCP client — used by `/api/respond` to talk to the same Google
 * Calendar MCP server that Claude Code uses at dev-time.
 *
 * Architecture:
 *   Next.js API route
 *     → AnchorMcpClient (this file)
 *         → spawns `npx @cocal/google-calendar-mcp` over stdio
 *             → reuses the OAuth token cached by Claude Code's auth flow
 *
 * Singleton via globalThis so Next.js HMR doesn't spawn a fresh subprocess
 * on every save during dev.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Read-only allowlist. The patient surface must never let the AI mutate
 * the patient's calendar. Filtering at the client boundary means we don't
 * have to trust the model.
 */
const READ_ONLY_CALENDAR_TOOLS = new Set([
  "list-events",
  "search-events",
  "get-event",
  "get-current-time",
  "list-calendars",
  "get-freebusy",
  "list-colors",
]);

export type McpTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

class AnchorMcpClient {
  private client: Client | null = null;
  private connecting: Promise<Client> | null = null;

  /** Lazy connect; reuse the connection across requests. */
  private async getClient(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const credsPath = process.env.GOOGLE_OAUTH_CREDENTIALS;
      if (!credsPath) {
        throw new Error(
          "GOOGLE_OAUTH_CREDENTIALS env var is not set. Add it to .env.local."
        );
      }

      const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@cocal/google-calendar-mcp@latest"],
        env: {
          ...(process.env as Record<string, string>),
          GOOGLE_OAUTH_CREDENTIALS: credsPath,
        },
      });

      const client = new Client(
        { name: "anchor-runtime", version: "0.1.0" },
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

  /** All read-only Google Calendar tools available to Claude. */
  async listTools(): Promise<McpTool[]> {
    const client = await this.getClient();
    const result = await client.listTools();
    return result.tools
      .filter((t) => READ_ONLY_CALENDAR_TOOLS.has(t.name))
      .map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown>,
      }));
  }

  /**
   * Call a tool by name. Throws if Claude tries to call a write tool
   * (which it shouldn't, since we never advertise them).
   */
  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<string> {
    if (!READ_ONLY_CALENDAR_TOOLS.has(name)) {
      throw new Error(
        `Tool "${name}" is not on the read-only allowlist. Refusing.`
      );
    }
    const client = await this.getClient();
    const result = await client.callTool({ name, arguments: args });

    // MCP tools return content blocks; flatten to a single string for Claude.
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
