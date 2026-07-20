# Mode: Evaluate

Triggered when the user pastes a job URL or description, or runs `/opus evaluate`.

## Steps

1. **Parse the input**
   - If URL: use WebFetch or Playwright to scrape the job description
   - If text: use as-is
   - Extract: company name, role title, location, salary (if listed), requirements, responsibilities

2. **Detect archetype** (see docs/ARCHETYPES.md)
   - Classify into one of 15 industry categories
   - Apply primary + secondary archetype

3. **Load user context**
   - Read `resume.md` for experience and skills
   - Read `config/profile.yml` for preferences, targets, deal-breakers
   - Read `modes/_profile.md` for personalization overrides

4. **Score the role** (1.0–5.0 scale, see docs/ARCHETYPES.md for weights)
   - Hard requirement coverage (30%)
   - Seniority alignment (15%)
   - Domain/industry match (10%)
   - Compensation alignment (10%)
   - Location/remote fit (10%)
   - Career trajectory fit (5%)
   - Credentials/licenses (10%)
   - Skills/portfolio (10%)
   - Apply archetype weight adjustments
   - Apply PASS/FAIL credential cap if applicable

5. **Generate 6-block report** (see modes/_shared.md)
   - Block A: Executive Summary + verdict + score
   - Block B: Fit Analysis (requirement mapping)
   - Block C: Positioning Strategy
   - Block D: Compensation & Market
   - Block E: Tailoring Plan
   - Block F: Interview Prep
   - Block G: Posting Legitimacy Check

6. **Save report**
   - Filename: `reports/{###}-{company-slug}-{YYYY-MM-DD}.md`
   - Sequential number: max existing + 1, zero-padded to 3 digits

7. **Add to tracker**
   - If company+role already in `data/applications.md`: update existing row
   - Otherwise: add new row with status `Evaluated`

8. **Offer next steps**
   - If score ≥ 3.5: "Want me to tailor your resume for this role? (y/n)"
   - If score 3.0–3.4: "This is a borderline match. Here are the main risks. Want to proceed?"
   - If score < 3.0: "I'd recommend against applying here. Here's why: [reasons]. Want to look for better-fit roles?"

## Output Format

Present a condensed summary in chat:

```
## [Company] — [Role Title]
**Score:** X.X/5 · [Label] · [Archetype]
**Verdict:** [Apply / Consider / Skip]

**Top 3 Strengths:**
- ...

**Top 2 Gaps:**
- ...

**Compensation:** [assessment]
**Legitimacy:** Tier [1/2/3]

Full report → reports/[filename].md
```
