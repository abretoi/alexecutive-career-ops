# Alexecutive Career Ops — Development Context

## What This Project Is

Self-hosted web app — browser-based career command center. NOT a Claude Code plugin. Users interact exclusively via browser at `http://localhost:3000`.

Express.js backend + vanilla JS SPA + provider-agnostic AI + multi-board job search.

## Stack

| Layer | Tech |
|---|---|
| Server | Node.js 20+ / Express 4 / ESM |
| AI | Provider-agnostic via `aiAdapter.js` — Anthropic, Ollama, OllamaCloud, NVIDIA, Groq, OpenRouter, Gemini, OpenAI, Llama, custom |
| Job Search | 25+ boards: JobSpy (LinkedIn/Indeed), Greenhouse/Lever/Ashby, open-web aggregators, direct company APIs, session-backed Glassdoor/ZipRecruiter/Google |
| Storage | JSON files in `data/` (gitignored) |
| Frontend | Vanilla JS ES modules — no build step; served from `public/` |
| File Upload | multer → pdf-parse (PDF) / mammoth (DOCX) |
| DOCX Export | `docx` npm package |
| Streaming | SSE for live job search results |

## Design System

Apple dark theme — black backgrounds (`#000`, `#0a0a0c`, `#131316`, `#1c1c20`) with blue/teal/green gradient palette. No emoji — inline SVGs only.

Key tokens: `--grad: linear-gradient(120deg, #0a84ff, #06b6d4 50%, #30d158)`, `--ease: cubic-bezier(.32,.72,0,1)`. Cards use `::before` 2px accent bar + `::after` radial glow via `color-mix(in oklab,...)`.

**Topbar**: 3-column grid (`1fr auto 1fr`) — `#page-title` left, `.app-title` gradient center, `.topbar-right` (Export + Evaluate) right.

**Resume Style Preservation**: `parseResumeText()` extracts `styleMetadata` (format, sectionOrder, bulletStyle, headerStyle, dateFormat, tone). `tailorResume()` mirrors original style exactly — never imposes a new template.

## Project Structure

```
server/
├── index.js                 Main Express server (port 3000)
├── routes/
│   ├── jobs.js              /api/jobs/* — search (SSE), evaluate, tailor, auto-apply, application-packet, recommend, salary-estimate
│   ├── resume.js            /api/resume/* — upload, paste, ats-check, export/pdf/docx, cover-letter, chain/diagnoser|recruiter|rewriter|hiring-manager
│   ├── tracker.js           /api/tracker/* — CRUD + export/pdf + export/docx
│   ├── profile.js           /api/profile/* — profile, config, LinkedIn, scrape-url, providers, ollama-status
│   ├── platforms.js         /api/platforms/* — connect, disconnect, sync (LinkedIn/Indeed/Glassdoor/Google/Monster/Dice/Wellfound/CareerBuilder)
│   ├── outreach.js          /api/outreach/* — linkedin-request, cold-email, referral-ask, followup
│   ├── interview.js         /api/interview/* — star-answers, company-brief, tech-qa, mock-feedback
│   ├── analytics.js         /api/analytics/* — pipeline, skills-gap, blind-spots
│   ├── company.js           /api/company/intel
│   ├── offers.js            /api/offers/* — analyze, negotiate
│   ├── contacts.js          /api/contacts/* — CRUD + /:id/outreach
│   ├── alerts.js            /api/alerts/* — CRUD saved search alerts
│   └── resume-versions.js   /api/resume-versions/* — CRUD + /:id/set-active
├── services/
│   ├── aiAdapter.js         callFast()/callPower()/PROVIDERS/governedCall — all AI flows through here
│   ├── claude.js            All AI prompt functions — no direct SDK references
│   ├── jobSearch.js         Multi-board orchestration; inferCareerLevel(); scoreKeywords()
│   ├── hybridRank.js        BM25 + 512-dim feature-hash embedding; blend 0.55/0.45; zero API calls
│   ├── autoApplyBot.js      Playwright 1-click apply; ATS_SELECTORS per ATS type; SSE streaming
│   ├── platformSessions.js  Persistent Playwright sessions; createContextWithSession()
│   ├── docxExport.js        buildResumeDocx/CoverLetterDocx/ApplicationsDocx
│   ├── keywordScorer.js     TF-IDF (skills=3, exp=2, summary=1)
│   ├── broadSearch.js       Open-web aggregators (Muse, Arbeitnow, RemoteOK, Himalayas, Jobicy)
│   ├── companySites.js      Direct company career APIs (Amazon + 16 Workday tenants)
│   ├── companyRegistry.js   ~90 S&P500/NASDAQ100 companies → correct ATS backend
│   ├── googleJobs.js        Session-backed Google Jobs (off-screen headed Playwright)
│   ├── sessionBoardSearch.js Session-backed Glassdoor/ZipRecruiter search
│   └── jobspy_runner.py     Python JobSpy subprocess — NOT jobspy.py (self-import bug if named that)
└── db/
    ├── dataStore.js         JSON file read/write
    └── sessionStore.js      Named session snapshots in data/sessions/{id}/

public/
├── index.html               SPA shell + all CSS
└── js/
    ├── app.js               Router, state, toast, modal, openEvalModal, startAutoSave
    ├── api.js               Fetch helpers + SSE + all API modules (api.sessions.*, api.platforms.*)
    ├── views/               dashboard, search, tracker, resume, linkedin, profile, outreach, interview, analytics
    └── components/          jobCard.js, sessionsPanel.js

data/                        Gitignored — runtime only
├── config.json              aiProvider, aiApiKey, aiBaseUrl, aiFastModel, aiPowerModel (global — NOT in sessions)
├── profile.json, resume.json, applications.json, contacts.json, alerts.json
├── resume-versions.json, cover-letter.json, writing-style.json
├── resume-original.{ext}    Original uploaded file — used by auto-apply ATS file inputs
├── active-session.json      { id, name, savedAt } pointer
├── sessions/{hex-id}/       meta.json + data.json snapshots
└── platform-sessions/       {name}.json — { cookies, connectedAt }
```

