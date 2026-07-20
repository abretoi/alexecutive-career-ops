# Alexecutive Career Ops — Setup Guide

A complete guide for first-time installation and sharing with others.

---

## Prerequisites

| Requirement | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) or `brew install node` |
| Python 3 | 3.9+ *(optional)* | [python.org](https://python.org) or `brew install python` |
| python-jobspy | latest *(optional)* | `pip install python-jobspy` |

**Python + python-jobspy** is optional but strongly recommended — it unlocks LinkedIn, Indeed, and Google for Jobs. Without it, the direct company-career-page boards are still searched (Greenhouse, Lever, Ashby, Wellfound, Y Combinator, startup.jobs, Welcome to the Jungle, Cord, Built In, Remotive). Note: Glassdoor and ZipRecruiter block anonymous automated search, so they run through YOUR logged-in account instead — connect each once in Profile & Settings → Platform Accounts and their Job Search checkboxes unlock automatically. The "Major Employers (direct)" board searches company career websites directly (16 majors: Amazon, Netflix, NVIDIA, Adobe, Disney/Hulu, PayPal, Intel, eBay, HP, 3M, Salesforce, Capital One, Wells Fargo, CVS Health, Humana, Target); the "Open-Web Aggregators" board adds The Muse (400k+ postings), Arbeitnow, RemoteOK, Himalayas, and Jobicy; and typing ANY company into Target Companies (Apple, Google, Tesla, Microsoft, or any of ~90 mapped S&P 500-tier employers) resolves its real careers backend — Workday, Greenhouse, Lever, Ashby, or via Google Jobs for proprietary sites. Location search covers 70 US metro markets ("Raleigh-Durham, NC", "Dallas-Fort Worth, TX (DFW)", "San Francisco Bay Area"…) — each matches every city in the region.

**No API key is required to install.** You choose and configure your AI provider inside the browser dashboard after starting the app.

---

## Installation

> **Finding the project folder:**
> The project folder is named `Alexecutive Career Ops`. If you downloaded it to your Desktop, the path is `~/Desktop/"Alexecutive Career Ops"`. Adjust the path below if you placed it elsewhere.

```bash
# Step 1 — Navigate to the project folder
cd ~/Desktop/"Alexecutive Career Ops"

# Step 2 — Install Node.js dependencies
npm install

# Step 3 — Install live job search support (recommended)
pip install python-jobspy

# Step 4 — Start the server
npm start
```

Then open **http://localhost:3000** in your browser.

> **On Windows:** Open Command Prompt and use:
> `cd "%USERPROFILE%\Desktop\Alexecutive Career Ops"`

---

## First-Time Browser Setup

### Step 1 — Choose your AI provider
Go to **Settings** (bottom of the left sidebar) → **AI Provider**.

Select a provider tab and follow the numbered setup steps shown for that provider. Then click **Save Provider**.

**Free options:**

| Provider | How to Get Access |
|---|---|
| **NVIDIA** ⭐ best free quality | [build.nvidia.com](https://build.nvidia.com) → any model page → Get API Key (`nvapi-…`). Model IDs need the org prefix, e.g. `meta/llama-3.3-70b-instruct` (bare names are auto-corrected) |
| **Groq** (free tier) | Sign up at [console.groq.com](https://console.groq.com) → API Keys |
| **Google Gemini** (free: ~1,000/day on 2.5-flash-lite) | Sign in at [aistudio.google.com](https://aistudio.google.com) → Get API Key. Use gemini-2.5-flash-lite / gemini-2.5-flash — 2.0-flash has no free quota on new keys |
| **OpenRouter** (free models) | Sign up at [openrouter.ai](https://openrouter.ai) → Keys |
| **Meta Llama API** (free preview) | [llama.developer.meta.com](https://llama.developer.meta.com) → API Keys |
| **Ollama Cloud** (hosted, free key) | [ollama.com](https://ollama.com) → Settings → API keys. Runs gpt-oss 120B / Qwen3-Coder 480B etc. on Ollama's GPUs — nothing runs locally, no machine load |
| **Ollama** (local, no account) | Install from [ollama.com](https://ollama.com), then `ollama pull llama3.1` + `ollama pull qwen2.5:14b`. Small 8B models produce weaker analysis — prefer Ollama Cloud or a free cloud key for best results |

**Paid options:**

| Provider | How to Get Access |
|---|---|
| **Anthropic (Claude)** — best absolute quality | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| **OpenAI (GPT)** | [platform.openai.com](https://platform.openai.com) → API Keys |

Every provider keeps its own saved key — switching tabs never loses a key. A saved key shows as masked dots with a "✓ Full key is saved" note (it is not truncated). All requests are automatically rate-limited to each provider's free-tier limits with queueing and retry.

> **Important:** A Claude.ai Pro or Max subscription does **not** grant API access. The Anthropic API is a separate product with its own billing at `console.anthropic.com`.

### Step 2 — Upload your resume
Go to **Resume & CV** in the left sidebar.

Options:
- **Drag and drop** a PDF, DOCX, or TXT file onto the upload zone
- **Paste text** directly into the text box
- **Drop URLs** — LinkedIn profile, GitHub, portfolio — stored as AI context for all evaluations

When your resume is uploaded, the app extracts your work history, skills, and **style metadata** (section order, header style, bullet format, date format, tone). Every tailored resume and generated CV will mirror your original formatting — not a new template.

### Step 3 — Fill in your profile
Go to **Profile & Settings** → fill in:
- **Target roles** — e.g. "Operations Manager", "Senior Financial Analyst", "Product Manager"
- **Primary industry**
- **Target salary range**
- **Remote / hybrid / on-site preference**
- **Deal-breakers** *(optional)*

The AI uses your profile to score every job search result against your specific goals.

### Step 4 — Run your first job search
Go to **Job Search** → enter keywords → click **Search Jobs**.

Results land in seconds — every job is instantly ranked by hybrid relevance (exact-keyword + meaning/intent matching against your profile, the same two-stage architecture Google and LinkedIn use), and AI match scores stream in on top without blocking the search. Each card shows:
- AI match score (1.0–5.0)
- Verdict: Apply / Consider / Skip
- Career level badge (Intern / Entry / Mid / Senior / Lead / Director / VP / Executive)
- Salary (posted by employer, or AI-estimated bands on demand)
- Location, source board, date posted

---

## Features Reference

### Core Features

| Feature | Navigate To | What To Do |
|---|---|---|
| Live job search | Job Search | Keywords + filters → Search Jobs |
| ATS keyword match % | Every job card | Shown automatically — % chip on each card during search |
| Apply Queue (auto) | Job Search → Auto-Queue Threshold | Set a score threshold; matching jobs are queued automatically |
| Apply Queue (manual) | Job Search → Select | Toggle Select mode → pick jobs → Queue Selected |
| Process Apply Queue | Applications → Process Apply Queue | Opens batch modal with AI-generated packets per job |
| Writing style | Resume & CV → Application Writing Style | Click a style pill — applied to all future packets |
| Cover letter sample | Resume & CV → Cover Letter Writing Sample | Upload/paste a past cover letter — AI mirrors your voice |
| AI Resume Chain | Resume & CV → AI Resume Chain | Paste a JD → Run Full Chain: ATS Diagnoser → Senior Recruiter → XYZ Rewriter → Hiring Manager |
| Diagnoser (Persona 1) | AI Resume Chain → 1. Diagnoser | ATS audit: formatting issues, vague language, missing requirements, risk level |
| Recruiter (Persona 2) | AI Resume Chain → 2. Recruiter | Match score /100, top missing keywords, recruiter red flags, apply recommendation |
| XYZ Rewriter (Persona 3) | AI Resume Chain → 3. Rewriter | Google XYZ bullet rewrites with missing keywords integrated — before/after comparison |
| Hiring Manager (Persona 4) | AI Resume Chain → 4. Hiring Manager | 20 role-specific interview questions with strong/weak answer benchmarks |
| Career level filter | Job Search → Career Levels | Check the levels you want |
| Min salary filter | Job Search → Min Salary | Select from dropdown |
| Target specific companies | Job Search → Target Companies | Type company name → Enter |
| Exclude companies | Job Search → Exclude Companies | Type company name → Enter |
| Salary estimate | Any job card → Est. Salary | Click button on cards without posted salary |
| Quick AI score | Appears on every job card | Automatic during search |
| Full AI evaluation (A–F) | Any job card → Evaluate | Opens 6-block detailed report |
| Save to tracker | Any job card → Save | Adds job to Applications pipeline |
| ATS resume score | Resume & CV → Run ATS Check | Scores against 12 ATS compatibility rules |
| Tailor resume | Resume & CV → Tailor for a Role → Tailor Resume | Style-preserving ATS-optimized rewrite; ATS score auto-runs on the result |
| Tailor cover letter | Resume & CV → Tailor for a Role → Tailor Cover Letter | AI writes a 3-paragraph cover letter matched to the pasted JD, in your writing style |
| Resume versions | Resume & CV → Versions | Save named versions; promote any version to active |
| Generate CV | Resume & CV → paste JD → Generate CV | Full professional CV in your original style |
| LinkedIn optimizer | LinkedIn Optimizer | Rewrites headline, About, experience bullets, skills |
| Track applications | Applications | Update status as you progress |
| Export to CSV | Dashboard → Export CSV | Google Sheets / Excel download |
| Top recommendations | Job Search (after saving jobs) | AI-ranked similar roles load automatically |

### Career Tools

| Feature | Navigate To | What To Do |
|---|---|---|
| LinkedIn message | Outreach & Network → Generate Outreach → LinkedIn Request | Enter contact name → Generate |
| Cold email | Outreach & Network → Generate Outreach → Cold Email | Enter contact + role → Generate |
| Referral ask | Outreach & Network → Generate Outreach → Referral Ask | Enter contact + relationship → Generate |
| Follow-up email | Outreach & Network → Generate Outreach → Follow-Up | Enter application date → Generate |
| Network CRM | Outreach & Network → Network CRM | Add contacts, track follow-up status, generate outreach per contact |
| Job application Q&A | Job Application Assistance | Paste questions from any Workday / ATS form → AI writes tailored answers in your writing style |
| STAR answers | Interview Prep → STAR Answers | Paste questions → Generate structured behavioral answers |
| Company brief | Interview Prep → Company Brief | Auto-generates research card: culture, red flags, smart questions |
| Tech Q&A | Interview Prep → Tech Q&A | Role-specific technical questions with model answers + difficulty |
| Mock interview feedback | Interview Prep → Mock Interview | Paste your answer → receive grade, strengths, improvements |
| Pipeline analytics | Analytics → Pipeline | Funnel chart, response rates by source, score distribution |
| Skills gap roadmap | Analytics → Skills Gap | Analyzes saved jobs → top missing skills + learning resources |
| Blind spot detector | Analytics → Blind Spots | Detects patterns: over-targeting, ghosting clusters, title mismatches |
| Offer analysis | (from Applications when status = Offer) | Paste offer details → compensation breakdown vs. market bands |
| Negotiation script | Offer analysis → Negotiate | Generates specific dollar asks + opening/closing scripts |
| Saved search alerts | Analytics → Alerts | Save search criteria; re-run daily or weekly |

---

## Sharing With Others

Anyone can run their own private instance. Share these steps:

```bash
# 1. Install Node.js 20+ from nodejs.org (or: brew install node on Mac)

# 2. Navigate to the project folder and start the app
cd ~/Desktop/"Alexecutive Career Ops"
npm install
npm start

# 3. Open http://localhost:3000 → Settings → AI Provider → choose any provider
```

All data (resume, profile, applications) stays on each user's own machine in `data/` — nothing is shared between instances.

---

## Troubleshooting

**No LinkedIn / Indeed results**
```bash
pip install python-jobspy
python3 -c "from jobspy import scrape_jobs; print('OK')"
```

**No Glassdoor / ZipRecruiter results**
→ Not fixable locally: both sites block automated search upstream (Glassdoor HTTP 400 "location not parsed", ZipRecruiter HTTP 403) for all scrapers. Their checkboxes are marked "blocked". LinkedIn + Indeed + Google for Jobs + direct company career pages cover the same postings.

**NVIDIA "404 page not found"**
→ The model ID is missing its org prefix — use the full ID from build.nvidia.com, e.g. `meta/llama-3.3-70b-instruct`, `nvidia/llama-3.1-nemotron-70b-instruct`. Current versions auto-correct bare names at call time.

**NVIDIA 429 / 503 errors during search**
→ Fixed in current version: the app rate-limits itself to NVIDIA's free-tier limits (36 req/min, 4 concurrent) with queueing and retry, and scores jobs in batches of 8 per request.

**"API key not configured" error**
→ Settings → AI Provider → choose a provider and enter its key → Save
→ A saved key displays as masked dots with "✓ Full key is saved" — it is not truncated
→ For Ollama: no key needed — just make sure Ollama is running locally (`ollama serve`)

**Start over from scratch**
→ Topbar → Sessions → **Full Reset** (red button). Wipes applications, resume, profile, and cover letter; your AI keys are kept and the current data is auto-saved as a restorable session first. Use **New Session** instead to keep your profile.

**Ollama connection failed / timeout**
→ Run `ollama serve` in a terminal to start the Ollama daemon
→ Run `ollama pull llama3.1` to download the model if you haven't already
→ Settings shows a live "Ollama Status" indicator — green = running, red = not detected
→ Generation can take 2–5 minutes on first run (CPU) — this is normal; the app waits up to 3 minutes

**"Cannot POST /api/config" when saving AI provider in Settings**
→ Fixed in current version — this was a URL mismatch bug now resolved in `public/js/api.js`
→ The correct endpoint is `/api/profile/config`. If you see this on an older copy, restart the server after updating files.

**Ollama tab shows red / "not detected" after clicking Save**
→ Ollama must be running *before* you try to use it. In a separate Terminal window:
```bash
ollama serve
```
→ Then click **Re-check** in the Ollama provider panel — the dot should turn green and your models will appear
→ Make sure you've pulled at least one model: `ollama pull llama3.1`
→ The live status probe hits `localhost:11434` — if Ollama is on a different port, use the Custom provider option

**Resume or cover letter upload fails (.docx)**
→ Ensure the file is a valid .docx (created by Word, Google Docs, or Pages)
→ Try pasting the text directly using the paste option in Resume & CV
→ PDF uploads are also supported and generally more reliable across platforms

**Port 3000 already in use (`EADDRINUSE`)**
→ A previous server session is still running in the background. Kill it first:
```bash
kill $(lsof -ti:3000)
npm start
```
→ Or use a different port: `PORT=3001 npm start`

**Server won't start / "Cannot find public/" error**
→ You must `cd` into the project folder before running `npm start`:
```bash
cd ~/Desktop/"Alexecutive Career Ops"
npm start
```

**"Cannot find module" error**
→ Same cause — run `npm install` from inside the project folder:
```bash
cd ~/Desktop/"Alexecutive Career Ops"
npm install
```

**Resume tailoring doesn't preserve my formatting**
→ Upload your resume as a DOCX for best style metadata extraction
→ Re-upload via Resume & CV if needed — the first upload trains the style

---

## Regenerate the Setup Guide PDF

```bash
cd ~/Desktop/"Alexecutive Career Ops"
python3 scripts/generate_pdf.py
```

Output: `Alexecutive-Career-Ops-Setup-Guide.pdf` in the project root.
