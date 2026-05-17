/**
 * Episode store — persists every patient conversation to disk so the
 * doctor surfaces show real, accruing activity instead of fixture
 * placeholders.
 *
 * Storage: a single JSON file at `data/episodes.json` (gitignored).
 * On first read, if the file doesn't exist, it's bootstrapped from
 * `data/episodes.seed.json` (committed). New episodes from chat
 * conversations are appended in place.
 *
 * Session model: each conversation has a stable sessionId generated
 * client-side. The first turn of a session creates the episode; every
 * subsequent turn updates it (transcript, endedAt, severity, theme,
 * outcome). When the conversation hits a terminal state (crisis
 * escalation, turn cap, or page navigation), the episode is final.
 *
 * This is a JSON file, not a database, on purpose — the demo runs on
 * one machine, the data is small, and the file is human-readable for
 * inspection during the demo recording. Production would use Postgres.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ChatTurn, Severity } from "@/lib/min-jun";

const EPISODES_PATH = path.join(process.cwd(), "data", "episodes.json");
const SEED_PATH = path.join(process.cwd(), "data", "episodes.seed.json");

export type Episode = {
  /** Stable ID — `e_<random>` once generated, never changes */
  id: string;
  /** Stable session ID from the client; same conversation = same sessionId */
  sessionId: string;
  /** Patient ID — always "p_001" in the demo */
  patientId: string;
  /** ISO timestamp of the first user message */
  startedAt: string;
  /** ISO timestamp of the latest turn (user or AI) */
  endedAt: string;
  /** Round-up minutes between started and ended */
  durationMin: number;
  /** Number of AI responses in the conversation so far */
  aiTurns: number;
  /** Number of user messages */
  userTurns: number;
  /** Heuristic classification: workplace persecution / intrusion / family / etc. */
  theme: string;
  /** Severity per Severity union; "crisis" implies escalation fired */
  severity: Severity;
  /** One-sentence summary of how the conversation went */
  outcome: string;
  /** Number of MCP tool calls (calendar + gmail combined) */
  toolCallsCount: number;
  /** True if the crisis escalation path fired at any point */
  escalated: boolean;
  /** Full transcript — kept for audit + report rendering */
  transcript: ChatTurn[];
};