## AI Adapter

Two tiers via `server/services/aiAdapter.js`:

| Tier | Used for |
|---|---|
| `callFast(sys, usr, maxTokens)` | batch scoring, ATS check, resume parse, salary estimate, LinkedIn AI extraction |
| `callPower(sys, usr, maxTokens)` | evaluate, tailor, CV gen, LinkedIn optimize, resume chain, platform sync AI |

**10 providers**: anthropic, ollama (local), ollamacloud (`https://ollama.com/v1`), nvidia, openai, llama, groq, openrouter, gemini, custom.

**Request governor** (`governedCall`): per-provider RPM + concurrency bucket, FIFO queue, 3s/9s retry on 429/503. Timeouts: 240s cloud / 300s ollama. NVIDIA `maxOut:4096` — `parseJson` truncation salvage handles clipped responses.

**Per-provider keys**: `config.aiKeys = { provider: key }` deep-merged — saving one key never wipes another's. `aiApiKey` is the legacy fallback.

**Batch scoring**: `quickScoreBatch()` scores 8 jobs per call (~24 calls vs ~180). Score `null` on failure — never a fake middle score.

**Provider note**: Claude.ai Pro/Max ≠ API access. Free alternatives: Ollama, Groq, OpenRouter, Gemini.

**Config schema** (`data/config.json`): `{ apiKey, aiProvider, aiApiKey, aiBaseUrl, aiFastModel, aiPowerModel }`. POST to `/api/profile/config` (NOT `/api/config`).

## Key Flows

### Job Search (SSE streaming)
1. `POST /api/jobs/search` → `{ searchId }` — runs all boards in parallel
2. `GET /api/jobs/stream/:searchId` → SSE with **named events**: `event: job` / `event: done` / `event: update`
3. Phase 1: boards return → hybrid-ranked results emitted immediately
4. Phase 2: AI scoring as background enrichment; `update` events patch cards in place
5. Auto-recommendations load after search ends if user has saved/liked jobs

**Named events are critical**: client uses `es.addEventListener('job', ...)`. Unnamed `message` events are silently dropped.

### Resume Tailor
`POST /api/jobs/tailor` → `tailorResume()` in `claude.js`. Used by BOTH Job Search → Evaluate → Tailor AND Resume & CV → Tailor. **NOT `/api/resume/tailor`** — that route does not exist.

Output merges invariant fields from stored resume (name, contact, education, certifications) with AI-rewritten fields (summary, skills, experience). Frontend expects `r.name`, `r.contact`, `r.education`. ATS score auto-runs on every tailored output.

