/**
 * jobSearch.js — Multi-board job search orchestration
 * Sources: Greenhouse API, Lever API, Ashby API, JobSpy (Python, optional)
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import path from 'path';
import { quickScoreBatch } from './claude.js';
import { searchGlassdoorSession, searchZipRecruiterSession, sessionBoardAvailable } from './sessionBoardSearch.js';
import { searchCompanySites, searchNamedCompanies } from './companySites.js';
import { searchOpenWeb } from './broadSearch.js';
import { hybridRank } from './hybridRank.js';
import { searchGoogleJobs, googleJobsAvailable } from './googleJobs.js';
import { getProfile } from '../db/dataStore.js';
import { scoreKeywords } from './keywordScorer.js';
import { getResume } from '../db/dataStore.js';
import { getApiKey } from '../db/dataStore.js';

const execFileAsync = promisify(execFile);
const JOBSPY_SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)), 'jobspy_runner.py'
);

// ── Keyword matching ──────────────────────────────────────────
// The keywords string can be multi-term: "data analyst OR operations analyst".
// Boards that filter by substring must match ANY term — treating the whole
// string as one literal made multi-keyword searches return 0 from ATS boards.
function kwTerms(keywords) {
  return String(keywords || '')
    .split(/\s+OR\s+|,/i)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
}
function kwMatcher(keywords) {
  const terms = kwTerms(keywords);
  if (!terms.length) return () => true;
  return text => {
    const t = (text || '').toLowerCase();
    return terms.some(term => t.includes(term));
  };
}

// ── Normalizers ───────────────────────────────────────────────
// Infer career level from job title keywords
function inferCareerLevel(title) {
  const t = (title || '').toLowerCase();
  if (/intern|internship/.test(t)) return 'internship';
  if (/\bjr\.?\b|junior|entry.?level|associate(?! director| vp)/.test(t)) return 'entry';
  if (/\bstaff\b|principal|senior|\bsr\.?\b/.test(t)) return 'senior';
  if (/\blead\b/.test(t)) return 'lead';
  if (/chief|\bcto\b|\bcoo\b|\bcfo\b|\bcpo\b|\bceo\b|\bciso\b/.test(t)) return 'c-suite';
  if (/exec(?:utive)?\s+(?:vp|vice)|evp|\bsvp\b/.test(t)) return 'executive';
  if (/\bvp\b|vice.?president/.test(t)) return 'vp';
  if (/\bdir(?:ector)?\b/.test(t)) return 'director';
  if (/manager|\bmgr\b/.test(t)) return 'manager';
  return 'mid';
}

// ── Applicant count helpers ───────────────────────────────────
// Daily applicant rate ranges [min, max] by source board
const APPLICANT_DAILY_RATE = {
  linkedin:         [18, 55],
  indeed:           [12, 40],
  glassdoor:        [8,  28],
  zip_recruiter:    [10, 35],
  google:           [10, 30],
  greenhouse:       [3,  12],
  lever:            [2,  10],
  ashby:            [2,  8],
  wellfound:        [4,  14],
  yc:               [6,  20],
  startupjobs:      [2,  8],
  welcomejungle:    [4,  15],
  cord:             [2,  7],
  builtin:          [5,  18],
  remotive:         [4,  14],
  remoteco:         [2,  8],
  justremote:       [2,  7],
  '4dayweek':       [1,  6],
  remoterocketship: [3,  10],
  jobalert:         [2,  8],
  hrjobsremote:     [2,  7],
  '80khours':       [3,  10],
  idealist:         [3,  12],
  dataaxy:          [2,  8],
  topstartups:      [2,  8],
};

function parseApplicantCount(description) {
  if (!description) return null;
  const patterns = [
    /be among the first\s+([\d,]+)\s+applicants?/i,
    /over\s+([\d,]+)\s+applicants?/i,
    /([\d,]+)\+\s*applicants?/i,
    /(\d[\d,]*)\s+applicants?\s+(?:have applied|applied)/i,
    /(\d[\d,]*)\s+people\s+(?:have )?applied/i,
    /applicants?:\s*([\d,]+)/i,
  ];
  for (const p of patterns) {
    const m = description.match(p);
    if (m) return parseInt(m[1].replace(/,/g, ''), 10);
  }
  return null;
}

function estimateApplicantRange(source, datePosted) {
  const rates = APPLICANT_DAILY_RATE[source?.toLowerCase()] || [2, 8];
  let days = 7;
  if (datePosted) {
    const d = new Date(datePosted);
    if (!isNaN(d)) days = Math.max(1, Math.min(90, Math.floor((Date.now() - d) / 86400000)));
  }
  return {
    min: Math.round(rates[0] * days),
    max: Math.round(rates[1] * days),
    days,
    isEstimate: true,
  };
}

function normalizeJob(j, source) {
  const title       = j.title || '';
  const description = (j.content || j.description || j.body || '').replace(/<[^>]+>/g, ' ').slice(0, 3000);
  const datePosted  = j.updated_at || j.date_posted || j.first_published || '';

  // Applicant count: actual parsed count > jobspy vacancy_count > null (estimate added later)
  const parsedCount = parseApplicantCount(description);
  const vacancyCount = (typeof j.numApplicants === 'number' && j.numApplicants > 0) ? j.numApplicants : null;
  const numApplicants = parsedCount || vacancyCount || null;

  return {
    id:             j.id || `${source}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    source,
    title,
    company:        j.company || j.company_name || '',
    location:       j.location?.name || j.location || '',
    salary:         j.salary || j.compensation || '',
    salaryMin:      j.salaryMin || null,
    salaryMax:      j.salaryMax || null,
    salaryInterval: j.salaryInterval || 'yearly',
    careerLevel:    j.careerLevel || inferCareerLevel(title),
    jobType:        j.job_type || j.employment_type || 'full_time',
    remote:         j.remote || j.is_remote || false,
    url:            j.absolute_url || j.url || j.job_url || '',
    description,
    datePosted,
    easyApply:      j.easy_apply || false,
    numApplicants,
    seenOnBoards:   [source],
    score:          null,
    archetype:      null,
    verdict:        null,
    scoreReason:    null,
  };
}

export { parseApplicantCount, estimateApplicantRange };

// ── Greenhouse ────────────────────────────────────────────────
async function searchGreenhouse(companies = [], keywords = '') {
  const results = [];
  const kw = kwMatcher(keywords);

  return inPool(companies, async slug => {
    try {
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) { console.warn(`[greenhouse] ${slug} HTTP ${res.status}`); return []; }
      const data = await res.json();
      return (data.jobs || [])
        .filter(j => !keywords || kw(j.title) || kw(j.content))
        .map(j => normalizeJob({ ...j, company: j.company?.name || slug }, 'greenhouse'));
    } catch (e) { console.warn(`[greenhouse] ${slug} error:`, e.message); return []; }
  });
}

// ── Lever ─────────────────────────────────────────────────────
async function searchLever(companies = [], keywords = '') {
  const results = [];
  const kw = kwMatcher(keywords);

  return inPool(companies, async slug => {
    try {
      const res = await fetch(
        `https://api.lever.co/v0/postings/${slug}?mode=json`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) { console.warn(`[lever] ${slug} HTTP ${res.status}`); return []; }
      const jobs = await res.json();
      return (Array.isArray(jobs) ? jobs : [])
        .filter(j => !keywords || kw(j.text))
        .map(j => normalizeJob({ ...j, title: j.text, company: slug, location: j.categories?.location, url: j.hostedUrl }, 'lever'));
    } catch (e) { console.warn(`[lever] ${slug} error:`, e.message); return []; }
  });
}

// ── Ashby ─────────────────────────────────────────────────────
async function searchAshby(companies = [], keywords = '') {
  const kw = kwMatcher(keywords);
  // Official Ashby posting API — the old jobs.ashbyhq.com GraphQL schema was
  // removed upstream (Cannot query field "jobBoard"), which silently zeroed
  // this board. https://developers.ashbyhq.com/reference/jobpostinglist
  return inPool(companies, async slug => {
    try {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) { console.warn(`[ashby] ${slug} HTTP ${res.status}`); return []; }
      const data = await res.json();
      return (data?.jobs || [])
        .filter(j => !keywords || kw(j.title) || kw(j.descriptionPlain))
        .map(j => normalizeJob({
          id: j.id, title: j.title, company: slug,
          location: j.location, remote: j.isRemote,
          url: j.jobUrl || j.applyUrl || `https://jobs.ashbyhq.com/${slug}/${j.id}`,
          description: (j.descriptionPlain || '').slice(0, 3000),
          datePosted: j.publishedAt,
          job_type: j.employmentType,
          salary: j.compensation?.compensationTierSummary || '',
        }, 'ashby'));
    } catch (e) { console.warn(`[ashby] ${slug} error:`, e.message); return []; }
  });
}

// ── JobSpy (Python — LinkedIn, Indeed, Glassdoor) ─────────────
async function searchJobSpy(params) {
  try {
    const { stdout } = await execFileAsync(
      'python3',
      [JOBSPY_SCRIPT, JSON.stringify(params)],
      { timeout: 120000 }
    );
    const result = JSON.parse(stdout.trim());
    if (result?.error) {
      console.warn('JobSpy warning:', result.error);
      return [];
    }
    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.warn('JobSpy unavailable:', e.message);
    return [];
  }
}

// ── RSS XML parser (no external deps) ─────────────────────────
function parseRSS(xml) {
  const items = [];
  for (const block of (xml.match(/<item[\s>]([\s\S]*?)<\/item>/g) || [])) {
    const get = tag => {
      const m = block.match(new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`));
      if (!m) return '';
      return m[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#\d+;/g, '')
        .trim();
    };
    items.push({
      title:       get('title'),
      url:         get('link') || get('guid'),
      company:     get('author') || get('dc:creator') || '',
      description: get('description') || get('content:encoded') || '',
      pubDate:     get('pubDate') || get('dc:date') || '',
    });
  }
  return items;
}

async function fetchRSS(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlexecutiveJobSearch/1.0)', 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' },
    });
    if (!res.ok) return [];
    return parseRSS(await res.text());
  } catch { return []; }
}

// ── Remotive (free public JSON API) ───────────────────────────
async function searchRemotive(keywords = '') {
  try {
    const url = new URL('https://remotive.com/api/remote-jobs');
    if (keywords) url.searchParams.set('search', keywords);
    url.searchParams.set('limit', '30');
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || []).map(j => normalizeJob({
      id: `remotive-${j.id}`,
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || 'Remote',
      remote: true,
      url: j.url,
      description: (j.description || '').replace(/<[^>]+>/g, ' ').slice(0, 3000),
      datePosted: j.publication_date,
      salary: j.salary || '',
      job_type: j.job_type || 'full_time',
    }, 'remotive'));
  } catch { return []; }
}

// ── Y Combinator / Work at a Startup ──────────────────────────
async function searchYC(keywords = '') {
  // Confirmed endpoint: https://www.workatastartup.com/jobs/search?q=<kw>
  try {
    const res = await fetch(
      `https://www.workatastartup.com/jobs/search?q=${encodeURIComponent(keywords)}&limit=30`,
      { signal: AbortSignal.timeout(12000), headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = data.jobs || (Array.isArray(data) ? data : []);
    return jobs.map(j => normalizeJob({
      id:         `yc-${j.id}`,
      title:      j.title || '',
      company:    j.companyName || '',
      location:   j.location || 'Remote',
      remote:     /remote/i.test(j.location || ''),
      url:        j.applyUrl || `https://www.workatastartup.com/jobs/${j.id}`,
      description: j.companyOneLiner || '',
      datePosted: j.companyLastActiveAt || '',
      salary:     j.salary || '',
      job_type:   j.jobType || 'full_time',
    }, 'yc'));
  } catch { return []; }
}










// ── ATS-backed community board search ─────────────────────────
// Wellfound, startup.jobs, WttJ, Cord, and Built-in block public scraping.
// We serve their communities by searching via the ATS systems those companies use.
// Each board has a curated list of companies known to actively post there.
async function searchViaCuratedATS(sourceLabel, companyLists, keywords) {
  const [gh, lv, ash] = await Promise.all([
    companyLists.greenhouse ? searchGreenhouse(companyLists.greenhouse, keywords) : Promise.resolve([]),
    companyLists.lever      ? searchLever(companyLists.lever, keywords)           : Promise.resolve([]),
    companyLists.ashby      ? searchAshby(companyLists.ashby, keywords)           : Promise.resolve([]),
  ]);
  return [...gh, ...lv, ...ash].map(j => ({ ...j, source: sourceLabel }));
}

// Companies prominently listed on Wellfound (formerly AngelList Talent)
async function searchWellfound(keywords = '') {
  return searchViaCuratedATS('wellfound', {
    greenhouse: ['stripe', 'airbnb', 'notion', 'figma', 'retool', 'coinbase', 'brex', 'ramp', 'chime',
                 'rippling', 'lattice', 'airtable', 'miro', 'amplitude', 'clickup', 'loom', 'mercury',
                 'benchling', 'samsara', 'faire', 'navan', 'segment', 'intercom', 'gusto', 'vercel',
                 'databricks', 'snowflake', 'plaid', 'scale-ai', 'weights-biases', 'supabase'],
    lever:      ['atlassian', 'zendesk', 'twilio', 'postman', 'algolia', 'front', 'productboard', 'dovetail'],
    ashby:      ['perplexity', 'mistral', 'cursor', 'anysphere', 'modal', 'langchain', 'replicate', 'openai',
                 'arc', 'warp', 'raycast', 'zed', 'replit', 'inngest', 'dagger'],
  }, keywords);
}

// Companies actively posting on startup.jobs
async function searchStartupJobs(keywords = '') {
  return searchViaCuratedATS('startupjobs', {
    greenhouse: ['notion', 'figma', 'linear', 'retool', 'vercel', 'airtable', 'miro', 'amplitude', 'clickup',
                 'loom', 'hex', 'mercury', 'ramp', 'rippling', 'benchling', 'samsara', 'scale-ai', 'supabase',
                 'neon', 'sourcegraph'],
    ashby:      ['perplexity', 'mistral', 'cursor', 'anysphere', 'modal', 'langchain', 'replicate',
                 'arc', 'warp', 'raycast', 'zed', 'replit'],
    lever:      ['algolia', 'postman', 'productboard', 'dovetail', 'descript', 'fastly'],
  }, keywords);
}

// Companies prominently featured on Welcome to the Jungle (formerly Otta)
async function searchWelcomeJungle(keywords = '') {
  return searchViaCuratedATS('welcomejungle', {
    greenhouse: ['spotify', 'contentful', 'miro', 'typeform', 'aircall', 'brex', 'datadog',
                 'confluent', 'notion', 'figma', 'amplitude', 'segment', 'intercom', 'vercel',
                 'loom', 'retool', 'benchling'],
    lever:      ['algolia', 'productboard', 'zendesk', 'twilio', 'squarespace', 'eventbrite', 'dovetail'],
    ashby:      ['perplexity', 'mistral', 'cursor', 'anysphere', 'modal', 'langchain'],
  }, keywords);
}

// Companies featured on Cord (UK/EU-focused tech jobs)
async function searchCord(keywords = '') {
  return searchViaCuratedATS('cord', {
    greenhouse: ['contentful', 'aircall', 'typeform', 'miro', 'brex', 'stripe', 'notion', 'figma',
                 'vercel', 'datadog', 'segment', 'intercom', 'loom', 'amplitude'],
    lever:      ['algolia', 'zendesk', 'twilio', 'productboard', 'dovetail', 'front'],
    ashby:      ['perplexity', 'mistral', 'cursor', 'anysphere', 'modal'],
  }, keywords);
}

// Companies featured on Built In (US tech community job boards)
async function searchBuiltIn(keywords = '') {
  return searchViaCuratedATS('builtin', {
    greenhouse: ['stripe', 'airbnb', 'notion', 'figma', 'coinbase', 'databricks', 'snowflake', 'amplitude',
                 'miro', 'datadog', 'confluent', 'rippling', 'lattice', 'airtable', 'gusto', 'ramp',
                 'chime', 'brex', 'benchling', 'samsara', 'scale-ai', 'retool', 'vercel'],
    lever:      ['atlassian', 'zendesk', 'twilio', 'postman', 'algolia', 'front', 'squarespace', 'eventbrite'],
    ashby:      ['perplexity', 'mistral', 'cursor', 'anysphere', 'modal', 'replicate'],
  }, keywords);
}

// ── Default company slugs for ATS search ─────────────────────
const DEFAULT_GREENHOUSE = [
  // FAANG-adjacent & unicorns
  'stripe', 'airbnb', 'notion', 'figma', 'linear', 'retool', 'vercel', 'anthropic',
  'coinbase', 'databricks', 'snowflake', 'plaid', 'brex', 'ramp', 'chime',
  // YC / startup ecosystem
  'gusto', 'rippling', 'lattice', 'airtable', 'miro', 'amplitude', 'mixpanel',
  'clickup', 'loom', 'mercury', 'hex', 'benchling', 'samsara', 'toast', 'faire',
  'navan', 'segment', 'intercom', 'dropbox', 'datadog', 'confluent', 'dbt-labs',
  // AI / dev tools
  'scale-ai', 'cohere-ai', 'runway', 'huggingface', 'together-ai', 'weights-biases',
  'replit', 'cursor', 'sourcegraph', 'supabase', 'planetscale', 'neon',
  // Large employers across industries (ops, finance, health, consumer)
  'robinhood', 'reddit', 'pinterest', 'instacart', 'lyft', 'affirm', 'flexport',
  'wayfair', 'duolingo', 'cloudflare', 'mongodb', 'gitlab', 'elastic', 'okta',
  'asana', 'calendly', 'discord', 'roblox', 'axon', 'gopuff', 'attentive',
  'doordashusa', 'oscarhealth', 'circle', 'kraken', 'carta', 'checkr', 'zscaler',
];
const DEFAULT_LEVER = [
  'netflix', 'atlassian', 'twilio', 'zendesk', 'hashicorp',
  'postman', 'squarespace', 'eventbrite', 'clio', 'algolia', 'front', 'fastly',
  'shippo', 'productboard', 'dovetail', 'descript', 'papaya-global',
  'palantir', 'plusgrade', 'zoox', 'voleon', 'outschool', 'kandji',
];
const DEFAULT_ASHBY = [
  'perplexity', 'mistral', 'anysphere', 'modal', 'langchain',
  'openai', 'character-ai', 'stability-ai', 'replicate', 'midjourney',
  'arc', 'warp', 'raycast', 'zed', 'fig', 'dagger', 'inngest',
  'ramp', 'linear', 'notion', 'deel', 'sierra', 'glean', 'harvey', 'eightsleep',
];

// Run per-company board fetches in parallel pools instead of one-at-a-time —
// sequential fetches made a 46-company Greenhouse pass take minutes.
async function inPool(items, worker, concurrency = 8) {
  const results = [];
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i]).catch(() => null);
    }
  });
  await Promise.all(runners);
  return results.filter(Boolean).flat();
}

// ── Main Search ───────────────────────────────────────────────
// ── Deduplication key ─────────────────────────────────────────
// Source priority: lower index = preferred when duplicate detected
const SOURCE_PRIORITY = [
  'linkedin','indeed','glassdoor','zip_recruiter','google',
  'greenhouse','lever','ashby',
  'wellfound','yc','startupjobs','welcomejungle','cord','builtin',
  'remotive','4dayweek','remoteco','justremote',
  'remoterocketship','jobalert','hrjobsremote','80khours','idealist',
  'dataaxy','topstartups',
];

function dedupKey(job) {
  const co    = (job.company || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
  const title = (job.title   || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
  return `${co}|${title}`;
}

export { dedupKey };

/**
 * @param {object} params
 * @param {string} params.keywords
 * @param {string} params.location
 * @param {string[]} params.boards
 * @param {string} params.datePosted
 * @param {string[]} params.careerLevels
 * @param {string[]} params.targetCompanies
 * @param {number} params.limit
 * @param {function} onBatch - callback(jobs[], source) called as each source completes
 */
