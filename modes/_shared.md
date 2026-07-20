# Shared Evaluation Context

This file contains system-level evaluation logic shared across all modes.
Do NOT put user-specific content here — use modes/_profile.md instead.

---

## Evaluation Structure (Blocks A–F)

Every job evaluation follows this 6-block structure:

### Block A — Executive Summary
- One-line verdict: "Apply" / "Consider" / "Skip"
- Detected archetype (primary + secondary if applicable)
- Overall score: X.X / 5.0
- Posting legitimacy flag (see Block G)

### Block B — Fit Analysis
- Map every JD requirement to the user's resume.md and config/profile.yml
- For each: ✅ Strong match | ⚠️ Partial match | ❌ Gap
- Highlight any PASS/FAIL credentials
- Note experience gaps honestly

### Block C — Positioning Strategy
- How to frame the user's background for this specific role
- Narrative angle (what story to tell)
- Key differentiators vs. likely candidate pool
- If career gap exists: include "Gap Strategy" framing advice

### Block D — Compensation & Market
- Estimate salary range if not listed (use public data / industry benchmarks)
- Flag if > 30% above user's target max or below target min
- Note equity, bonus, or other compensation components

### Block E — Tailoring Plan
- Specific changes needed in resume.md for this role
- Keywords to add (from JD, not generic)
- Bullets to rewrite or add
- LinkedIn changes if relevant

### Block F — Interview Prep
- 5 likely behavioral questions for this role + archetype
- STAR story mapping from the user's story bank
- Company-specific insights (mission, recent news, culture signals from JD)
- Suggested questions for the interviewer

### Block G — Posting Legitimacy Check
- Tier 1: Clearly legitimate (company name, specific team, real hiring manager signals)
- Tier 2: Likely legitimate (standard JD format, ATS link)
- Tier 3: Suspicious (vague company, "work from home unlimited income", no ATS)
- Flag ghost jobs: job posted >60 days ago with no updates
- Flag scams: salary too high for role, no company verifiable online

---

## Score Calculation

1. Detect archetype from JD
2. Apply base weights (see docs/ARCHETYPES.md)
3. Apply archetype-specific weight adjustments
4. Apply any user overrides from modes/_profile.md
5. Score each dimension 1–10
6. Weighted average → divide by 2 → final score on 1.0–5.0 scale
7. Apply PASS/FAIL credential caps if applicable

### Score Labels

| Score | Label | Recommendation |
|---|---|---|
| 4.5–5.0 | Excellent Match | Auto-generate tailored resume |
| 3.5–4.4 | Good Match | Offer to tailor resume |
| 3.0–3.4 | Worth Considering | Flag risks, ask before proceeding |
| 2.0–2.9 | Weak Match | Warn, advise against |
| 1.0–1.9 | Poor Match | Explain why, suggest better alternatives |

---

## Report File Format

Save reports as: `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`

Header format:
```
**Company:** [Name]
**Role:** [Title]
**URL:** [Link or "Pasted JD"]
**Score:** X.X / 5.0
**Archetype:** [Primary] / [Secondary]
**Legitimacy:** Tier [1/2/3]
**Date:** YYYY-MM-DD
**Resume:** [filename or ❌ not yet generated]
```

---

## Tracker Entry Format

After every evaluation, add a row to data/applications.md:

```
| {#} | {YYYY-MM-DD} | {Company} | {Role} | {Archetype} | {X.X/5} | Evaluated | ❌ | {one-line note} |
```

Never duplicate — if company+role already exists, update the existing row.