### 4-Persona AI Resume Chain
Sequential: Diagnoser (ATS audit) → Recruiter (keyword gap + score /100) → Rewriter (XYZ bullets using recruiter's missing keywords) → Hiring Manager (20 interview questions). Each step isolated in try/catch — failure doesn't cascade. Pre-flight aborts if resume is empty.

Routes: `POST /api/resume/chain/{diagnoser|recruiter|rewriter|hiring-manager}`. After Run Full Chain completes, "Apply Rewritten Bullets?" card appears → `PATCH /api/resume`.

### Auto-Apply (Playwright)
1. `POST /api/jobs/apply/start` → `startApplySession(job)` in `autoApplyBot.js`
2. ATS detected from URL. **LinkedIn**: loads stored cookies via `createContextWithSession('linkedin')` — bypasses Google "app may not be secure" block. Falls back to bare browser with warning if no session found.
3. Workday: `workdayPreFlow()` — clicks Apply → Autofill with Resume, hands off for per-company sign-in (cannot automate), resumes after form appears (waits up to 4 min).
4. Fields filled via `ATS_SELECTORS[atsType]` — keys: `greenhouse`, `lever`, `ashby`, `smartrecruiters`, `bamboohr`, `linkedin`, `generic`.
5. Submit button highlighted blue — NOT clicked. User confirms via "Submit Application" button.
6. SSE stream: `GET /api/jobs/apply/:id/events` (`event: apply`). Bookmarklet available for any job page.

**LinkedIn prerequisite**: must connect LinkedIn in Settings → Platform Accounts first.

### Platform Sessions
User authenticates in a headed Playwright browser (credentials never stored — only cookies). Saved to `data/platform-sessions/{name}.json`.

**LinkedIn sync flow**: full-page staged scroll → click all "see more" expansion buttons → extract 8000 chars of raw text → `callPower` (2500 tokens) extracts structured data. **AI takes priority over DOM** (DOM selectors are unreliable on LinkedIn). Extracts: name, headline, location, about, skills, experience.

**Critical distinctions**: "headline" = short professional tagline under the name (NOT a job title). "about" = personal bio section (NOT activity feed posts or job listings).

Session expiry auto-detected: login-page redirect → cookie file deleted → UI shows "Not connected".

Platform sessions also gate: Google Jobs search (off-screen headed browser via `createContextWithSession`), Glassdoor/ZipRecruiter search.

### Apply Queue (batch)
Auto-queue by score threshold (Off / ≥3.5 / ≥4.0 / ≥4.5) or manual batch select → tracker status `Queued`. Process Queue opens batch modal with Application Packet (pitch + cover letter + 5 Q&A answers + keywords). Mark Applied → Next or Skip.

### Sessions (workspace snapshots)
Captures: applications, resume, profile, cover-letter, writing-style. NOT config (API keys always global).
Auto-saves every 5 min. "New Session" always auto-saves first. On startup: if no valid session ID, `applications.json` cleared to `[]`.

### Writing Style & Voice
8 styles (Professional / Formal / Technical / Executive / Conversational / Creative / Concise / Academic) stored in `data/writing-style.json`. Optional cover letter sample in `data/cover-letter.json` — AI mirrors sentence structure, rhythm, tone (up to 1200 chars used in prompt).

## Job Board Status (audited Jul 2–10 2026)

| Board | Status | Notes |
|---|---|---|
| LinkedIn, Indeed | ✅ jobspy subprocess | one subprocess per site, parallel, 120s timeout |
| Greenhouse (74+), Lever, Ashby | ✅ direct ATS APIs | pools of 8; Ashby uses `api.ashbyhq.com/posting-api` |
| OpenWeb (Muse/Arbeitnow/RemoteOK/Himalayas/Jobicy) | ✅ aggregators | `broadSearch.js` |
| Major Employers (Amazon + 16 Workday tenants) | ✅ direct APIs | `companySites.js`; Apple/Google/Meta not reachable anonymously |
| Company Registry (~90 S&P500) | ✅ name-routed | `companyRegistry.js` → correct ATS per company |
| Any-company ATS resolver | ✅ | probes SmartRecruiters/Workable/Recruitee/Breezy by slug |
| Google for Jobs | ✅ session-gated | off-screen headed browser; connect Google in Platform Accounts |
| Glassdoor, ZipRecruiter | ✅ session-gated | `sessionBoardSearch.js`; connect account to unlock |
| Wellfound, YC, startup.jobs, Remotive, Built In, Cord | ✅ JSON APIs | |

Multi-keyword ("A OR B") split by `kwMatcher()` — matches ANY term. Python script is `jobspy_runner.py` — **never rename to `jobspy.py`** (self-import bug: Python adds script dir to sys.path[0], masking the installed package).

## Job Card Features

**Applicant count**: actual (amber, from description text or jobspy `vacancy_count`) > estimated (muted italic, `dailyRate[source] × daysSincePosted`). Multi-board dedup shows `(N boards)` chip.

**Career level**: `inferCareerLevel(title)` → 10 buckets → `chip chip-indigo`. Filter: 8 checkboxes (Mid-Level + Senior pre-checked). Mapped to LinkedIn experience codes for jobspy.

**Salary**: green badge if posted; "Est. Salary" → `estimateSalaryBand()` → p25/p50/p75/p90 with source pills and location adjustment.

**Hybrid relevance**: `job.relevance` (0-100) from BM25 + feature-hash embedding, personalized via profile/resume, zero API calls.

## Global JS Conventions

- `window.alexNavigate(view)` — navigate from inline handlers
- `window.alexState` — read app state anywhere
- Every view: `renderX(el, state)` default export
- `openEvalModal(job)` from `app.js` — opens full evaluation modal
- No emoji — inline SVG only
- `parseJson()` in `claude.js`: strips markdown fences → extract JSON object/array → sanitize control chars → fix trailing commas → truncation salvage. Handles all AI response formats.

## ATS Score Render

`renderAtsResult()` in `resume.js` reads: `issue.issue` (description), `issue.fix` (fix), `issue.severity` (`high|medium|low`). NOT `issue.label` or `issue.pass`.

## Running Locally

```bash
cd ~/Desktop/"Alexecutive Career Ops"
npm install && npm start       # http://localhost:3000
npm run dev                    # --watch auto-restart
pip install python-jobspy      # optional: LinkedIn/Indeed via jobspy
```

## Testing

```bash
npx playwright install chromium
npx playwright test
```

| File | Coverage |
|---|---|
| `tests/upload.spec.js` | TC-01–10: resume/cover letter upload, MIME, field names |
| `tests/ai-provider.spec.js` | TC-11–20: provider config, Ollama status, writing style |
| `tests/ui-smoke.spec.js` | TC-21–25: app load, navigation, JS errors |

`GET /api/profile/ollama-status` → `{ running, models[], error? }`. 3s pre-flight timeout.

## QA Fix Log

### R23 (Jul 13 2026) — Auto-Apply removed, Job Application Assistance module enhanced

- **Auto-Apply fully removed**: `server/services/autoApplyBot.js` deleted entirely. All Playwright browser automation, bookmarklet CORS middleware, and apply endpoints (`/apply/start`, `/apply/:id/events`, `/apply/:id/submit`, `/apply/:id/abort`, `/apply/bookmarklet`) removed from `server/routes/jobs.js`. `autoApplyGuide` import dropped from routes. Auto-Apply button removed from `public/js/components/jobCard.js`. Bookmarklet UI block and all related JS (`openAutoApplyModal`, bookmarklet setup code, auto-apply click handler) removed from `public/js/views/search.js`. `applyStart`, `applySubmit`, `applyAbort`, `applyEvents`, `autoApply` removed from `api.jobs` in `public/js/api.js`.
- **Job Application Assistance** (renamed + enhanced from Application Writer): Module renamed throughout — `app.js` TITLES, `index.html` nav, `appWriter.js` page header. Added **job context section** above writing style: Company Name, Job Title, optional Job Description paste. These fields are passed as `jobContext` to `POST /api/app-writer/answer` → `server/routes/appWriter.js` → `answerApplicationQuestion()` in `claude.js`. Prompt now includes a `TARGET ROLE:` block when any context is provided, enabling the AI to tailor every answer specifically to the target company/role rather than answering generically.
- **`scripts/setup.sh`**: New clean-install script for sharing. Runs `npm install`, creates `data/` directory with empty JSON stores (config, profile, resume, applications, contacts, alerts, resume-versions, cover-letter, writing-style), prints startup instructions. No personal data included.

### R22 (Jul 12 2026) — LinkedIn full profile (all sections, no limits), optimizer uncapped, AI custom Q&A in Auto-Apply
- **LinkedIn sync hardcoded limits removed**: `platformSessions.js` raw text cap `8000→20000` chars (both `_rawForAI` and return); JSON-LD and DOM skill extraction `.slice(0,30)` removed entirely. `platforms.js` AI extraction token budget `2500→5000`; removed "Skills: max 30 items" rule from prompt; added 7 new profile sections to JSON schema and AI rules (projects, volunteer, publications, awards, languages, organizations, courses). Merge block in `platforms.js` now writes all new sections to `data.structured`. DOM extraction in `platformSessions.js` uses a new inline `extractSec()` helper to extract all 7 sections using the same `pvs-list__item` anchor strategy as education/certifications. Return value and catch fallback updated to include all new fields.
- **LinkedIn Optimizer uncapped**: `claude.js::optimizeLinkedIn()` experience serialization raised from `slice(0,2600)→slice(0,8000)`; profile text raised from `slice(0,2600)→slice(0,6000)`; prompt explicitly states "rewrite EVERY SINGLE role, no limit". `resumeExperience` per-role bullet limit (`.slice(0,5)`) left in place — it limits input bullets per role to 5, which is reasonable.
- **UI label fixed**: `linkedin.js` "Top 10 Skills (comma separated)" → "All Skills (comma separated)"; `fillFromSyncData()` now writes all 7 new sections as labeled blocks into `#li-bullets`; `fieldsFound` counter includes all 13 possible section types.
- **Auto-Apply AI custom Q&A**: new `aiAnswerCustomQuestions(page, answers, session, job)` in `autoApplyBot.js` — third-pass scan after `smartFillByLabel`; finds remaining empty textareas whose labels don't match any `LABEL_ANSWER_MAP` key; calls `callPower` (1500 tokens) to generate tailored answers for all unknown questions in one batch; wired into both `fillForm()` (all ATS types) and per-step in `navigateLinkedInSteps()` (LinkedIn Easy Apply). `callPower` added to import.

### R21 (Jul 11 2026) — LinkedIn full-profile sync, Auto-Apply revamp, bookmarklet CORS, Application Writer module
- **LinkedIn Sync missing education/certifications**: AI extraction prompt in `platforms.js` only asked for experience. Fix: added `education[]` and `certifications[]` to JSON schema; DOM extraction in `platformSessions.js` now targets `#education` and `#licenses_and_certifications` anchors with `pvs-list__item` selectors; `fillFromSyncData()` in `linkedin.js` writes all three sections (experience, education, certifications) as formatted blocks into `#li-bullets`; `fieldsFound` counter includes all six field types.
- **Auto-Apply filled only 5 fields**: static `ATS_SELECTORS` only matched CSS-targeted fields; no handling of dropdowns, diversity EEO questions, or custom text fields. Fix: `generateFieldAnswers()` revamped to produce 25+ field answers (work auth, salary, start date, why interested, strengths, diversity EEO, cover letter text, etc.); new `LABEL_ANSWER_MAP` (26 keyword groups → answer keys); new `smartFillByLabel()` scans ALL visible form elements by `aria-label`/`<label for>`/`aria-labelledby`/placeholder/DOM walk — fills text inputs and selects by best-option matching; new `navigateLinkedInSteps()` auto-advances LinkedIn Easy Apply modal through all steps (fill → Next → fill → … → Submit); `fillForm()` calls `smartFillByLabel()` as second pass after static selectors.
- **Bookmarklet CORS error**: `fetch()` from external job page to `localhost:3000` was blocked by browser cross-origin policy. Fix: added `bookmarkletCors` middleware to `jobs.js` that emits `Access-Control-Allow-Origin: *` + handles `OPTIONS` preflight (returns 204); bookmarklet code in `search.js` updated to use an inline styled `div` notification instead of `alert()` (alert blocks Playwright automation).
- **Application Writer module** (new): Career Tools → Application Writer. Paste any job application question(s); AI answers in user's selected writing style using resume/profile context. Files: `server/routes/appWriter.js` → `POST /api/app-writer/answer`; `server/services/claude.js::answerApplicationQuestion()`; `public/js/views/appWriter.js` (8-style selector, copy buttons per answer); registered in `server/index.js`, `app.js` VIEWS/TITLES, `api.js::api.appWriter`, `index.html` nav. Shares `/api/resume/writing-style` with Resume & CV.

### R20 (Jul 10 2026) — LinkedIn sync accuracy, tailor completeness, LinkedIn auto-apply
- **Resume Tailor blank header/missing education**: `tailorResume()` only returned AI-rewritten fields (summary/skills/experience). Fix: merge invariant fields from stored resume (name, contact, education, certifications) after AI parse — spread pattern: base fields first, AI fields overlay. Token limit 4000→4500. Aligns both Tailor surfaces (same endpoint).
- **LinkedIn Optimizer parse error**: single attempt at 6000 tokens truncated JSON for large profiles. Fix: 3-attempt retry, 1s delay, 8000 tokens.
- **LinkedIn Sync wrong content**: 600px scroll missed lazy sections; no "see more" expansion; `_rawForAI` was conditional on missing fields (allowed wrong DOM content to pass). Fix: full staged scroll + expand all buttons + always set `_rawForAI` (8000 chars). AI extraction: `callPower` 2500 tokens, prompt distinguishes bio from feed posts, AI result REPLACES DOM (not just fills gaps), experience extracted.
- **Auto-Apply LinkedIn Google block + 0 fields**: bare `chromium.launch()` triggered Google sign-in block; no `linkedin` key in `ATS_SELECTORS` → fell back to `generic`. Fix: `createContextWithSession('linkedin')` loads stored cookies; `linkedin` key added to `ATS_SELECTORS` with Easy Apply modal selectors; LinkedIn flow clicks Easy Apply button; LinkedIn submit selectors (`button[aria-label*="Submit application"]` etc.) added at top of `submitSelectors`.

### R19 (Jul 6 2026) — Ollama Cloud provider
`ollamacloud`: OpenAI-compat at `https://ollama.com/v1`; `isOllama` is strict `=== 'ollama'` so cloud variant shows key field and skips local liveness probe. 10 providers total.

### R18 (Jul 5 2026) — Target-company resolution + size/industry filters
Company names woven into aggregator queries. `companyRegistry.js` maps 90 major employers to correct ATS backend. `searchNamedCompanies` routes via concurrency-3 pool. Company Size + Primary Industry checkbox filters added.

### R17 (Jul 5 2026) — Google Jobs via session
Google blocks all automation (fetch + headless + headed). Only trusted session works. `googleJobs.js`: off-screen headed browser. Job cards are `div[data-share-url]` (NOT `role="listitem"` — those are filter chips).

### R16 (Jul 4 2026) — LinkedIn render crash, full resume parsing, Persona 4 hang
`esc()` undefined in `linkedin.js` hid entire optimizer. Resume parsing: 14k chars, `callPower` 8k tokens, all positions extracted. Persona 4: 6k tokens (was 12k — held in governor queue). Client `req()` has 6-min AbortSignal ceiling.

### R15 (Jul 4 2026) — Hybrid search, two-phase pipeline, Workday apply
BM25 + feature-hash embedding rank all results immediately (Phase 1). AI scoring via `update` SSE events in background (Phase 2). `FOREIGN_SCOPE` regex blocks foreign-scoped jobs from US searches. Workday: `resume-original.{ext}` persisted at upload; `workdayPreFlow()` waits up to 4 min for per-company sign-in.

### R14 (Jul 3 2026) — Open-web aggregators + any-company ATS resolver
`broadSearch.js`: Muse, Arbeitnow, RemoteOK, Himalayas, Jobicy. `searchAnyCompanyATS`: probes SmartRecruiters/Workable/Recruitee/Breezy by slug for any typed company name.

### R13 (Jul 3 2026) — Direct company sites, tailor consolidation
Amazon.jobs + 16 Workday tenants in `companySites.js`. `resumeToText()` for AI prompts (prevents "resume is in JSON format" phantom critique). `sanitizeResumeOutput` force-coerces all array fields. Generate CV button removed — single Tailor endpoint. Per-tailor ATS score auto-runs.

### R10–12 (Jul 2–3 2026) — condensed
R12: Session-backed Glassdoor/ZipRecruiter. R11: TPM governor; Gemini free tier needs `gemini-2.5-flash`; LinkedIn Optimizer `checklistAudit` grading. R10: NVIDIA model auto-prefix; governor ended 429 storms; `kwMatcher()` multi-keyword fix; Ashby official API (0→1,396 jobs); 9 dead boards removed.

### R1–9 (Jun 25–Jul 1 2026) — foundational
Multer field-name mismatch · DOCX MIME · Ollama liveness probe · SSE named events (`event: job`) · `parseJson` hardening (fences/control chars/trailing commas/truncation) · `[object Object]` date coercion everywhere · ATS scorer on content not JSON schema (`resumeToText`) · placeholder stripping · chain error isolation · Playwright 1-click apply + platform sessions + bookmarklet · sessions system · jobspy self-import bug (renamed to `jobspy_runner.py`) · location filter with state abbreviation expansion.