export async function search(params, onBatch) {
  const { keywords = '', location = '', targetCompanies = [],
          boards = ['linkedin','indeed','glassdoor','greenhouse','lever','ashby'],
          datePosted = 'past_week', limit = 30,
          careerLevels = [], minSalary = null,
          companySizes = [], industries = [] } = params;

  // When the user targets specific companies, weave the names into the
  // aggregator queries — this is how Apple/Google/Tesla/Microsoft (proprietary
  // career sites, no public API) actually surface: Google/LinkedIn/Indeed index
  // their postings. "analyst" + [Apple] → "Apple analyst".
  const companyWeave = targetCompanies.slice(0, 3).join(' ');
  const wovenKeywords = targetCompanies.length
    ? `${companyWeave} ${keywords}`.trim()
    : keywords;

  // Build location filter for boards that return global results
  const isRemoteSearch = /^remote$|anywhere|work from home|wfh/i.test(location.trim()) || !location.trim();
  const locationFilter = isRemoteSearch ? null : buildLocationFilter(location);

  const hasApiKey = !!getApiKey();
  const hoursOld  = { past_24h: 24, past_week: 168, past_month: 720, any_time: 99999 }[datePosted] ?? 168;

  const greenCompanies = targetCompanies.length ? targetCompanies : DEFAULT_GREENHOUSE;
  const leverCompanies = targetCompanies.length ? targetCompanies : DEFAULT_LEVER;
  const ashbyCompanies = targetCompanies.length ? targetCompanies : DEFAULT_ASHBY;

  // JobSpy-backed boards (Python). Glassdoor/ZipRecruiter are NOT jobspy-able
  // (anti-bot walls) — they run through the user's connected account session instead.
  const spySites = ['linkedin','indeed'].filter(s => boards.includes(s));

  // If the user targeted companies, restrict results to those companies
  // (case/space-insensitive substring match on the job's company field).
  const companyGate = targetCompanies.length
    ? targetCompanies.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''))
    : null;
  const matchesTargetCompany = job => {
    if (!companyGate) return true;
    const c = (job.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return companyGate.some(t => c.includes(t) || t.includes(c));
  };

  const scoringTasks = [];
  const emit = (fetchFn, label) => fetchFn.then(jobs => {
    let filtered = locationFilter ? jobs.filter(j => matchesLocation(j, locationFilter)) : jobs;
    // Career-level filter applied to EVERY board.
    if (careerLevels.length) {
      filtered = filtered.filter(j => !j.careerLevel || careerLevels.includes(j.careerLevel));
    }
    // Company-size + industry gates (metadata inferred from the employer).
    if (companySizes.length) filtered = filtered.filter(j => matchesCompanySize(j, companySizes));
    if (industries.length)   filtered = filtered.filter(j => matchesIndustry(j, industries));
    const deferred = processAndEmit(filtered, label, onBatch, hasApiKey, keywords);
    if (deferred) scoringTasks.push(deferred);
  });

  // Company-restricted emit: only keep jobs from the targeted companies. Used
  // for the aggregator boards when Target Companies is set, so a search for
  // "Apple" via Google Jobs returns Apple roles, not every analyst job.
  const emitCompanyGated = (fetchFn, label) => emit(
    fetchFn.then(jobs => companyGate ? jobs.filter(matchesTargetCompany) : jobs), label);

  const promises = [];

  // ── ATS boards ─────────────────────────────────────────────
  if (boards.includes('greenhouse'))
    promises.push(emit(searchGreenhouse(greenCompanies, keywords), 'Greenhouse'));
  if (boards.includes('lever'))
    promises.push(emit(searchLever(leverCompanies, keywords), 'Lever'));
  if (boards.includes('ashby'))
    promises.push(emit(searchAshby(ashbyCompanies, keywords), 'Ashby'));

  // ── JobSpy — one subprocess per site so a single board failure never blocks the rest ──
  if (spySites.length > 0) {
    const isRemote = /remote|anywhere|work from home|wfh/i.test(location) || !location.trim();
    for (const site of spySites) {
      // LinkedIn fetches each description individually (~1.3s/job) — cap it at 25
      // in mixed searches so its subprocess finishes in ~35s instead of 65s+.
      const spyLimit = site === 'linkedin' ? Math.min(Math.max(limit, 25), 25) : Math.max(limit, 50);
      // Weave targeted company names into the query so LinkedIn/Indeed return
      // those employers' postings; gate results to the targeted companies.
      const spyParams = { sites: [site], keywords: wovenKeywords, location: geocodableLocation(location), limit: spyLimit, hours_old: hoursOld };
      if (!isRemote && location.trim()) spyParams.distance = 50;
      if (careerLevels.length) spyParams.career_levels = careerLevels;
      if (minSalary) spyParams.min_salary = minSalary;
      promises.push(emitCompanyGated(searchJobSpy(spyParams), site));
    }
  }

  // ── Direct company career sites (Amazon.jobs + Workday-hosted majors) ──
  // When Target Companies is set, skip the broad 16-employer sweep (the named-
  // company search below covers the targets precisely); otherwise sweep all.
  if (boards.includes('companysites') && !targetCompanies.length) {
    promises.push(emit(
      searchCompanySites(keywords, geocodableLocation(location), 20).then(js => js.map(j => normalizeJob(j, 'companysites'))),
      'Company Career Sites'));
  }

  // ── Open-web aggregators (The Muse 400k+, Arbeitnow, RemoteOK, Himalayas, Jobicy) ──
  if (boards.includes('openweb')) {
    promises.push(emitCompanyGated(
      searchOpenWeb(wovenKeywords, 15).then(js => js.map(j => normalizeJob(j, 'openweb'))),
      'Open Web'));
  }

  // ── Universal any-company ATS resolver + direct company backends ──
  // Target Companies get resolved to their REAL careers API: the registry
  // routes big employers to Workday/Greenhouse/Lever/Ashby (with Workday
  // pattern-guessing for unlisted names), and the ATS probe covers
  // SmartRecruiters/Workable/Recruitee/Breezy. Proprietary-site giants
  // (Apple/Google/Tesla/Microsoft) are covered by the query-weave above.
  if (targetCompanies.length) {
    promises.push(emitCompanyGated(
      searchNamedCompanies(targetCompanies, keywords, 25).then(js => js.map(j => normalizeJob(j, 'companysites'))),
      'Target Companies (direct)'));
  }

  // ── Google Jobs (whole-web index) via the user's trusted Google session ──
  // The single best channel for proprietary-site employers — Google indexes
  // Apple/Google/Tesla/Microsoft career pages. Company names woven into the query.
  if (boards.includes('google') && googleJobsAvailable()) {
    promises.push(emitCompanyGated(
      searchGoogleJobs(wovenKeywords, geocodableLocation(location), 20).then(js => js.map(j => normalizeJob(j, 'google'))),
      'Google Jobs'));
  }

  // ── Session-backed boards (user's own logged-in account) ────
  // Only runs when the account is connected in Profile & Settings.
  if (boards.includes('glassdoor') && sessionBoardAvailable('glassdoor')) {
    promises.push(emit(
      searchGlassdoorSession(keywords, geocodableLocation(location), 20).then(js => js.map(j => normalizeJob(j, 'glassdoor'))),
      'Glassdoor'));
  }
  if (boards.includes('zip_recruiter') && sessionBoardAvailable('zip_recruiter')) {
    promises.push(emit(
      searchZipRecruiterSession(keywords, geocodableLocation(location), 20).then(js => js.map(j => normalizeJob(j, 'zip_recruiter'))),
      'ZipRecruiter'));
  }

  // ── Native API boards ───────────────────────────────────────
  if (boards.includes('remotive'))         promises.push(emit(searchRemotive(keywords),         'Remotive'));
  if (boards.includes('yc'))               promises.push(emit(searchYC(keywords),               'Y Combinator'));

  // ── ATS-backed community boards ────────────────────────────
  if (boards.includes('wellfound'))    promises.push(emit(searchWellfound(keywords),    'Wellfound'));
  if (boards.includes('startupjobs'))  promises.push(emit(searchStartupJobs(keywords),  'startup.jobs'));
  if (boards.includes('welcomejungle'))promises.push(emit(searchWelcomeJungle(keywords),'Welcome to the Jungle'));
  if (boards.includes('cord'))         promises.push(emit(searchCord(keywords),         'Cord'));
  if (boards.includes('builtin'))      promises.push(emit(searchBuiltIn(keywords),      'Built In'));

  // ── Placeholder boards (no stable public API, no community ATS list yet) ─

  // Phase 1 completes when the boards return — all results are already emitted.
  await Promise.allSettled(promises);

  // Phase 2 kicks off WITHOUT being awaited by the caller's "search done"
  // gate — AI scores stream to the client as background enrichment.
  const scoringDone = Promise.allSettled(scoringTasks.map(fn => fn()));
  return { scoringDone };
}

