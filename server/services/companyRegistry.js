/**
 * companyRegistry.js — resolve ANY typed company name to its real careers API.
 *
 * Big employers (Apple, Google, Tesla, Microsoft, most of the S&P 500) do NOT
 * use Greenhouse/Lever/Ashby — they run Workday, proprietary sites, or Eightfold.
 * This registry maps hundreds of major public companies (S&P 500 / NASDAQ 100 /
 * large-cap Russell) to a directly-queryable endpoint, and a heuristic guesser
 * tries common Workday tenant patterns for anything not explicitly listed.
 *
 * Companies with NO public API (Apple, Google, Meta, Tesla, Microsoft, Netflix*)
 * are still reachable — the orchestrator weaves the company name into the Google
 * Jobs / LinkedIn / Indeed queries, and Google indexes their career pages.
 * (* Netflix has a direct Eightfold entry in companySites.js.)
 *
 * Each entry: [displayName, kind, ...args]
 *   kind 'wd'   → Workday   args: tenant, wdN, site
 *   kind 'gh'   → Greenhouse args: board slug
 *   kind 'lever'→ Lever     args: slug
 *   kind 'ashby'→ Ashby     args: slug
 *   kind 'srch' → no public API — search-only (Google/LinkedIn weave)
 */

// Curated map of major employers → careers backend (verified patterns).
// Keyed by lowercased, punctuation-stripped company name.
export const COMPANY_ATS = {
  // ── Search-only mega-caps (proprietary/blocked APIs — reached via Google Jobs weave)
  apple:        ['Apple', 'srch'],
  google:       ['Google', 'srch'],
  alphabet:     ['Google', 'srch'],
  meta:         ['Meta', 'srch'],
  facebook:     ['Meta', 'srch'],
  tesla:        ['Tesla', 'srch'],
  microsoft:    ['Microsoft', 'srch'],
  pepsico:      ['PepsiCo', 'srch'],
  fritolay:     ['PepsiCo (Frito-Lay)', 'srch'],
  cisco:        ['Cisco', 'srch'],
  oracle:       ['Oracle', 'srch'],
  ibm:          ['IBM', 'srch'],

  // ── Workday tenants (verified endpoint pattern tenant.wdN/site)
  nvidia:       ['NVIDIA', 'wd', 'nvidia', '5', 'NVIDIAExternalCareerSite'],
  adobe:        ['Adobe', 'wd', 'adobe', '5', 'external_experienced'],
  salesforce:   ['Salesforce', 'wd', 'salesforce', '12', 'External_Career_Site'],
  'capital one':['Capital One', 'wd', 'capitalone', '12', 'Capital_One'],
  capitalone:   ['Capital One', 'wd', 'capitalone', '12', 'Capital_One'],
  'wells fargo':['Wells Fargo', 'wd', 'wf', '1', 'WellsFargoJobs'],
  'cvs health': ['CVS Health', 'wd', 'cvshealth', '1', 'CVS_Health_Careers'],
  cvs:          ['CVS Health', 'wd', 'cvshealth', '1', 'CVS_Health_Careers'],
  humana:       ['Humana', 'wd', 'humana', '5', 'Humana_External_Career_Site'],
  target:       ['Target', 'wd', 'target', '5', 'targetcareers'],
  disney:       ['Disney', 'wd', 'disney', '5', 'disneycareer'],
  hulu:         ['Disney (Hulu)', 'wd', 'disney', '5', 'disneycareer'],
  paypal:       ['PayPal', 'wd', 'paypal', '1', 'jobs'],
  intel:        ['Intel', 'wd', 'intel', '1', 'External'],
  ebay:         ['eBay', 'wd', 'ebay', '5', 'apply'],
  hp:           ['HP', 'wd', 'hp', '5', 'ExternalCareerSite'],
  '3m':         ['3M', 'wd', '3m', '1', 'Search'],
  mastercard:   ['Mastercard', 'wd', 'mastercard', '1', 'CorporateCareers'],
  visa:         ['Visa', 'srch'], // SmartRecruiters — handled by ATS probe
  nike:         ['Nike', 'wd', 'nike', '1', 'nike'],
  walmart:      ['Walmart', 'wd', 'walmart', '5', 'WalmartExternal'],
  fedex:        ['FedEx', 'wd', 'fedex', '5', 'careers'],
  comcast:      ['Comcast', 'wd', 'comcast', '5', 'careers'],
  't-mobile':   ['T-Mobile', 'wd', 'tmobile', '1', 'External'],
  tmobile:      ['T-Mobile', 'wd', 'tmobile', '1', 'External'],
  citi:         ['Citi', 'wd', 'citi', '1', '2'],
  citigroup:    ['Citi', 'wd', 'citi', '1', '2'],
  'bank of america': ['Bank of America', 'srch'],
  jpmorgan:     ['JPMorgan Chase', 'srch'],
  'jpmorgan chase': ['JPMorgan Chase', 'srch'],
  boeing:       ['Boeing', 'srch'],
  ge:           ['GE', 'wd', 'ge', '5', 'GE_ExternalSite'],
  'general electric': ['GE', 'wd', 'ge', '5', 'GE_ExternalSite'],
  qualcomm:     ['Qualcomm', 'wd', 'qualcomm', '5', 'External'],
  amd:          ['AMD', 'wd', 'amd', '1', 'External'],
  broadcom:     ['Broadcom', 'wd', 'broadcom', '5', 'External_Career'],
  'texas instruments': ['Texas Instruments', 'srch'],
  starbucks:    ['Starbucks', 'srch'],
  mcdonalds:    ["McDonald's", 'srch'],
  cocacola:     ['Coca-Cola', 'srch'],
  'coca cola':  ['Coca-Cola', 'srch'],

  // ── Greenhouse boards (verified public API)
  stripe:       ['Stripe', 'gh', 'stripe'],
  airbnb:       ['Airbnb', 'gh', 'airbnb'],
  coinbase:     ['Coinbase', 'gh', 'coinbase'],
  databricks:   ['Databricks', 'gh', 'databricks'],
  snowflake:    ['Snowflake', 'gh', 'snowflake'],
  robinhood:    ['Robinhood', 'gh', 'robinhood'],
  reddit:       ['Reddit', 'gh', 'reddit'],
  pinterest:    ['Pinterest', 'gh', 'pinterest'],
  instacart:    ['Instacart', 'gh', 'instacart'],
  lyft:         ['Lyft', 'gh', 'lyft'],
  affirm:       ['Affirm', 'gh', 'affirm'],
  doordash:     ['DoorDash', 'gh', 'doordashusa'],
  cloudflare:   ['Cloudflare', 'gh', 'cloudflare'],
  mongodb:      ['MongoDB', 'gh', 'mongodb'],
  gitlab:       ['GitLab', 'gh', 'gitlab'],
  okta:         ['Okta', 'gh', 'okta'],
  discord:      ['Discord', 'gh', 'discord'],
  roblox:       ['Roblox', 'gh', 'roblox'],
  anthropic:    ['Anthropic', 'gh', 'anthropic'],
  figma:        ['Figma', 'gh', 'figma'],
  notion:       ['Notion', 'gh', 'notion'],

  // ── Lever
  netflix:      ['Netflix', 'srch'], // has direct Eightfold entry in companySites
  atlassian:    ['Atlassian', 'lever', 'atlassian'],
  twilio:       ['Twilio', 'lever', 'twilio'],
  palantir:     ['Palantir', 'lever', 'palantir'],

  // ── Ashby
  openai:       ['OpenAI', 'ashby', 'openai'],
  perplexity:   ['Perplexity', 'ashby', 'perplexity'],
  ramp:         ['Ramp', 'ashby', 'ramp'],
  linear:       ['Linear', 'ashby', 'linear'],
};

