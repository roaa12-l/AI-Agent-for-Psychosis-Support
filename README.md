# Anchor

An AI agent that grounds psychosis patients with verifiable digital evidence — submission for **Korea Code Fair 2026**.

When a patient acts on a paranoid thought ("my boss fired me through coded emails", "the CIA is on my calendar today"), Anchor doesn't argue. It cross-checks the patient's actual Google Calendar, Gmail, and Drive via the Model Context Protocol (MCP) and replies with the real evidence. Crisis-level conversations escalate to the patient's clinician via Slack.

## Status

Prototype, in active development. See `build_guide.html` and `system_design.html` (in `~/Downloads/`) for the full design.

## Architecture

- **Frontend:** Next.js 16 (App Router) + Tailwind CSS — patient mobile chat at `/patient`, clinician dashboard at `/doctor`
- **AI:** Claude Sonnet 4.5 with tool-use, orchestrated server-side in `/api/respond`
- **Verification:** Real Google Calendar / Gmail / Drive via official MCP servers, OAuth'd to a fake "Min-jun" demo account
- **Doctor handoff:** Slack MCP posts to a private clinician channel on crisis escalation
- **Memory:** episode log in JSON for the demo (production target: Postgres / Supabase)

## Demo scenario (workplace paranoia)

Min-jun, 24, schizophrenia, stable on medication. At 9pm he texts the app:
> "I think my manager has been sending coded threats in his emails. He's planning to fire me tomorrow."

Anchor reads the actual Gmail thread, checks tomorrow's Calendar, sees the only meeting is a routine 1:1, and replies with the real evidence — gently, without arguing.

## Build milestones

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Foundation: Next.js skeleton + git | done |
| 2 | Google Calendar MCP connected via Claude Code | next |
| 3 | Patient chat UI + doctor dashboard skeleton | — |
| 4 | Runtime AI orchestration — `/api/respond` with tool-use | — |
| 5 | Add Gmail + Drive MCP | — |
| 6 | Slack MCP for clinician handoff | — |
| 7 | Polish + demo video | — |

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## License

Educational / contest use. Not a medical device. No clinical claims.
