# Alexecutive Career Ops

AI-powered career command center. A self-hosted browser dashboard for live multi-board job search, AI scoring and evaluation, style-preserving resume tailoring, CV generation, LinkedIn optimization, auto-apply guidance, and application tracking — built for non-technical through semi-technical professionals.

**Target audiences:** Analytics, Operations, Finance, Product Management, Business Strategy, Legal, Healthcare, Creative/Marketing, Sales, Executive, HR, Government/Nonprofit, Scientific/R&D, Engineering.

---

## Quick Start (5 minutes)

> **Where is the project folder?**
> The folder is named `Alexecutive Career Ops` and is typically on your Desktop.
> If you moved it, replace `~/Desktop` below with the correct path.

```bash
# 1. Navigate to the project folder
cd ~/Desktop/"Alexecutive Career Ops"

# 2. Install Node.js dependencies
npm install

# 3. Install live job search support (strongly recommended)
pip install python-jobspy

# 4. Start the server
npm start
```

Open **http://localhost:3000** — everything from here is in the browser.

> **On Windows:** Open Command Prompt and use:
> `cd "%USERPROFILE%\Desktop\Alexecutive Career Ops"`

---

## First-Time Browser Setup

### 1. Choose your AI provider
**Settings** → AI Provider → select a tab → follow the setup steps shown → Save.