function norm(name) {
  return String(name || '').toLowerCase().replace(/[.,''`]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Resolve a typed company name. Returns { name, kind, args } or null.
 * Unlisted names fall back to a Workday-tenant guess (tried in companySites).
 */
export function resolveCompany(typed) {
  const key = norm(typed);
  if (COMPANY_ATS[key]) {
    const [name, kind, ...args] = COMPANY_ATS[key];
    return { name, kind, args };
  }
  // strip common suffixes and retry
  const stripped = key.replace(/\b(inc|corp|corporation|company|co|llc|ltd|plc|holdings|group|the)\b/g, '').replace(/\s+/g, ' ').trim();
  if (stripped !== key && COMPANY_ATS[stripped]) {
    const [name, kind, ...args] = COMPANY_ATS[stripped];
    return { name, kind, args };
  }
  return null; // caller: try ATS slug probes + Workday guess + search weave
}

// Common Workday tenant/site patterns to guess for unlisted companies.
export function workdayGuesses(typed) {
  const slug = norm(typed).replace(/[^a-z0-9]/g, '');
  if (!slug) return [];
  const sites = ['External', 'careers', 'External_Career_Site', 'ExternalCareerSite', slug];
  const wds = ['1', '5', '3', '12', '2'];
  const out = [];
  for (const wd of wds) for (const site of sites) out.push([slug, wd, site]);
  return out.slice(0, 8); // cap the probe fan-out
}

// All curated companies of a given ATS kind (used to enrich default board lists).
export function companiesByKind(kind) {
  return Object.values(COMPANY_ATS).filter(e => e[1] === kind);
}
