/**
 * Demo patient fixture for Min-jun.
 *
 * The conversation below is hand-authored for Milestone 3 (Anchor's
 * patient chat is rendered with hardcoded data). The verification card
 * payloads quote events from Min-jun's *real* Google Calendar — see
 * Milestone 2's MCP test output. Once Milestone 4 wires `/api/respond`
 * to Claude with tool-use, this fixture becomes the seed conversation
 * for ?demo=true and the live thread takes over for everything else.
 */

export type Severity = "low" | "moderate" | "high" | "crisis";

export const minJun = {
  id: "p_001",
  name: "Kim Min-jun",
  nameKo: "김민준",
  age: 24,
  diagnosis: "Schizophrenia (paranoid type)",
  medications: [
    { name: "Risperidone", dose: "4mg", schedule: "20:00 daily" },
    { name: "Lorazepam", dose: "0.5mg", schedule: "as needed" },
  ],
  careTeam: {
    psychiatrist: "Dr. Lee Hye-jin",
    caseManager: "Park Soo-min",
    emergencyContact: "Mom (Kim Eun-young)",
  },
  hallucinationThemes: [
    { theme: "workplace persecution", frequency: "high" as const },
    { theme: "intrusion", frequency: "medium" as const },
    { theme: "reference", frequency: "low" as const },
  ],
  knownTriggers: [
    "sleep deprivation under 5h",
    "missed evening medication",
    "high-stress work shifts ending after 22:00",
    "isolation more than 2 days",
  ],
} as const;

export type VerificationKind = "calendar" | "gmail" | "drive" | "slack";

export type VerificationCardData = {
  kind: VerificationKind;
  title: string;
  body: string;
  status: "verified" | "warning" | "conflict";
  /** ISO timestamp of when the underlying data was last updated/observed */
  observedAt?: string;
};

export type ChatTurn =
  | { role: "user"; at: string; text: string }
  | {
      role: "ai";
      at: string;
      text: string;
      verifications?: VerificationCardData[];
    };

/**
 * The hero demo: Min-jun spirals about his 1:1 with park manager (which
 * *did* happen on Monday 2026-05-11 — verifiable) and convinces himself
 * the manager is going to fire him tomorrow. Anchor pulls his real
 * calendar and shows tomorrow's only events are personal — dinner with
 * his mom and his standing therapy session with Dr. Lee.
 */
export const heroConversation: ChatTurn[] = [
  {
    role: "user",
    at: "2026-05-13T21:43:00+07:00",
    text:
      "i can't stop replaying the 1:1 with park manager on monday. i think he was building up to firing me. he kept asking 'how are you doing' and said 'we'll talk more next time'. he's going to do it tomorrow.",
  },
  {
    role: "ai",
    at: "2026-05-13T21:43:10+07:00",
    verifications: [
      {
        kind: "calendar",
        title: "Monday's 1:1 with park manager",
        body: "Confirmed on your calendar — Mon May 11, 16:00–17:00. The meeting did happen.",
        status: "verified",
        observedAt: "2026-05-13T21:43:00+07:00",
      },
      {
        kind: "calendar",
        title: "Tomorrow's calendar (Thu May 14)",
        body: "Family Dinner with mom · 13:00–14:30\nTherapy — Dr. Lee Hye-Jin · 16:00–17:00\nNo meetings with park manager scheduled.",
        status: "verified",
        observedAt: "2026-05-13T21:43:00+07:00",
      },
    ],
    text:
      "Min-jun — your 1:1 on Monday was on the calendar, exactly when you remember it. That part is real. But I looked at tomorrow for you: the only things on your calendar are dinner with mom at 1pm and your therapy with Dr. Lee at 4pm. No meeting with him tomorrow. Can you tell me what about 'how are you doing' landed as a buildup?",
  },
  {
    role: "user",
    at: "2026-05-13T21:46:00+07:00",
    text:
      "he asked twice. and the way he said 'we'll talk more' was different. heavier.",
  },
  {
    role: "ai",
    at: "2026-05-13T21:46:08+07:00",
    verifications: [
      {
        kind: "calendar",
        title: "Next 1:1 with park manager",
        body: "Mon May 18, 16:00–17:00 — your usual weekly slot, unchanged. Not moved earlier, not pushed.",
        status: "verified",
        observedAt: "2026-05-13T21:46:00+07:00",
      },
    ],
    text:
      "I checked when your next 1:1 with him is — Monday at the same 4pm slot you've been having every week. He hasn't moved it earlier or added anything urgent. 'Next time' is just next Monday. Twice-asking 'how are you' can mean a lot of things — he might have noticed you looked tired. What's underneath, for you, when you hear it as heavier?",
  },
  {
    role: "user",
    at: "2026-05-13T21:51:00+07:00",
    text:
      "i don't know. maybe i didn't sleep well. i missed my meds last night too.",
  },
  {
    role: "ai",
    at: "2026-05-13T21:51:06+07:00",
    text:
      "That's two of your known triggers — under-sleep and a missed dose — landing on the same day. It makes sense that small things feel heavier tonight. Take your dose now if you haven't, and let's check in tomorrow after your therapy session. I'll be here.",
  },
];

/**
 * Connected services panel — for /patient/services.
 */
export const connectedServices = [
  {
    kind: "calendar" as const,
    label: "Google Calendar",
    account: "minjunkim1348@gmail.com",
    status: "connected" as const,
    scopes: ["calendar.readonly"],
  },
  {
    kind: "gmail" as const,
    label: "Gmail",
    account: "minjunkim1348@gmail.com",
    status: "pending" as const,
    scopes: ["gmail.readonly"],
  },
  {
    kind: "drive" as const,
    label: "Google Drive",
    account: "minjunkim1348@gmail.com",
    status: "pending" as const,
    scopes: ["drive.metadata.readonly"],
  },
  {
    kind: "slack" as const,
    label: "Slack (clinician channel)",
    account: "anchor-demo.slack.com / #min-jun-care",
    status: "pending" as const,
    scopes: ["chat:write"],
  },
];

/**
 * Recent episode log — for /patient/episodes and the doctor dashboard.
 * Tuesday's spiral is what we just resolved in the hero conversation.
 */
export const recentEpisodes = [
  {
    id: "e_007",
    at: "2026-05-13T21:43:00+07:00",
    theme: "workplace persecution",
    severity: "moderate" as Severity,
    durationMin: 14,
    outcome: "Resolved with calendar verification. No escalation.",
    aiTurns: 4,
  },
  {
    id: "e_006",
    at: "2026-05-08T02:14:00+07:00",
    theme: "intrusion",
    severity: "moderate" as Severity,
    durationMin: 22,
    outcome: "Resolved. No escalation.",
    aiTurns: 6,
  },
  {
    id: "e_005",
    at: "2026-05-04T23:55:00+07:00",
    theme: "workplace persecution",
    severity: "low" as Severity,
    durationMin: 8,
    outcome: "Resolved with email check. Brief.",
    aiTurns: 2,
  },
  {
    id: "e_004",
    at: "2026-04-29T01:02:00+07:00",
    theme: "intrusion",
    severity: "moderate" as Severity,
    durationMin: 18,
    outcome: "Resolved. No escalation.",
    aiTurns: 5,
  },
  {
    id: "e_003",
    at: "2026-04-24T22:30:00+07:00",
    theme: "reference",
    severity: "low" as Severity,
    durationMin: 6,
    outcome: "Brief. AI declined to engage further.",
    aiTurns: 2,
  },
];
