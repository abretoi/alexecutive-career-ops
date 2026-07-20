/**
 * sessionBoardSearch.js — Glassdoor & ZipRecruiter search via the user's own
 * logged-in session (Profile & Settings → Platform Accounts).
 *
 * Both sites block all unauthenticated automated search (anti-bot walls), but a
 * real logged-in browser session — the user's own cookies in a Playwright
 * context — is exactly how Simplify/Tsenta-class tools access them. Headless,
 * best-effort DOM extraction with layered selector fallbacks: these sites
 * change markup frequently, so failure degrades to [] with a console note,
 * never an error that blocks other boards.
 */
import { getSessionStatus, createContextWithSession } from './platformSessions.js';

const SEARCH_TIMEOUT = 45000;

function hasSession(platform) {
  try { return !!getSessionStatus(platform)?.connected; } catch { return false; }
}

// Generic in-page extractor: given candidate card selectors, pull title /
// company / location / url from whichever matches. Runs in browser context.
const EXTRACT_FN = `(cfg) => {
  const pick = (el, sels) => {
    for (const s of sels) {
      const n = el.querySelector(s);
      if (n && n.textContent.trim()) return n.textContent.trim();
    }
    return '';
  };
  for (const cardSel of cfg.cards) {
    const cards = [...document.querySelectorAll(cardSel)];
    if (cards.length < 2) continue;
    return cards.slice(0, cfg.limit).map(card => {
      const link = card.querySelector(cfg.link) || card.closest('a') || card.querySelector('a');
      return {
        title:    pick(card, cfg.title),
        company:  pick(card, cfg.company),
        location: pick(card, cfg.location),
        salary:   pick(card, cfg.salary || []),
        url:      link?.href || '',
      };
    }).filter(j => j.title && j.url);
  }
  return [];
}`;

async function runSessionSearch(platform, searchUrl, extractCfg) {
  if (!hasSession(platform)) {
    console.warn(`[${platform}] no connected session — connect it in Profile & Settings → Platform Accounts`);
    return [];
  }
  let browser;
  try {
    const ctx = await createContextWithSession(platform, { headless: true });
    browser = ctx.browser;
    const page = await ctx.context.newPage();
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: SEARCH_TIMEOUT });
    // Let client-side rendering settle
    await page.waitForTimeout(3500);

    // Logged-out or bot-wall detection: bail honestly rather than scraping a wall
    const walled = await page.evaluate(() =>
      /verify you are human|are you a robot|security check|sign in to continue/i.test(document.body?.innerText || '')
    );
    if (walled) {
      console.warn(`[${platform}] session rejected (bot wall / logged out) — reconnect the account in Profile & Settings`);
      return [];
    }

    const raw = await page.evaluate(eval(EXTRACT_FN), extractCfg);
    return raw;
  } catch (e) {
    console.warn(`[${platform}] session search failed:`, e.message.slice(0, 120));
    return [];
  } finally {
    await browser?.close().catch(() => {});
  }
}

export async function searchGlassdoorSession(keywords, location, limit = 20) {
  const url = `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodeURIComponent(keywords)}&locKeyword=${encodeURIComponent(location || '')}`;
  const jobs = await runSessionSearch('glassdoor', url, {
    limit,
    cards:    ['li[data-test="jobListing"]', '[data-test="job-card"]', 'li.JobsList_jobListItem__wjTHv', 'article[data-brandviews]'],
    link:     'a[data-test="job-link"], a[data-test="job-title"], a',
    title:    ['[data-test="job-title"]', 'a[data-test="job-link"]', '.JobCard_jobTitle___7I6y', 'a'],
    company:  ['[data-test="employer-name"]', '.EmployerProfile_compactEmployerName__LE242', '[class*="employerName"]'],
    location: ['[data-test="emp-location"]', '[class*="location"]'],
    salary:   ['[data-test="detailSalary"]', '[class*="salaryEstimate"]'],
  });
  return jobs.map(j => ({ ...j, id: `gd-${j.url.split('?')[0].split('/').pop()}`, source: 'glassdoor' }));
}

export async function searchZipRecruiterSession(keywords, location, limit = 20) {
  const url = `https://www.ziprecruiter.com/jobs-search?search=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location || '')}`;
  const jobs = await runSessionSearch('ziprecruiter', url, {
    limit,
    cards:    ['article.job_result', '[class*="job_result"]', 'li[class*="job-listing"]', 'div.jobList-intro'],
    link:     'a.job_link, h2 a, a',
    title:    ['h2', '.title', 'a.job_link'],
    company:  ['[class*="company_name"]', 'a[class*="company"]', '.hiring-company'],
    location: ['[class*="location"]', '.candidate_location'],
    salary:   ['[class*="salary"]', '.perc_salary'],
  });
  return jobs.map(j => ({ ...j, id: `zr-${j.url.split('?')[0].split('/').pop()}`, source: 'zip_recruiter' }));
}

export function sessionBoardAvailable(platform) {
  return hasSession(platform === 'zip_recruiter' ? 'ziprecruiter' : platform);
}
