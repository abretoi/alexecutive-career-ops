/**
 * broadSearch.js — Open-web job coverage beyond curated boards.
 *
 * Part 1: free public aggregator APIs (all curl-verified live) that index jobs
 * across the broader web — The Muse (400k+ postings), Arbeitnow, RemoteOK,
 * Himalayas, Jobicy.
 *
 * Part 2: universal company resolver — given ANY company name, probe the
 * public career-page APIs of every major ATS (Greenhouse, Lever, Ashby,
 * SmartRecruiters, Workable, Recruitee, Breezy). Most companies on the
 * internet host careers on one of these, so a company name typed into
 * Target Companies resolves to its real career site with no hardcoded list.
 */

const T = 10000;
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept': 'application/json' };

function kwMatch(keywords) {
  const terms = String(keywords || '').split(/\s+OR\s+|,/i).map(t => t.trim().toLowerCase()).filter(Boolean);
  if (!terms.length) return () => true;
  return text => { const t = (text || '').toLowerCase(); return terms.some(x => t.includes(x)); };
}

// ── Part 1: open-web aggregators ──────────────────────────────

async function searchTheMuse(keywords, limit = 20) {
  try {
    const res = await fetch(`https://www.themuse.com/api/public/jobs?page=1&q=${encodeURIComponent(keywords)}`, { headers: UA, signal: AbortSignal.timeout(T) });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.results || []).slice(0, limit).map(j => ({
      id: `muse-${j.id}`, title: j.name, company: j.company?.name || '',
      location: (j.locations || []).map(l => l.name).join('; '),
      url: j.refs?.landing_page || '', datePosted: j.publication_date || '',
      description: (j.contents || '').replace(/<[^>]+>/g, ' ').slice(0, 3000),
    }));
  } catch { return []; }
}

async function searchArbeitnow(keywords, limit = 20) {
  try {
    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(keywords)}`, { headers: UA, signal: AbortSignal.timeout(T) });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.data || []).slice(0, limit).map(j => ({
      id: `an-${j.slug}`, title: j.title, company: j.company_name,
      location: j.location || '', remote: !!j.remote, url: j.url,
      description: (j.description || '').replace(/<[^>]+>/g, ' ').slice(0, 3000),
      datePosted: j.created_at ? new Date(j.created_at * 1000).toISOString() : '',
    }));
  } catch { return []; }
}

async function searchRemoteOK(keywords, limit = 20) {
  try {
    const res = await fetch('https://remoteok.com/api', { headers: UA, signal: AbortSignal.timeout(T) });
    if (!res.ok) return [];
    const d = await res.json();
    const kw = kwMatch(keywords);
    return d.filter(j => j?.position && (kw(j.position) || kw(j.description))).slice(0, limit).map(j => ({
      id: `rok-${j.id}`, title: j.position, company: j.company,
      location: j.location || 'Remote', remote: true, url: j.url,
      description: (j.description || '').replace(/<[^>]+>/g, ' ').slice(0, 3000),
      datePosted: j.date || '', salary: j.salary_min && j.salary_max ? `$${j.salary_min} – $${j.salary_max}` : '',
    }));
  } catch { return []; }
}

async function searchHimalayas(keywords, limit = 20) {
  try {
    const res = await fetch('https://himalayas.app/jobs/api?limit=100', { headers: UA, signal: AbortSignal.timeout(T) });
    if (!res.ok) return [];
    const d = await res.json();
    const kw = kwMatch(keywords);
    return (d.jobs || []).filter(j => kw(j.title) || kw(j.excerpt)).slice(0, limit).map(j => ({
      id: `him-${j.guid || j.title}`, title: j.title, company: j.companyName,
      location: (j.locationRestrictions || []).join(', ') || 'Remote', remote: true,
      url: j.applicationLink || j.guid, description: (j.excerpt || j.description || '').replace(/<[^>]+>/g, ' ').slice(0, 3000),
      datePosted: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : '',
    }));
  } catch { return []; }
}

async function searchJobicy(keywords, limit = 20) {
  try {
    const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=${limit}&tag=${encodeURIComponent(keywords.split(/\s+OR\s+/i)[0])}`, { headers: UA, signal: AbortSignal.timeout(T) });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.jobs || []).map(j => ({
      id: `jcy-${j.id}`, title: j.jobTitle, company: j.companyName,
      location: j.jobGeo || 'Remote', remote: true, url: j.url,
      description: (j.jobExcerpt || j.jobDescription || '').replace(/<[^>]+>/g, ' ').slice(0, 3000),
      datePosted: j.pubDate || '', salary: j.annualSalaryMin ? `$${j.annualSalaryMin} – $${j.annualSalaryMax || ''}` : '',
    }));
  } catch { return []; }
}

