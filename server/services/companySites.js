/**
 * companySites.js — Direct company career-site search (no aggregator).
 *
 * Two engines, both verified live:
 *  1. Amazon.jobs public JSON search.
 *  2. Workday CXS API — the hosted-careers backend used by hundreds of major
 *     employers (nvidia.wd5.myworkdayjobs.com/wday/cxs/... pattern).
 *
 * Giants that hard-block anonymous API access (Apple, Google, Meta, Tesla) are
 * covered indirectly via Google for Jobs, which indexes their career pages.
 */

const TIMEOUT = 10000;

// Verified Workday tenants: [tenant, wdN, site, display label]
const WORKDAY_TENANTS = [
  ['nvidia',     '5',  'NVIDIAExternalCareerSite',    'NVIDIA'],
  ['adobe',      '5',  'external_experienced',        'Adobe'],
  ['capitalone', '12', 'Capital_One',                 'Capital One'],
  ['wf',         '1',  'WellsFargoJobs',              'Wells Fargo'],
  ['salesforce', '12', 'External_Career_Site',        'Salesforce'],
  ['cvshealth',  '1',  'CVS_Health_Careers',          'CVS Health'],
  ['humana',     '5',  'Humana_External_Career_Site', 'Humana'],
  ['target',     '5',  'targetcareers',               'Target'],
  ['disney',     '5',  'disneycareer',                'Disney (incl. Hulu)'],
  ['paypal',     '1',  'jobs',                        'PayPal'],
  ['intel',      '1',  'External',                    'Intel'],
  ['ebay',       '5',  'apply',                       'eBay'],
  ['hp',         '5',  'ExternalCareerSite',          'HP'],
  ['3m',         '1',  'Search',                      '3M'],
];

// Netflix runs Eightfold — public JSON API, verified live.
async function searchNetflix(keywords, limit = 20) {
  try {
    const res = await fetch(`https://explore.jobs.netflix.net/api/apply/v2/jobs?domain=netflix.com&query=${encodeURIComponent(keywords)}&num=${limit}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) { console.warn(`[companysites] Netflix HTTP ${res.status}`); return []; }
    const d = await res.json();
    return (d.positions || []).map(p => ({
      id: `nflx-${p.id}`, title: p.name, company: 'Netflix',
      location: (p.location || '').replace(/,/g, ', '),
      url: p.canonicalPositionUrl || 'https://explore.jobs.netflix.net/careers',
      description: String(p.job_description || '').replace(/<[^>]+>/g, ' ').slice(0, 3000),
      datePosted: p.t_create ? new Date(p.t_create * 1000).toISOString() : '',
    }));
  } catch (e) {
    console.warn('[companysites] Netflix error:', e.message.slice(0, 80));
    return [];
  }
}

async function searchWorkdayTenant([tenant, wdN, site, label], keywords, limit = 20) {
  try {
    // Workday CXS 400s under burst concurrency — one retry after a short pause
    // recovers it (the endpoint itself is fine, as verified with spaced calls).
    let res;
    for (let attempt = 1; attempt <= 2; attempt++) {
      res = await fetch(`https://${tenant}.wd${wdN}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ searchText: keywords, limit, offset: 0, appliedFacets: {} }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (res.ok || (res.status !== 400 && res.status !== 429)) break;
      if (attempt === 1) await new Promise(r => setTimeout(r, 1200 + Math.random() * 600));
    }
    if (!res.ok) { console.warn(`[companysites] ${label} HTTP ${res.status}`); return []; }
    const data = await res.json();
    return (data.jobPostings || []).filter(j => j.title).map(j => ({
      id:          `wd-${tenant}-${(j.externalPath || '').split('_').pop() || j.title}`,
      title:       j.title,
      company:     label,
      location:    j.locationsText || '',
      url:         `https://${tenant}.wd${wdN}.myworkdayjobs.com/en-US/${site}${j.externalPath || ''}`,
      description: (j.bulletFields || []).join(' · '),
      datePosted:  '',
    }));
  } catch (e) {
    console.warn(`[companysites] ${label} error:`, e.message.slice(0, 80));
    return [];
  }
}