// ── US Metro Markets (Nielsen-DMA-style) ──────────────────────
// One data source drives everything: searching any member city (or the metro
// name/alias) matches the whole metro, and metro names normalize to a
// geocodable primary city for LinkedIn/Indeed. Top ~65 US markets.
export const METROS = [
  { name: 'New York Metro',           st: 'NY', primary: 'New York, NY',       aliases: ['nyc', 'tri-state'],            cities: ['new york', 'brooklyn', 'manhattan', 'queens', 'bronx', 'staten island', 'jersey city', 'hoboken', 'newark', 'white plains', 'stamford'] },
  { name: 'Los Angeles Metro',        st: 'CA', primary: 'Los Angeles, CA',    aliases: ['greater los angeles', 'la metro'], cities: ['los angeles', 'santa monica', 'pasadena', 'long beach', 'culver city', 'el segundo', 'burbank', 'glendale', 'irvine', 'anaheim', 'orange county'] },
  { name: 'Chicago Metro',            st: 'IL', primary: 'Chicago, IL',        aliases: ['chicagoland'],                 cities: ['chicago', 'evanston', 'naperville', 'schaumburg', 'oak brook', 'deerfield'] },
  { name: 'Philadelphia Metro',       st: 'PA', primary: 'Philadelphia, PA',   aliases: ['philly', 'delaware valley'],   cities: ['philadelphia', 'king of prussia', 'conshohocken', 'camden', 'wilmington'] },
  { name: 'Dallas-Fort Worth',        st: 'TX', primary: 'Dallas, TX',         aliases: ['dfw', 'metroplex'],            cities: ['dallas', 'fort worth', 'plano', 'irving', 'frisco', 'richardson', 'arlington', 'grapevine', 'mckinney'] },
  { name: 'San Francisco Bay Area',   st: 'CA', primary: 'San Francisco, CA',  aliases: ['bay area', 'sf metro', 'silicon valley'], cities: ['san francisco', 'oakland', 'san jose', 'palo alto', 'mountain view', 'sunnyvale', 'menlo park', 'redwood city', 'south san francisco', 'berkeley', 'fremont', 'santa clara', 'cupertino'] },
  { name: 'Atlanta Metro',            st: 'GA', primary: 'Atlanta, GA',        aliases: ['greater atlanta'],             cities: ['atlanta', 'alpharetta', 'marietta', 'sandy springs', 'decatur', 'roswell'] },
  { name: 'Houston Metro',            st: 'TX', primary: 'Houston, TX',        aliases: ['greater houston'],             cities: ['houston', 'the woodlands', 'sugar land', 'katy', 'pasadena tx'] },
  { name: 'Washington DC Metro',      st: 'DC', primary: 'Washington, DC',     aliases: ['dmv area', 'dc metro'],        cities: ['washington', 'arlington', 'alexandria', 'bethesda', 'reston', 'mclean', 'tysons', 'silver spring', 'rockville'] },
  { name: 'Boston Metro',             st: 'MA', primary: 'Boston, MA',         aliases: ['greater boston'],              cities: ['boston', 'cambridge', 'somerville', 'waltham', 'quincy', 'burlington ma'] },
  { name: 'Phoenix Metro',            st: 'AZ', primary: 'Phoenix, AZ',        aliases: ['valley of the sun'],           cities: ['phoenix', 'scottsdale', 'tempe', 'mesa', 'chandler', 'gilbert', 'glendale az'] },
  { name: 'Seattle-Tacoma',           st: 'WA', primary: 'Seattle, WA',        aliases: ['puget sound', 'seattle metro'], cities: ['seattle', 'bellevue', 'redmond', 'kirkland', 'tacoma', 'renton', 'bothell'] },
  { name: 'Tampa-St. Petersburg',     st: 'FL', primary: 'Tampa, FL',          aliases: ['tampa bay'],                   cities: ['tampa', 'st petersburg', 'saint petersburg', 'clearwater', 'brandon'] },
  { name: 'Minneapolis-St. Paul',     st: 'MN', primary: 'Minneapolis, MN',    aliases: ['twin cities'],                 cities: ['minneapolis', 'st paul', 'saint paul', 'bloomington mn', 'eden prairie'] },
  { name: 'Detroit Metro',            st: 'MI', primary: 'Detroit, MI',        aliases: ['metro detroit'],               cities: ['detroit', 'ann arbor', 'troy', 'dearborn', 'southfield', 'auburn hills'] },
  { name: 'Denver-Boulder',           st: 'CO', primary: 'Denver, CO',         aliases: ['front range', 'denver metro'], cities: ['denver', 'boulder', 'aurora', 'lakewood', 'centennial', 'broomfield'] },
  { name: 'Orlando Metro',            st: 'FL', primary: 'Orlando, FL',        aliases: [],                              cities: ['orlando', 'lake mary', 'maitland', 'winter park'] },
  { name: 'Miami-Fort Lauderdale',    st: 'FL', primary: 'Miami, FL',          aliases: ['south florida'],               cities: ['miami', 'fort lauderdale', 'boca raton', 'west palm beach', 'coral gables', 'doral'] },
  { name: 'Cleveland-Akron',          st: 'OH', primary: 'Cleveland, OH',      aliases: ['northeast ohio'],              cities: ['cleveland', 'akron', 'beachwood', 'independence oh'] },
  { name: 'Sacramento Metro',         st: 'CA', primary: 'Sacramento, CA',     aliases: [],                              cities: ['sacramento', 'roseville', 'folsom', 'rancho cordova'] },
  { name: 'Charlotte Metro',          st: 'NC', primary: 'Charlotte, NC',      aliases: [],                              cities: ['charlotte', 'concord', 'huntersville', 'fort mill'] },
  { name: 'Portland Metro',           st: 'OR', primary: 'Portland, OR',       aliases: [],                              cities: ['portland', 'beaverton', 'hillsboro', 'lake oswego', 'vancouver wa'] },
  { name: 'St. Louis Metro',          st: 'MO', primary: 'St. Louis, MO',      aliases: [],                              cities: ['st louis', 'saint louis', 'clayton', 'chesterfield mo'] },
  { name: 'Raleigh-Durham',           st: 'NC', primary: 'Raleigh, NC',        aliases: ['research triangle', 'rtp', 'triangle'], cities: ['raleigh', 'durham', 'cary', 'chapel hill', 'morrisville', 'apex', 'research triangle'] },
  { name: 'Pittsburgh Metro',         st: 'PA', primary: 'Pittsburgh, PA',     aliases: [],                              cities: ['pittsburgh', 'cranberry township'] },
  { name: 'Salt Lake City Metro',     st: 'UT', primary: 'Salt Lake City, UT', aliases: ['wasatch front', 'silicon slopes'], cities: ['salt lake city', 'lehi', 'provo', 'sandy ut', 'draper', 'ogden'] },
  { name: 'Nashville Metro',          st: 'TN', primary: 'Nashville, TN',      aliases: ['middle tennessee'],            cities: ['nashville', 'franklin', 'brentwood tn', 'murfreesboro'] },
  { name: 'Baltimore Metro',          st: 'MD', primary: 'Baltimore, MD',      aliases: [],                              cities: ['baltimore', 'columbia md', 'towson', 'annapolis'] },
  { name: 'San Diego Metro',          st: 'CA', primary: 'San Diego, CA',      aliases: [],                              cities: ['san diego', 'la jolla', 'carlsbad', 'sorrento valley', 'chula vista'] },
  { name: 'San Antonio Metro',        st: 'TX', primary: 'San Antonio, TX',    aliases: [],                              cities: ['san antonio', 'new braunfels'] },
  { name: 'Indianapolis Metro',       st: 'IN', primary: 'Indianapolis, IN',   aliases: ['indy'],                        cities: ['indianapolis', 'carmel', 'fishers'] },
  { name: 'Columbus Metro',           st: 'OH', primary: 'Columbus, OH',       aliases: [],                              cities: ['columbus', 'dublin oh', 'westerville', 'new albany'] },
  { name: 'Kansas City Metro',        st: 'MO', primary: 'Kansas City, MO',    aliases: ['kc metro'],                    cities: ['kansas city', 'overland park', 'olathe', 'lenexa'] },
  { name: 'Austin Metro',             st: 'TX', primary: 'Austin, TX',         aliases: ['silicon hills'],               cities: ['austin', 'round rock', 'cedar park', 'pflugerville'] },
  { name: 'Cincinnati Metro',         st: 'OH', primary: 'Cincinnati, OH',     aliases: [],                              cities: ['cincinnati', 'covington ky', 'mason oh', 'blue ash'] },
  { name: 'Milwaukee Metro',          st: 'WI', primary: 'Milwaukee, WI',      aliases: [],                              cities: ['milwaukee', 'waukesha', 'brookfield wi'] },
  { name: 'Las Vegas Metro',          st: 'NV', primary: 'Las Vegas, NV',      aliases: [],                              cities: ['las vegas', 'henderson', 'north las vegas', 'summerlin'] },
  { name: 'Oklahoma City Metro',      st: 'OK', primary: 'Oklahoma City, OK',  aliases: ['okc'],                         cities: ['oklahoma city', 'edmond', 'norman'] },
  { name: 'Jacksonville Metro',       st: 'FL', primary: 'Jacksonville, FL',   aliases: [],                              cities: ['jacksonville', 'st augustine'] },
  { name: 'Grand Rapids Metro',       st: 'MI', primary: 'Grand Rapids, MI',   aliases: ['west michigan'],               cities: ['grand rapids', 'kentwood'] },
  { name: 'Hampton Roads',            st: 'VA', primary: 'Virginia Beach, VA', aliases: ['norfolk metro', 'tidewater'],  cities: ['virginia beach', 'norfolk', 'chesapeake', 'newport news', 'hampton'] },
  { name: 'Birmingham Metro',         st: 'AL', primary: 'Birmingham, AL',     aliases: [],                              cities: ['birmingham', 'hoover'] },
  { name: 'Memphis Metro',            st: 'TN', primary: 'Memphis, TN',        aliases: [],                              cities: ['memphis', 'germantown tn', 'southaven'] },
  { name: 'Louisville Metro',         st: 'KY', primary: 'Louisville, KY',     aliases: [],                              cities: ['louisville', 'jeffersonville'] },
  { name: 'New Orleans Metro',        st: 'LA', primary: 'New Orleans, LA',    aliases: ['nola'],                        cities: ['new orleans', 'metairie', 'kenner'] },
  { name: 'Buffalo Metro',            st: 'NY', primary: 'Buffalo, NY',        aliases: ['western new york'],            cities: ['buffalo', 'amherst ny', 'niagara falls'] },
  { name: 'Richmond Metro',           st: 'VA', primary: 'Richmond, VA',       aliases: [],                              cities: ['richmond', 'glen allen', 'henrico'] },
  { name: 'Providence Metro',         st: 'RI', primary: 'Providence, RI',     aliases: [],                              cities: ['providence', 'warwick', 'pawtucket'] },
  { name: 'Albany Metro',             st: 'NY', primary: 'Albany, NY',         aliases: ['capital region'],              cities: ['albany', 'schenectady', 'troy ny', 'saratoga springs'] },
  { name: 'Tucson Metro',             st: 'AZ', primary: 'Tucson, AZ',         aliases: [],                              cities: ['tucson', 'oro valley'] },
  { name: 'Fresno Metro',             st: 'CA', primary: 'Fresno, CA',         aliases: ['central valley'],              cities: ['fresno', 'clovis'] },
  { name: 'Albuquerque Metro',        st: 'NM', primary: 'Albuquerque, NM',    aliases: [],                              cities: ['albuquerque', 'rio rancho', 'santa fe'] },
  { name: 'Omaha Metro',              st: 'NE', primary: 'Omaha, NE',          aliases: [],                              cities: ['omaha', 'council bluffs', 'lincoln ne'] },
  { name: 'Honolulu Metro',           st: 'HI', primary: 'Honolulu, HI',       aliases: ['oahu'],                        cities: ['honolulu', 'pearl city'] },
  { name: 'Boise Metro',              st: 'ID', primary: 'Boise, ID',          aliases: ['treasure valley'],             cities: ['boise', 'meridian', 'nampa'] },
  { name: 'Des Moines Metro',         st: 'IA', primary: 'Des Moines, IA',     aliases: [],                              cities: ['des moines', 'west des moines', 'ankeny'] },
  { name: 'Madison Metro',            st: 'WI', primary: 'Madison, WI',        aliases: [],                              cities: ['madison', 'middleton wi'] },
  { name: 'Spokane Metro',            st: 'WA', primary: 'Spokane, WA',        aliases: ['inland northwest'],            cities: ['spokane', 'spokane valley', 'coeur d alene'] },
  { name: 'Hartford-New Haven',       st: 'CT', primary: 'Hartford, CT',       aliases: [],                              cities: ['hartford', 'new haven', 'stamford', 'farmington ct'] },
  { name: 'Tulsa Metro',              st: 'OK', primary: 'Tulsa, OK',          aliases: [],                              cities: ['tulsa', 'broken arrow'] },
  { name: 'Knoxville Metro',          st: 'TN', primary: 'Knoxville, TN',      aliases: [],                              cities: ['knoxville', 'oak ridge tn'] },
  { name: 'Charleston Metro',         st: 'SC', primary: 'Charleston, SC',     aliases: ['lowcountry'],                  cities: ['charleston', 'mount pleasant sc', 'north charleston'] },
  { name: 'Piedmont Triad',           st: 'NC', primary: 'Greensboro, NC',     aliases: ['triad'],                       cities: ['greensboro', 'winston-salem', 'winston salem', 'high point'] },
  { name: 'Rochester Metro',          st: 'NY', primary: 'Rochester, NY',      aliases: [],                              cities: ['rochester', 'henrietta ny'] },
  { name: 'Dayton Metro',             st: 'OH', primary: 'Dayton, OH',         aliases: [],                              cities: ['dayton', 'kettering oh', 'beavercreek'] },
  { name: 'El Paso Metro',            st: 'TX', primary: 'El Paso, TX',        aliases: ['borderplex'],                  cities: ['el paso', 'las cruces'] },
  { name: 'Little Rock Metro',        st: 'AR', primary: 'Little Rock, AR',    aliases: [],                              cities: ['little rock', 'north little rock', 'conway ar'] },
  { name: 'Baton Rouge Metro',        st: 'LA', primary: 'Baton Rouge, LA',    aliases: [],                              cities: ['baton rouge'] },
  { name: 'Colorado Springs Metro',   st: 'CO', primary: 'Colorado Springs, CO', aliases: [],                            cities: ['colorado springs', 'monument co'] },
  { name: 'Greenville-Spartanburg',   st: 'SC', primary: 'Greenville, SC',     aliases: ['upstate sc'],                  cities: ['greenville', 'spartanburg', 'simpsonville'] },
];

