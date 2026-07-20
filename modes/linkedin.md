# Mode: LinkedIn Optimizer

Triggered by `/opus linkedin` or "optimize my LinkedIn" / "improve my LinkedIn profile".

## Steps

1. **Ask for current content** (if not already provided):
   > "Paste your current LinkedIn content — ideally your headline, About section, and 2–3 of your most recent job descriptions. I'll analyze and rewrite them."

2. **Load user context**:
   - `resume.md` for experience and achievements
   - `config/profile.yml` for target roles and keywords
   - `modes/_profile.md` for narrative

3. **Analyze gaps**:
   - Compare current LinkedIn content vs. target JD keywords
   - Identify missing keywords, weak verbs, unquantified bullets
   - Flag missing sections (recommendations, certifications, skills)

4. **Generate rewrites**:

   ### Headline (120 chars max)
   - Formula: `[Current/Target Title] | [Domain] | [Differentiator or Tool]`
   - Include 2–3 top search keywords
   - No "passionate", "results-driven", "seeking opportunities"

   ### About Section
   - Hook (first 2 lines visible before "See more")
   - Body: expertise, approach, 2–3 quantified achievements
   - CTA: what you're looking for + "connect with me"
   - Keyword density: include top 6–8 target keywords naturally

   ### Experience Bullets (top 3 roles)
   - Rewrite each bullet: Action verb + What + Result with metric
   - Mirror keywords from target JDs
   - At least 1 number per bullet

   ### Skills (top 20 recommendations)
   - Ranked by frequency in target JDs
   - Mix of titles, tools, methodologies, certifications

5. **Present rewrites** in a clear before/after format:
   ```
   ## LinkedIn Optimization Report

   ### Headline
   BEFORE: [current]
   AFTER:  [rewrite]

   ### About — First 2 Lines (Hook)
   BEFORE: [current]
   AFTER:  [rewrite]

   ### About — Full Section
   [Full rewrite]

   ### Experience: [Most Recent Role]
   BULLET 1
   BEFORE: ...
   AFTER:  ...
   [etc.]

   ### Top 20 Skills to Add/Prioritize
   1. [skill] — appears in X% of target JDs
   2. ...
   ```

6. **Open to Work settings**:
   - Recommend specific job titles to list (pulled from `config/profile.yml`)
   - Visibility recommendation based on employment status

See `docs/LINKEDIN-GUIDE.md` for the full strategy playbook.