**Free options (no credit card required):**
- **NVIDIA** ⭐ recommended free option — 70B-class quality hosted free. Get a key at [build.nvidia.com](https://build.nvidia.com) (model IDs need the org prefix, e.g. `meta/llama-3.3-70b-instruct` — the app auto-corrects bare names)
- **Groq** — free tier at [console.groq.com](https://console.groq.com)
- **Google Gemini** — free tier via [aistudio.google.com](https://aistudio.google.com) (use gemini-2.5-flash-lite / 2.5-flash; the older 2.0-flash has no free quota on new keys)
- **OpenRouter** — free models at [openrouter.ai](https://openrouter.ai)
- **Meta Llama API** — free preview at [llama.developer.meta.com](https://llama.developer.meta.com)
- **Ollama Cloud** — hosted Ollama models (gpt-oss 120B, Qwen3-Coder 480B, DeepSeek, Kimi) run on Ollama's GPUs; nothing runs locally, so your machine never bogs down. Free key at [ollama.com](https://ollama.com) → Settings → API keys.
- **Ollama** — runs entirely on your machine, no account needed. Install from [ollama.com](https://ollama.com), then `ollama pull llama3.1` (fast) + `ollama pull qwen2.5:14b` (power). Note: small local models (8B) produce noticeably weaker tailoring and analysis than 70B cloud models — Ollama Cloud or a free NVIDIA/Groq key gives much better results.

Each provider keeps its own saved API key — switching providers never loses a key. Requests are automatically rate-limited to each provider's free-tier limits (with queueing and retry), so searches won't trigger 429 errors.

**Note:** A Claude.ai Pro or Max subscription does **not** include API access. The Anthropic API (`console.anthropic.com`) is a separate product with separate billing.

### 2. Upload your resume
**Resume & CV** → drag a PDF, DOCX, or TXT file, paste text, or drop LinkedIn/GitHub/portfolio URLs.
The app extracts your experience, skills, and *style metadata* — your formatting, section order, header style, and bullet conventions are preserved on every tailored output.

### 3. Fill in your profile
**Profile & Settings** → target roles, primary industry, salary range, remote preference.

### 4. Run your first search
**Job Search** → enter keywords → Search Jobs. Results stream in live. Each card gets an AI score (1.0–5.0) and Apply / Consider / Skip verdict automatically.

---

## AI Provider Options

| Provider | Cost | How to Get Access |
|---|---|---|
| **Anthropic (Claude)** | Pay-per-token | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| **NVIDIA** ⭐ | Free credits | [build.nvidia.com](https://build.nvidia.com) → any model → Get API Key (`nvapi-…`) |
| **OpenAI (GPT)** | Pay-per-token | [platform.openai.com](https://platform.openai.com) → API Keys |
| **Meta Llama API** | Free preview | [llama.developer.meta.com](https://llama.developer.meta.com) → API Keys |
| **Ollama Cloud** | Free key (hosted) | [ollama.com](https://ollama.com) → Settings → API keys. gpt-oss 120B etc. on Ollama's GPUs |
| **Ollama** | Free (local) | [ollama.com](https://ollama.com) → `ollama pull llama3.1` |
| **Groq** | Free tier + paid | [console.groq.com](https://console.groq.com) → API Keys |
| **OpenRouter** | Free models + paid | [openrouter.ai](https://openrouter.ai) → Keys |
| **Google Gemini** | Free tier (2.5-flash-lite ~1,000/day) | [aistudio.google.com](https://aistudio.google.com) → Get API Key |
| **Custom** | Depends | Any OpenAI-compatible endpoint |

Best free quality: **NVIDIA with `meta/llama-3.3-70b-instruct`** as both fast and power model. Best absolute quality: Anthropic (Claude Sonnet as power model).

---

## Sharing With Others

This app is fully self-hosted. Anyone can run their own private instance:

```bash
# 1. Install Node.js 20+ from nodejs.org (or: brew install node)

# 2. Navigate to the project folder and start the app
cd ~/Desktop/"Alexecutive Career Ops"
npm install
npm start

# 3. Open http://localhost:3000 → Settings → AI Provider → choose a provider
```

All data (resume, profile, applications) stays on each user's own machine in `data/` — nothing shared between instances.

---

## Features

### Core

| Feature | What It Does |
|---|---|
| **Live Job Search** | 12 verified sources: LinkedIn + Indeed (via JobSpy), Google for Jobs (via your connected Google account — one-time human verification), direct company career pages via Greenhouse (70+ companies), Lever, and Ashby, plus Wellfound, Y Combinator, startup.jobs, Welcome to the Jungle, Cord, Built In, and Remotive. Whole-web coverage through four layers: Google for Jobs (Google's index of every company career page on the internet), an "Open-Web Aggregators" board (The Muse 400k+ postings, Arbeitnow, RemoteOK, Himalayas, Jobicy), a "Major Employers (direct)" board that queries company career sites with no aggregator in between — Amazon.jobs, Netflix (Eightfold), and Workday-hosted careers for 14 majors incl. NVIDIA, Adobe, Disney/Hulu, PayPal, Intel, eBay, HP, 3M. (Apple/Google/Meta/Tesla block anonymous API access; their postings surface via Google for Jobs — connect Google once in Profile & Settings → Platform Accounts to unlock it, since Google requires a one-time human verification.) Every enabled board returns real results — dead boards were removed. Glassdoor and ZipRecruiter search through YOUR connected account (they block anonymous automation): connect them once in Profile & Settings → Platform Accounts and their checkboxes unlock automatically. Location supports 70 metro/region markets — "Raleigh-Durham, NC (Research Triangle)", "Dallas-Fort Worth, TX (DFW)", "San Francisco Bay Area" — each matching every city in the metro. Deduplicates across sources. Two-phase hybrid search (the same lexical + vector architecture Google and LinkedIn use): every result is BM25 + vector-similarity ranked against your query AND profile instantly — full result set lands in seconds — then AI match scores stream in as background enrichment without blocking the search. |
| **ATS Keyword Match %** | Every job card shows a live keyword match score against your resume during search — matched and missing terms available on hover |
| **Applicant Competition Signal** | Each card shows actual or estimated applicant count; multi-board jobs show aggregate count across all matched sources |
| **Career Level Filter** | Filter by Intern / Entry / Mid / Senior / Lead / Manager / Director / VP / Executive |
| **Salary Intelligence** | Posted salary badge or AI-estimated p25/p50/p75/p90 bands from BLS, Glassdoor, LinkedIn Salary, Levels.fyi |
| **Company Filters** | Target ANY company by name — the resolver probes its real careers page across every major ATS (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Breezy). Exclude companies too. |
| **AI Match Scoring** | Quick-scores every result during search (1.0–5.0 + verdict). Full 6-block A–F evaluation on demand. |
| **Apply Queue** | Auto-queue jobs by score threshold during search, or batch-select manually. Batch apply modal generates a full Application Packet (cover letter + ATS Q&A) for each queued job with one-click copy buttons. Every packet respects your selected Writing Style and mirrors your Cover Letter Sample voice. |
| **Writing Style Selector** | 8 styles applied to every generated cover letter, pitch, and Q&A answer: Professional, Formal, Technical, Executive, Conversational, Creative, Concise, Academic — each with a plain-English description |
| **Cover Letter Sample Upload** | Upload a cover letter you've previously written (PDF/DOCX/TXT or paste). The AI mirrors your authentic voice — sentence structure, rhythm, vocabulary — not just a style label |
| **AI Resume Chain (4-Persona)** | Paste a JD once — four AI personas audit it sequentially: (1) ATS Diagnoser flags every automatic rejection risk; (2) Senior Recruiter scores your match /100 and identifies the top missing keywords; (3) XYZ Rewriter rewrites your bullets using the Google XYZ formula (Accomplished X as measured by Y by doing Z) with the missing keywords integrated; (4) Hiring Manager generates the 20 role-specific interview questions with strong vs. weak answer benchmarks. Run individually or all four in sequence. |
| **Style-Preserving Resume Tailoring** | Rewrites your resume with job keywords while mirroring your original formatting, section order, bullet style, and visual brand |
| **Resume Versions** | Save, name, and switch between multiple tailored resume versions; promote any version to active |
| **CV Generation** | Full professional CV built from your experience, in the same visual style as your uploaded resume |
| **Auto-Apply Guide** | Detects ATS type (Workday, LinkedIn, Greenhouse, Lever, Ashby…), generates prefilled step-by-step form guide with copy buttons |
| **Top Recommendations** | AI-ranked similar roles load automatically after search, based on your saved interactions |
| **Resume ATS Check** | Scores against 12 ATS rules, flags keyword and formatting gaps |
| **LinkedIn Optimizer** | Rewrites headline, About section, experience bullets, and top skills for recruiter visibility |
| **Application Tracker** | Full pipeline: Saved → Applied → Screening → Interview → Offer → Accepted/Rejected |
| **Inline Editing** | Edit resume fields, cover letter text, and application notes directly in the UI — no re-upload needed |
| **Export Resume / Cover Letter / Applications** | Download as PDF (print dialog) or DOCX (Word-compatible) from the Resume and Applications views |
| **Clear Resume** | One-click start-over: wipes parsed resume data so you can upload a fresh version |
| **CSV Export** | One-click download for Google Sheets or Excel |

### Outreach & Networking

| Feature | What It Does |
|---|---|
| **LinkedIn Message Generator** | AI-drafted personalized connection requests for any job contact |
| **Cold Email Composer** | Subject + body cold email tailored to contact role and target job |
| **Referral Ask Generator** | Natural referral request messages calibrated to relationship strength |
| **Follow-Up Generator** | Timed follow-up emails referencing your original application date |
| **Network CRM** | Contact list with relationship tracking, follow-up status, and one-click outreach generation per contact |

### Interview Prep

| Feature | What It Does |
|---|---|
| **STAR Answer Generator** | Full STAR-format answers (Situation / Task / Action / Result) for any behavioral questions |
| **Company Brief** | AI research card: funding stage, culture signals, hiring purpose, smart questions, red flags, and recommended angle |
| **Tech Q&A Generator** | Role-specific technical interview questions with model answers, difficulty ratings, and type classification |
| **Mock Interview Feedback** | Grade your practice answers: score, letter grade, strengths, improvements, and an AI-rewritten version |

### Analytics

| Feature | What It Does |
|---|---|
| **Pipeline Analytics** | Funnel visualization across all pipeline stages with per-source response rates and score distribution |
| **Skills Gap Roadmap** | Analyzes your saved jobs to identify the most-demanded missing skills with learning resource recommendations |
| **Blind Spot Detector** | Pattern-detects systemic issues in your applications: over-targeting, title mismatches, ghosting clusters, and application timing problems |
| **Offer Comparison & Negotiation** | Analyze any offer (base, equity, bonus) against market bands; generate a negotiation script with specific dollar asks |
| **Saved Search Alerts** | Save keyword+filter combinations and re-run them on demand; schedule daily/weekly alerts |
| **Application Timing Intelligence** | Score distribution heatmap by day-of-week and time-of-day to optimize when you apply |

---

## Environment Variables

```
PORT=3000    # Change if port 3000 is in use (optional — key is now set in Settings UI)
```

---

## Troubleshooting

**No LinkedIn / Indeed results**
→ `pip install python-jobspy`
→ Verify: `python3 -c "from jobspy import scrape_jobs; print('OK')"`

**No Glassdoor / ZipRecruiter results**
→ These sites block automated search upstream (Glassdoor returns HTTP 400, ZipRecruiter 403 to all scrapers, not just this app). Their checkboxes are marked "blocked" and unchecked by default. LinkedIn + Indeed + Google for Jobs + company career pages cover the same postings.

**NVIDIA "404 page not found"**
→ The model ID is missing its org prefix. Use the full ID from build.nvidia.com, e.g. `meta/llama-3.3-70b-instruct` (not `llama-3.3-70b-instruct`). Current versions auto-correct bare names.

**NVIDIA 429 "Too Many Requests" / 503 "ResourceExhausted"**
→ Fixed in current version: all AI calls are rate-limited to 36 requests/min and 4 concurrent for NVIDIA, with automatic queueing and retry. If you still see it, another app may be sharing the same API key.

**"API key not configured"**
→ Settings → AI Provider → choose a provider and enter its key → Save
→ A saved key displays as 12 masked dots — that's a mask, not truncation. The full key is stored.
→ For Ollama: no key needed — just ensure Ollama is running (`ollama serve`)

**"Cannot POST /api/config" when saving Settings**
→ Fixed in current version. If you see this on an older copy, update `public/js/api.js` and restart the server.
→ The correct endpoint is `/api/profile/config`; older builds pointed to `/api/config` (which doesn't exist).

**Ollama live-status shows red after saving**
→ Run `ollama serve` in a separate terminal window, then click **Re-check** in the Settings panel.
→ Ensure you've pulled at least one model: `ollama pull llama3.1`

**Port 3000 in use (`EADDRINUSE`)**
→ A previous server session is still running. Kill it first:
→ `kill $(lsof -ti:3000)` then `npm start` again
→ Or use a different port: `PORT=3001 npm start`

**Server won't start**
→ `node --version` must be 20+, then re-run `npm install`
→ Make sure you `cd` into the project folder first before running `npm install` or `npm start`

---

## Development

```bash
npm run dev   # auto-restarts server on file changes
```

All frontend JS is served as ES modules from `public/js/` — no build step required.

---

## Running Tests

Playwright is included. Ensure the server is running first (or let the web server config in `playwright.config.js` auto-start it):

```bash
# Install browsers once
npx playwright install chromium

# Run all tests
npx playwright test

# Run a specific suite
npx playwright test tests/upload.spec.js
npx playwright test tests/ai-provider.spec.js
npx playwright test tests/ui-smoke.spec.js
```

**Test suites:**
- `tests/upload.spec.js` — resume & cover letter upload (TC-01 through TC-10). Covers the DOCX/field-name regression, empty file guard, MIME type detection, paste, and delete flows.
- `tests/ai-provider.spec.js` — AI provider config, Ollama liveness endpoint, writing style persistence (TC-11 through TC-20).
- `tests/ui-smoke.spec.js` — UI smoke tests: app load, navigation, view rendering, JS error check (TC-21 through TC-25).

---

## Regenerate the Setup Guide PDF

```bash
cd ~/Desktop/"Alexecutive Career Ops"
python3 scripts/generate_pdf.py
```