async function searchAmazonJobs(keywords, location, limit = 20) {
  try {
    const url = new URL('https://www.amazon.jobs/en/search.json');
    url.searchParams.set('base_query', keywords);
    if (location) url.searchParams.set('loc_query', location);
    url.searchParams.set('result_limit', String(limit));
    url.searchParams.set('sort', 'recent');
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) { console.warn(`[companysites] Amazon HTTP ${res.status}`); return []; }
    const data = await res.json();
    return (data.jobs || []).map(j => ({
      id:          `amzn-${j.id_icims || j.id}`,
      title:       j.title,
      company:     'Amazon',
      location:    [j.city, j.state, j.country_code].filter(Boolean).join(', '),
      url:         `https://www.amazon.jobs${j.job_path}`,
      description: [j.description_short || j.description, j.basic_qualifications].filter(Boolean).join(' ').replace(/<[^>]+>/g, ' ').slice(0, 3000),
      datePosted:  j.posted_date || '',
    }));
  } catch (e) {
    console.warn('[companysites] Amazon error:', e.message.slice(0, 80));
    return [];
  }
}

/**
 * Fan out across all direct company career sites in parallel.
 * Returns raw job objects; caller normalizes + location-filters.
 */
export async function searchCompanySites(keywords, location, limitPerCompany = 20) {
  const tasks = [
    searchAmazonJobs(keywords, location, limitPerCompany),
    searchNetflix(keywords, limitPerCompany),
    ...WORKDAY_TENANTS.map(t => searchWorkdayTenant(t, keywords, limitPerCompany)),
  ];
  const settled = await Promise.allSettled(tasks);
  return settled.flatMap(s => (s.status === 'fulfilled' ? s.value : []));
}

// Bounded-concurrency pool — keeps the total in-flight requests low so career
// APIs (Workday especially) don't 400 under burst.
async function runPool(makers, concurrency = 3) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, makers.length) }, async () => {
    while (i < makers.length) {
      const idx = i++;
      try { out.push(...(await makers[idx]())); } catch { /* skip */ }
    }
  });
  await Promise.all(workers);
  const seen = new Set();
  return out.filter(j => { const k = j.url || j.id; if (seen.has(k)) return false; seen.add(k); return true; });
}

// Single registry-routed search for a typed list of company names. Each company
// is routed to its ONE correct backend (no redundant probing), with Workday
// pattern-guessing + ATS probes only for unresolved names. Powers Target
// Companies for big employers. Replaces the old dual named+ATS search that
// burst the endpoints into 400s.
export async function searchNamedCompanies(companyNames, keywords, limitPerCompany = 25) {
  const { resolveCompany, workdayGuesses } = await import('./companyRegistry.js');
  const { probeAllATS } = await import('./broadSearch.js');
  const makers = [];

  for (const typed of companyNames.slice(0, 12)) {
    if (/amazon/i.test(typed))  makers.push(() => searchAmazonJobs(keywords, '', limitPerCompany));
    if (/netflix/i.test(typed)) makers.push(() => searchNetflix(keywords, limitPerCompany));

    const r = resolveCompany(typed);
    if (r && r.kind === 'wd') {
      makers.push(() => searchWorkdayTenant([r.args[0], r.args[1], r.args[2], r.name], keywords, limitPerCompany));
    } else if (r && (r.kind === 'gh' || r.kind === 'lever' || r.kind === 'ashby')) {
      // Greenhouse/Lever/Ashby companies are ALSO fed to those board searchers
      // by the orchestrator (greenCompanies=targetCompanies), so nothing extra
      // needed here — the ATS probe below still catches SmartRecruiters etc.
      makers.push(() => probeAllATS(typed, keywords));
    } else {
      // Unresolved / proprietary-site → Workday guesses + all ATS probes.
      // (Proprietary giants like Apple still surface via the Google Jobs weave.)
      for (const [tenant, wd, site] of workdayGuesses(typed)) {
        makers.push(() => searchWorkdayTenant([tenant, wd, site, typed], keywords, limitPerCompany));
      }
      makers.push(() => probeAllATS(typed, keywords));
    }
  }
  return runPool(makers, 3);
}