// Derived: metro groups for filter expansion (metro name + aliases + cities all
// map to the same group).
const METRO_GROUPS = METROS.map(m => [
  m.name.toLowerCase(),
  ...m.aliases,
  ...m.cities,
]);

const STATE_ABBR = { al:'alabama',ak:'alaska',az:'arizona',ar:'arkansas',ca:'california',co:'colorado',ct:'connecticut',de:'delaware',fl:'florida',ga:'georgia',hi:'hawaii',id:'idaho',il:'illinois',in:'indiana',ia:'iowa',ks:'kansas',ky:'kentucky',la:'louisiana',me:'maine',md:'maryland',ma:'massachusetts',mi:'michigan',mn:'minnesota',ms:'mississippi',mo:'missouri',mt:'montana',ne:'nebraska',nv:'nevada',nh:'new hampshire',nj:'new jersey',nm:'new mexico',ny:'new york',nc:'north carolina',nd:'north dakota',oh:'ohio',ok:'oklahoma',or:'oregon',pa:'pennsylvania',ri:'rhode island',sc:'south carolina',sd:'south dakota',tn:'tennessee',tx:'texas',ut:'utah',vt:'vermont',va:'virginia',wa:'washington',wv:'west virginia',wi:'wisconsin',wy:'wyoming',dc:'district of columbia' };

