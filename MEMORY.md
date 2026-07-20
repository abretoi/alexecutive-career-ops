# Alexecutive Career Ops Memory Index

Loaded into Claude's context each session. One line per entry (~150 chars max).

## Project
- [Alexecutive Career Ops overview](CLAUDE.md) — AI career command center, all industries, non-technical audience, Apple-style dark UI
- [Feature overview](README.md) — Core, Outreach, Interview Prep, Analytics feature tables; 12 HR-analytics features implemented
- [Setup guide](SETUP.md) — Installation steps + full features reference including Career Tools

## AI Providers & Rate Limiting (Jul 2 2026)
- 9 providers: anthropic, nvidia (recommended free — model IDs need org prefix e.g. meta/llama-3.3-70b-instruct), openai, llama, ollama, groq, openrouter, gemini, custom
- Request governor in aiAdapter.js: per-provider RPM+concurrency token bucket + 429/503 retry; NVIDIA 36 RPM / 4 concurrent, maxOut 4096
- Per-provider key map `config.aiKeys` — deep-merged on save; switching providers never loses keys
- Batch scoring: `quickScoreBatch()` scores 8 jobs/call; failures return score null (unrated), never a fake 2.5

## Job Boards (audited Jul 2 2026)
- Working: LinkedIn, Indeed (jobspy), Greenhouse (74 cos), Lever, Ashby (official posting API), Wellfound, YC, startup.jobs, Welcome to the Jungle, Cord, Built In, Remotive
- Blocked upstream (marked in UI): Glassdoor (400), ZipRecruiter (403); Google for Jobs = beta
- Removed (dead feeds): Remote.co, Just Remote, 4 Day Week, Remote Rocketship, JobAlert, HR Jobs Remote, 80,000 Hours, Idealist, Dataaxy
- Multi-keyword "A OR B" split by kwMatcher(); board audit hook: `_boards` export in jobSearch.js

## Sessions
- New Session (keeps profile) + Full Reset (wipes apps/resume/profile/cover letter; AI keys kept; snapshot auto-saved first)

## Writing Style & Voice
- 8 writing styles: Professional, Formal, Technical, Executive, Conversational, Creative, Concise, Academic
- Stored in `data/writing-style.json`; selected in Resume & CV view via pill picker
- Cover letter sample upload stored in `data/cover-letter.json`; feeds voice-mirroring in `generateApplicationPacket()`
- Both settings are passed into every Application Packet (batch apply) generation call

## User Profile
*(populated during onboarding — Claude will add entries here)*

## Feedback
*(corrections and confirmations from the user — Claude will add entries here)*

## References
- [ATS Rules](docs/ATS-RULES.md) — Single-column, standard headers, keyword mirroring rules
- [15 Industry Archetypes](docs/ARCHETYPES.md) — Evaluation lenses and scoring weight adjustments
- [LinkedIn Guide](docs/LINKEDIN-GUIDE.md) — Headline, About, bullets, skills optimization playbook
- [Application States](templates/states.yml) — Canonical status values for tracker