/** Read all episodes, sorted newest-first by startedAt. */
export async function readAllEpisodes(): Promise<Episode[]> {
  const raw = await loadEpisodeFile();
  return [...raw].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

/** Filter helper — episodes whose start is within `windowMs` of now. */
export async function readEpisodesInWindow(
  windowMs: number
): Promise<Episode[]> {
  const all = await readAllEpisodes();
  const cutoff = Date.now() - windowMs;
  return all.filter((e) => new Date(e.startedAt).getTime() >= cutoff);
}

/**
 * Record one turn of conversation. If no episode exists for the
 * sessionId, creates one; otherwise updates in place.
 *
 * Called from /api/respond after every successful response. Reasonably
 * inexpensive (reads + writes the whole file) — fine for one-patient
 * demo scale.
 */
export async function recordTurn(args: {
  sessionId: string;
  userMessage: string;
  aiMessage: string;
  toolCallsCount: number;
  escalated: boolean;
  startedAt: string;
}): Promise<Episode> {
  const all = await loadEpisodeFile();
  const now = new Date();
  const userTurn: ChatTurn = {
    role: "user",
    at: args.startedAt,
    text: args.userMessage,
  };
  const aiTurn: ChatTurn = {
    role: "ai",
    at: now.toISOString(),
    text: args.aiMessage,
  };

  const existingIdx = all.findIndex((e) => e.sessionId === args.sessionId);

  if (existingIdx === -1) {
    // First turn → create new episode
    const transcript: ChatTurn[] = [userTurn, aiTurn];
    const ep: Episode = {
      id: newEpisodeId(),
      sessionId: args.sessionId,
      patientId: "p_001",
      startedAt: args.startedAt,
      endedAt: aiTurn.at,
      durationMin: 1,
      aiTurns: 1,
      userTurns: 1,
      theme: classifyTheme(args.userMessage),
      severity: classifySeverity({
        userMessages: [args.userMessage],
        aiTurns: 1,
        toolCallsCount: args.toolCallsCount,
        escalated: args.escalated,
      }),
      outcome: buildOutcome({
        aiTurns: 1,
        toolCallsCount: args.toolCallsCount,
        escalated: args.escalated,
      }),
      toolCallsCount: args.toolCallsCount,
      escalated: args.escalated,
      transcript,
    };
    all.push(ep);
    await writeEpisodeFile(all);
    return ep;
  }

  // Update existing episode
  const ep = all[existingIdx];
  ep.transcript.push(userTurn, aiTurn);
  ep.endedAt = aiTurn.at;
  ep.aiTurns += 1;
  ep.userTurns += 1;
  ep.toolCallsCount += args.toolCallsCount;
  ep.escalated = ep.escalated || args.escalated;
  ep.durationMin = Math.max(
    1,
    Math.round(
      (new Date(ep.endedAt).getTime() - new Date(ep.startedAt).getTime()) /
        60000
    )
  );
  const allUserMessages = ep.transcript
    .filter((t): t is Extract<ChatTurn, { role: "user" }> => t.role === "user")
    .map((t) => t.text);
  // Theme: keep first turn's theme unless a later turn is clearer
  const refinedTheme = classifyTheme(allUserMessages.join("\n"));
  if (refinedTheme !== "general") ep.theme = refinedTheme;
  ep.severity = classifySeverity({
    userMessages: allUserMessages,
    aiTurns: ep.aiTurns,
    toolCallsCount: ep.toolCallsCount,
    escalated: ep.escalated,
  });
  ep.outcome = buildOutcome({
    aiTurns: ep.aiTurns,
    toolCallsCount: ep.toolCallsCount,
    escalated: ep.escalated,
  });
  all[existingIdx] = ep;
  await writeEpisodeFile(all);
  return ep;
}

// ─── Heuristic classifiers ────────────────────────────────────

const THEMES: Array<{ name: string; keywords: string[] }> = [
  {
    name: "workplace persecution",
    keywords: [
      "boss",
      "manager",
      "park",
      "fire",
      "fired",
      "firing",
      "coworker",
      "work",
      "office",
      "hr",
      "직장",
      "회사",
      "상사",
      "팀장",
    ],
  },
  {
    name: "intrusion",
    keywords: [
      "footsteps",
      "kitchen",
      "apartment",
      "lock",
      "door",
      "someone in",
      "intruder",
      "broke in",
      "발소리",
      "집에",
      "누가",
      "문",
    ],
  },
  {
    name: "family",
    keywords: [
      "mom",
      "dad",
      "mother",
      "father",
      "family",
      "sister",
      "brother",
      "엄마",
      "아빠",
      "가족",
      "누나",
      "형",
      "동생",
    ],
  },
  {
    name: "reference",
    keywords: [
      "news",
      "tv",
      "anchor on",
      "the news said",
      "they were talking about me",
      "뉴스",
      "방송",
    ],
  },
  {
    name: "persecution",
    keywords: [
      "following me",
      "watching me",
      "cia",
      "fbi",
      "police are after",
      "spying",
      "감시",
      "쫓아",
    ],
  },
];

function classifyTheme(text: string): string {
  const lower = text.toLowerCase();
  for (const t of THEMES) {
    if (t.keywords.some((kw) => lower.includes(kw))) return t.name;
  }
  return "general";
}

function classifySeverity(opts: {
  userMessages: string[];
  aiTurns: number;
  toolCallsCount: number;
  escalated: boolean;
}): Severity {
  if (opts.escalated) return "crisis";
  if (opts.aiTurns >= 6) return "high";
  if (opts.aiTurns >= 3 || opts.toolCallsCount > 0) return "moderate";
  return "low";
}

function buildOutcome(opts: {
  aiTurns: number;
  toolCallsCount: number;
  escalated: boolean;
}): string {
  if (opts.escalated) {
    return "Crisis keyword detected. Escalated to clinician via Slack handoff.";
  }
  if (opts.toolCallsCount > 0 && opts.aiTurns > 2) {
    return `Resolved across ${opts.aiTurns} turns with ${opts.toolCallsCount} verification${opts.toolCallsCount === 1 ? "" : "s"}. No escalation.`;
  }
  if (opts.toolCallsCount > 0) {
    return `Brief. Resolved with ${opts.toolCallsCount} verification check.`;
  }
  if (opts.aiTurns > 2) {
    return `${opts.aiTurns}-turn conversation. No verification needed.`;
  }
  return "Brief. No verification needed.";
}

// ─── File IO with seed bootstrap ──────────────────────────────

async function loadEpisodeFile(): Promise<Episode[]> {
  try {
    const raw = await fs.readFile(EPISODES_PATH, "utf8");
    const parsed = JSON.parse(raw) as Episode[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to read episodes.json:", err);
    }
    // Bootstrap from seed
    return bootstrapFromSeed();
  }
}

async function bootstrapFromSeed(): Promise<Episode[]> {
  let seed: Episode[] = [];
  try {
    const seedRaw = await fs.readFile(SEED_PATH, "utf8");
    seed = JSON.parse(seedRaw) as Episode[];
    if (!Array.isArray(seed)) seed = [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to read seed file:", err);
    }
  }
  await writeEpisodeFile(seed);
  return seed;
}

async function writeEpisodeFile(episodes: Episode[]): Promise<void> {
  await fs.mkdir(path.dirname(EPISODES_PATH), { recursive: true });
  await fs.writeFile(
    EPISODES_PATH,
    JSON.stringify(episodes, null, 2) + "\n",
    "utf8"
  );
}

function newEpisodeId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const t = Date.now().toString(36).slice(-4);
  return `e_${t}${rand}`;
}