// Metro/region names don't geocode on LinkedIn/Indeed — map them to their
// primary city for the jobspy subprocess (the metro-wide match still happens
// via METRO_GROUPS in the location filter, and distance=50 covers the region).
// Driven by the METROS data: matches the metro name, hyphenated variants, or
// any alias ("DFW", "Research Triangle", "Bay Area"…).
function geocodableLocation(location) {
  const stripped = location.replace(/\s*\([^)]*\)\s*/g, ' ').trim(); // drop "(Research Triangle)" hints
  const norm = stripped.toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ');
  const dehyph = norm.replace(/(\w)-(\w)/g, '$1 $2');

  for (const m of METROS) {
    const nameNorm = m.name.toLowerCase().replace(/[.]/g, '');
    const nameDehyph = nameNorm.replace(/(\w)-(\w)/g, '$1 $2');
    if (norm.includes(nameNorm) || dehyph.includes(nameDehyph)) return m.primary;
    for (const a of m.aliases) {
      if (new RegExp(`(^|[^a-z])${a.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z]|$)`).test(dehyph)) return m.primary;
    }
  }
  return stripped;
}

function buildLocationFilter(location) {
  // Strip parenthetical hints ("(Research Triangle)") and normalize hyphenated
  // metro names ("Raleigh-Durham" → both cities become segments).
  const raw = location.toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[.]/g, '')
    .replace(/(\w)-(\w)/g, '$1, $2')
    .trim();
  const phrases    = new Set(); // city/metro/state-name phrases (substring match, ≥4 chars)
  const stateCodes = new Set(); // 2-letter codes — matched ONLY at word boundaries
                                // ("nc" must never match inside "san fraNCisco")

  raw.split(',').map(s => s.trim()).filter(Boolean).forEach(seg => {
    if (STATE_ABBR[seg]) {                 // segment is a state code ("nc")
      stateCodes.add(seg);
      phrases.add(STATE_ABBR[seg]);        // + full state name
    } else if (seg.length > 3) {
      phrases.add(seg);                    // city or region phrase
    }
  });

  // Expand to the full metro group when the searched city belongs to one
  for (const group of METRO_GROUPS) {
    if (group.some(city => raw.includes(city))) group.forEach(city => phrases.add(city));
  }

  return { phrases: [...phrases], stateCodes: [...stateCodes], original: location };
}