export async function searchOpenWeb(keywords, limitPerSource = 15) {
  const settled = await Promise.allSettled([
    searchTheMuse(keywords, limitPerSource),
    searchArbeitnow(keywords, limitPerSource),
    searchRemoteOK(keywords, limitPerSource),
    searchHimalayas(keywords, limitPerSource),
    searchJobicy(keywords, limitPerSource),
  ]);
  return settled.flatMap(s => (s.status === 'fulfilled' ? s.value : []));
}

// ── Part 2: universal any-company ATS resolver ────────────────
// Probes every major ATS's public endpoint for the given company slug.
// Wrong guesses 404 harmlessly; hits return real postings from the company's
// own career page.

function toSlug(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
}
function toSlugDashed(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function probeSmartRecruiters(slug, kw) {
  try {
    const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=50`, { headers: UA, signal: AbortSignal.timeout(T) });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.content || []).filter(j => kw(j.name)).map(j => ({
      id: `sr-${j.id}`, title: j.name, company: j.company?.name || slug,
      location: [j.location?.city, j.location?.region, j.location?.country].filter(Boolean).join(', '),
      remote: !!j.location?.remote, url: `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
      datePosted: j.releasedDate || '', description: '',
    }));
  } catch { return []; }
}

async function probeWorkable(slug, kw) {
  try {
    const res = await fetch(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=false`, { headers: UA, signal: AbortSignal.timeout(T) });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.jobs || []).filter(j => kw(j.title)).map(j => ({
      id: `wk-${j.shortcode}`, title: j.title, company: d.name || slug,
      location: [j.city, j.state, j.country].filter(Boolean).join(', '),
      remote: /remote/i.test(j.telecommuting ? 'remote' : ''), url: j.url,
      datePosted: j.published_on || '', description: (j.description || '').replace(/<[^>]+>/g, ' ').slice(0, 2000),
    }));
  } catch { return []; }
}

async function probeRecruitee(slug, kw) {
  try {
    const res = await fetch(`https://${slug}.recruitee.com/api/offers/`, { headers: UA, signal: AbortSignal.timeout(T) });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.offers || []).filter(j => kw(j.title)).map(j => ({
      id: `rct-${j.id}`, title: j.title, company: slug,
      location: j.location || '', remote: /remote/i.test(j.location || ''),
      url: j.careers_url || j.careers_apply_url || '', datePosted: j.created_at || '',
      description: (j.description || '').replace(/<[^>]+>/g, ' ').slice(0, 2000),
    }));
  } catch { return []; }
}

async function probeBreezy(slug, kw) {
  try {
    const res = await fetch(`https://${slug}.breezy.hr/json`, { headers: UA, signal: AbortSignal.timeout(T), redirect: 'manual' });
    if (res.status !== 200) return [];
    const d = await res.json();
    return (Array.isArray(d) ? d : []).filter(j => kw(j.name)).map(j => ({
      id: `bz-${j.id}`, title: j.name, company: slug,
      location: j.location?.name || '', remote: /remote/i.test(j.location?.name || ''),
      url: j.url, datePosted: j.published_date || '', description: '',
    }));
  } catch { return []; }
}

/**
 * Resolve ANY company name across major ATS platforms. Greenhouse/Lever/Ashby
 * probes are handled by the existing board searchers (targetCompanies feeds
 * them directly); this covers SmartRecruiters, Workable, Recruitee, Breezy.
 */
// Probe ONE company across all major ATS platforms (both slug variants).
// Used by the merged registry-routed target-company search.
export async function probeAllATS(name, keywords) {
  const kw = kwMatch(keywords);
  const tasks = [];
  for (const slug of new Set([toSlug(name), toSlugDashed(name)])) {
    if (!slug) continue;
    tasks.push(probeSmartRecruiters(slug, kw), probeWorkable(slug, kw),
               probeRecruitee(slug, kw), probeBreezy(slug, kw));
  }
  const settled = await Promise.allSettled(tasks);
  return settled.flatMap(s => (s.status === 'fulfilled' ? s.value : []));
}

export async function searchAnyCompanyATS(companyNames, keywords) {
  const kw = kwMatch(keywords);
  const tasks = [];
  for (const name of companyNames.slice(0, 10)) {
    for (const slug of new Set([toSlug(name), toSlugDashed(name)])) {
      if (!slug) continue;
      tasks.push(probeSmartRecruiters(slug, kw));
      tasks.push(probeWorkable(slug, kw));
      tasks.push(probeRecruitee(slug, kw));
      tasks.push(probeBreezy(slug, kw));
    }
  }
  const settled = await Promise.allSettled(tasks);
  const seen = new Set();
  return settled.flatMap(s => (s.status === 'fulfilled' ? s.value : []))
    .filter(j => { const k = j.url || j.id; if (seen.has(k)) return false; seen.add(k); return true; });
}
