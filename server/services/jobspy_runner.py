#!/usr/bin/env python3
"""
jobspy.py — Multi-board job search via python-jobspy
Install: pip install python-jobspy
Usage: python jobspy.py '<json params>'
"""
import sys, json

# Map our career level strings to JobSpy/LinkedIn experience level codes
LEVEL_MAP = {
    'internship': ['internship'],
    'entry':      ['entry_level'],
    'mid':        ['mid_senior_level', 'associate'],
    'senior':     ['mid_senior_level'],
    'lead':       ['mid_senior_level'],
    'manager':    ['mid_senior_level', 'director'],
    'director':   ['director'],
    'vp':         ['director', 'executive'],
    'executive':  ['executive'],
    'c-suite':    ['executive'],
}

def main():
    params = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}

    try:
        from jobspy import scrape_jobs
    except ImportError:
        print(json.dumps({"error": "python-jobspy not installed. Run: pip install python-jobspy"}))
        sys.exit(1)

    # Supported sites: linkedin, indeed, glassdoor, zip_recruiter, google
    valid_spy = {"linkedin", "indeed", "glassdoor", "zip_recruiter", "google"}
    requested = params.get("sites", ["linkedin", "indeed", "glassdoor"])
    sites = [s for s in requested if s in valid_spy] or ["linkedin", "indeed", "glassdoor"]
    keywords  = params.get("keywords", "")
    location  = params.get("location", "")
    limit     = int(params.get("limit", 30))
    hours     = int(params.get("hours_old", 168))
    remote    = params.get("is_remote", None)
    min_sal   = params.get("min_salary", None)
    distance  = params.get("distance", None)

    # Glassdoor rejects country/state-only or unrecognized locations ("location not parsed" → 400).
    # It works best with a major city term, so fall back to one when needed.
    GLASSDOOR_STATE_CITY = {
        "nc": "Raleigh, NC", "north carolina": "Raleigh, NC",
        "ca": "San Francisco, CA", "california": "San Francisco, CA",
        "ny": "New York, NY", "new york": "New York, NY",
        "tx": "Austin, TX", "texas": "Austin, TX",
        "wa": "Seattle, WA", "washington": "Seattle, WA",
        "il": "Chicago, IL", "illinois": "Chicago, IL",
        "ma": "Boston, MA", "massachusetts": "Boston, MA",
        "fl": "Miami, FL", "florida": "Miami, FL",
        "ga": "Atlanta, GA", "georgia": "Atlanta, GA",
        "co": "Denver, CO", "colorado": "Denver, CO",
        "united states": "New York, NY", "usa": "New York, NY", "us": "New York, NY",
    }

    def glassdoor_location(loc):
        raw = (loc or "").strip()
        if not raw:
            return "New York, NY"  # Glassdoor requires a location; default to a major hub
        key = raw.lower().strip()
        # If it's a bare state/country token with no city, map to a representative city
        if "," not in raw and key in GLASSDOOR_STATE_CITY:
            return GLASSDOOR_STATE_CITY[key]
        return raw

    is_single = len(sites) == 1
    site0 = sites[0] if is_single else ""

    eff_location = location
    if is_single and site0 == "glassdoor":
        eff_location = glassdoor_location(location)

    scrape_kwargs = dict(
        site_name=sites,
        search_term=keywords,
        results_wanted=limit,
        hours_old=hours,
        # LinkedIn descriptions require a slow per-job fetch; only enable for LinkedIn-only
        # runs so mixed/other-board searches stay fast and never hit the subprocess timeout.
        linkedin_fetch_description=(is_single and site0 == "linkedin"),
        country_indeed="USA",
    )
    if eff_location and eff_location.strip():
        scrape_kwargs["location"] = eff_location

    # Google for Jobs aggregates postings directly from company career sites,
    # but jobspy's google scraper only works with an explicit natural-language
    # search phrase — without it, google returns nothing.
    if "google" in sites:
        g_term = f"{keywords} jobs"
        if eff_location and eff_location.strip():
            g_term += f" near {eff_location.strip()}"
        if hours <= 24:
            g_term += " since yesterday"
        elif hours <= 168:
            g_term += " since last week"
        scrape_kwargs["google_search_term"] = g_term
    if distance is not None:
        try:
            scrape_kwargs["distance"] = int(distance)
        except (TypeError, ValueError):
            pass
    if remote is not None:
        scrape_kwargs["is_remote"] = remote

    try:
        jobs = scrape_jobs(**scrape_kwargs)
        records = jobs.fillna("").to_dict(orient="records")

        normalized = []
        for r in records:
            min_a = r.get("min_amount", "")
            max_a = r.get("max_amount", "")
            currency = r.get("currency", "USD") or "USD"
            interval = r.get("interval", "yearly") or "yearly"

            # Build salary string from scraped data when available
            if min_a and max_a:
                def fmt(v):
                    try:
                        n = float(v)
                        return f"${int(n):,}" if interval == "yearly" else f"${n:.0f}/hr"
                    except:
                        return str(v)
                salary_str = f"{fmt(min_a)} – {fmt(max_a)}"
                if interval == "yearly":
                    salary_str += "/yr"
            elif min_a:
                try:
                    n = float(min_a)
                    salary_str = f"${int(n):,}/yr" if interval == "yearly" else f"${n:.0f}/hr"
                except:
                    salary_str = str(min_a)
            else:
                salary_str = ""

            # Applicant count: vacancy_count when available, else None
            vc = r.get("vacancy_count", None)
            num_applicants = int(vc) if vc and str(vc).strip() not in ("", "None", "nan") else None

            normalized.append({
                "id":           str(r.get("id", "")),
                "source":       str(r.get("site", "unknown")),
                "title":        str(r.get("title", "")),
                "company":      str(r.get("company", "")),
                "location":     str(r.get("location", "")),
                "salary":       salary_str,
                "salaryMin":    float(min_a) if min_a else None,
                "salaryMax":    float(max_a) if max_a else None,
                "salaryInterval": interval,
                "jobType":      str(r.get("job_type", "full_time")),
                "remote":       bool(r.get("is_remote", False)),
                "url":          str(r.get("job_url", "")),
                "description":  str(r.get("description", ""))[:3000],
                "datePosted":   str(r.get("date_posted", "")),
                "easyApply":    bool(r.get("is_easy_apply", False)),
                "numApplicants": num_applicants,
            })

        # Post-filter by minimum salary when the user set one. jobspy has no native
        # min_salary param, so we drop jobs whose known max is below the floor.
        # Jobs with no salary data are KEPT (most postings omit salary).
        if min_sal:
            try:
                floor = float(min_sal)
                def keep(j):
                    hi = j.get("salaryMax") or j.get("salaryMin")
                    if hi is None or j.get("salaryInterval") != "yearly":
                        return True
                    return hi >= floor
                normalized = [j for j in normalized if keep(j)]
            except (TypeError, ValueError):
                pass

        print(json.dumps(normalized))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