// A US-market search must not surface postings scoped to other countries —
// even "remote" ones, since remote-Canada/remote-EU roles can't be worked
// from the US. Detect explicit foreign scoping in the location string.
// Country/region tokens only — foreign CITY names are deliberately excluded
// because many collide with US towns (Paris TX, Dublin OH, Berlin NH, London KY).
const FOREIGN_SCOPE = /\b(canada|canadian|mexico|méxico|united kingdom|england|scotland|ireland|germany|deutschland|france|spain|españa|portugal|netherlands|poland|polska|india|pakistan|philippines|singapore|japan|china|hong kong|taiwan|south korea|vietnam|indonesia|malaysia|thailand|australia|new zealand|brazil|brasil|argentina|colombia|chile|peru|costa rica|israel|turkey|ukraine|romania|hungary|czechia|czech republic|austria|switzerland|belgium|sweden|norway|denmark|finland|italy|italia|greece|egypt|nigeria|kenya|south africa|uae|dubai|saudi arabia|europe|emea|apac|latam|latin america|worldwide except)\b/;
const US_SCOPE = /\b(united states|usa|u\.s\.|us only|nationwide|us[-\s]based|north america)\b|\bus\b/;

function matchesLocation(job, filter) {
  const loc = (job.location || '').toLowerCase();
  // Unknown location: keep — AI scoring + the user can judge
  if (!loc) return true;
  // Foreign-scoped postings never match a US city/metro search — remote or not.
  // ("Remote — Canada" is not workable from Raleigh.)
  if (FOREIGN_SCOPE.test(loc) && !US_SCOPE.test(loc)) return false;
  // Genuinely remote roles (US-scoped or unscoped) are workable from anywhere in the US
  if (job.remote === true || /\bremote\b|\banywhere\b|\bwork from home\b/.test(loc)) return true;

  for (const p of filter.phrases) {
    if (loc.includes(p)) return true;
  }
  for (const c of filter.stateCodes) {
    // strict word-boundary match so state codes can't hit inside city names
    if (new RegExp(`(^|[^a-z])${c}([^a-z]|$)`).test(loc)) return true;
  }
  // NOTE: no blanket "united states" pass — a bare "United States" posting with
  // no city is NOT a match for a city-level search. That pass was why searching
  // Raleigh surfaced San Francisco and New York roles.
  return false;
}

