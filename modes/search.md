# Mode: Search

Triggered by `/opus search` or "find me jobs" / "search for roles".

## Steps

1. **Load search parameters** from `config/search-params.yml`
   - If missing, ask user for: keywords, location, experience level, employment type
   - Offer to save preferences for future searches

2. **Run multi-board search**:
   - LinkedIn (via scraping or API)
   - Indeed, Glassdoor, Builtin
   - Greenhouse API (direct), Lever API (direct), Ashby API (direct)
   - Apply dedup: skip URLs already in `data/applications.md` or `data/pipeline.md`

3. **Quick-score each result** (abbreviated — not a full Block A–F evaluation):
   - Title keyword match vs. `config/profile.yml` target_roles
   - Location/remote match
   - Date posted filter
   - Estimated score range: 🟢 Likely Good Match / 🟡 Check This / 🔴 Likely Poor Match

4. **Present results**:
   ```
   ## Job Search Results — [keywords] in [location]
   Found [N] new roles (deduped against your tracker)

   🟢 Strong Matches (score likely 3.5+)
   1. [Title] — [Company] — [Location] — [Date posted]
      [URL]
   
   🟡 Worth Checking
   2. ...

   🔴 Weak Matches (keeping for reference)
   3. ...

   ---
   Add to pipeline: say "add 1,3,5 to pipeline" to queue for full evaluation
   Evaluate now: paste a URL or say "evaluate #1"
   ```

5. **Pipeline management**:
   - If user says "add N to pipeline": append URLs to `data/pipeline.md`
   - If user says "evaluate #N": trigger evaluate mode on that result

6. **Search filters** (LinkedIn-equivalent):
   - Keywords / job title
   - Location (city, state, "Remote")
   - Date posted (past 24h / week / month)
   - Experience level (Entry / Associate / Mid-Senior / Director / Executive)
   - Employment type (Full-time / Part-time / Contract / Temporary)
   - Work arrangement (On-site / Remote / Hybrid)
   - Easy Apply only (LinkedIn)
   - Company
   - Industry
   - Job function
   - Salary range (where listed)