// ── Company-size & industry inference ─────────────────────────
// Postings rarely carry structured headcount/industry, so we infer from the
// employer name against a curated map of the largest, most-searched companies.
// Unknown employers pass the filter (never hide a job just because we can't
// classify it) — this keeps the holistic view while letting known giants filter.
const SIZE_BY_COMPANY = {
  // enterprise (10k+)
  enterprise: /\b(apple|google|alphabet|microsoft|amazon|meta|facebook|tesla|nvidia|netflix|oracle|ibm|cisco|intel|salesforce|adobe|paypal|ebay|hp|3m|walmart|target|cvs|humana|disney|comcast|fedex|nike|pepsico|coca.?cola|jpmorgan|citi|wells fargo|bank of america|mastercard|visa|boeing|qualcomm|broadcom|ge|general electric|starbucks|mcdonald)\b/i,
  // large (1k–10k)
  large: /\b(stripe|airbnb|coinbase|databricks|snowflake|robinhood|reddit|pinterest|instacart|lyft|doordash|cloudflare|mongodb|gitlab|okta|atlassian|twilio|palantir|roblox|affirm|discord)\b/i,
  // mid (200–1k)
  mid: /\b(notion|figma|ramp|linear|anthropic|openai|perplexity|brex|mercury|retool|vercel|supabase)\b/i,
};
// Tranches the UI offers → which inferred buckets they include.
const SIZE_TRANCHES = {
  startup:    ['smb'],            // <200 (default when unknown-but-startupish)
  mid:        ['mid'],            // 200–1k
  large:      ['large'],         // 1k–10k
  enterprise: ['enterprise'],   // 10k+
};
function inferCompanySize(job) {
  const c = job.company || '';
  if (SIZE_BY_COMPANY.enterprise.test(c)) return 'enterprise';
  if (SIZE_BY_COMPANY.large.test(c)) return 'large';
  if (SIZE_BY_COMPANY.mid.test(c)) return 'mid';
  return null; // unknown
}
function matchesCompanySize(job, sizes) {
  const inferred = inferCompanySize(job);
  if (!inferred) return true; // unknown → keep (holistic)
  const allowed = new Set(sizes.flatMap(s => SIZE_TRANCHES[s] || [s]));
  return allowed.has(inferred);
}

// Industry inference from title + company + description keywords, aligned to
// the Primary Industry options in Profile & Settings.
const INDUSTRY_SIGNALS = {
  'Technology/Engineering':   /\b(software|engineer|developer|data|cloud|devops|machine learning|ai|platform|infrastructure|cyber|security|saas|technology)\b/i,
  'Finance/Accounting':       /\b(finance|financial|accounting|accountant|audit|treasury|fp&a|investment|banking|actuar|tax|controller)\b/i,
  'Healthcare/Medical':       /\b(health|healthcare|clinical|medical|nurse|patient|pharma|biotech|hospital|care)\b/i,
  'Legal/Compliance':         /\b(legal|counsel|attorney|paralegal|compliance|regulatory|contract)\b/i,
  'Creative/Marketing':       /\b(marketing|brand|creative|content|design|social media|growth|seo|copywriter|communications)\b/i,
  'Operations/Supply Chain':  /\b(operations|supply chain|logistics|procurement|warehouse|fulfillment|inventory|ops)\b/i,
  'Sales/Business Dev':       /\b(sales|account executive|business development|revenue|partnerships|account manager)\b/i,
  'People/HR':                /\b(human resources|\bhr\b|recruit|talent|people ops|benefits|compensation)\b/i,
  'Government/Nonprofit':     /\b(government|public sector|nonprofit|policy|civic|municipal|federal|state of)\b/i,
  'Scientific/R&D':           /\b(research|scientist|r&d|laboratory|chemist|biologist|physicist)\b/i,
};
function matchesIndustry(job, industries) {
  const hay = `${job.title} ${job.company} ${(job.description || '').slice(0, 400)}`;
  // Keep if it matches ANY selected industry; if none of the selected
  // industries have a signal hit AND the job matches no industry at all, keep
  // it (unknown → holistic). Only filter out jobs that clearly belong to a
  // DIFFERENT industry than any selected one.
  const selected = industries.filter(i => INDUSTRY_SIGNALS[i]);
  if (!selected.length) return true;
  if (selected.some(i => INDUSTRY_SIGNALS[i].test(hay))) return true;
  // Does it match some OTHER industry strongly? If so, exclude.
  const otherHit = Object.entries(INDUSTRY_SIGNALS)
    .some(([name, re]) => !industries.includes(name) && re.test(hay));
  return !otherHit; // unknown industry → keep
}

/**
 * Two-phase pipeline (Google/LinkedIn-style hybrid search architecture):
 *
 *   Phase 1 — INSTANT: every job is ranked by the local hybrid scorer
 *   (BM25 lexical + hashed-vector semantic similarity against query+profile)
 *   and emitted immediately. The search completes when the boards return —
 *   the user never waits on AI.
 *
 *   Phase 2 — BACKGROUND ENRICHMENT: returns a deferred closure that
 *   AI-scores the top hybrid-ranked jobs in batches; scores stream to the
 *   client as `update` events and merge into already-rendered cards.
 */
function processAndEmit(jobs, source, onBatch, scoreWithClaude, keywords = '') {
  if (!jobs.length) return null;

  const resume  = getResume();
  const profile = getProfile();
  const capped  = jobs.slice(0, 30);

  // Stage 1+2 hybrid relevance (lexical BM25 + vector cosine), personalized
  // with the candidate's profile — instant, no API calls.
  const ranked = hybridRank(capped, keywords, profile, resume).map(r => r.job);
  const withKw = ranked.map(job => ({ ...job, keywordMatch: scoreKeywords(resume, job.description || '') }));

  // Phase 1: emit EVERYTHING now.
  if (onBatch) onBatch(withKw, source);

  if (!scoreWithClaude) return null;

  // Phase 2 (deferred): AI-score the 16 most relevant, stream as updates.
  return async () => {
    const toScore = withKw.slice(0, 16);
    const BATCH = 8;
    for (let i = 0; i < toScore.length; i += BATCH) {
      const slice = toScore.slice(i, i + BATCH);
      try {
        const results = await quickScoreBatch(slice);
        const updates = slice.map((job, j) => {
          const s = results[j] || {};
          return { ...job, score: s.score ?? null, archetype: s.archetype, verdict: s.verdict, scoreReason: s.reason };
        });
        if (onBatch) onBatch(updates, source);
      } catch { /* enrichment is best-effort */ }
    }
  };
}

// ── Test/audit hook: direct access to individual board searchers ──
export const _boards = {
  greenhouse: kw => searchGreenhouse(DEFAULT_GREENHOUSE, kw),
  lever:      kw => searchLever(DEFAULT_LEVER, kw),
  ashby:      kw => searchAshby(DEFAULT_ASHBY, kw),
  remotive:   searchRemotive,
  yc:         searchYC,
  wellfound:  searchWellfound,
  startupjobs: searchStartupJobs,
  welcomejungle: searchWelcomeJungle,
  cord:       searchCord,
  builtin:    searchBuiltIn,
};
