/**
 * platformSessions.js — Persistent browser sessions for job platforms
 *
 * HOW IT WORKS (same approach as Tsenta, Simplify, LazyApply):
 *   1. A visible Playwright Chromium browser opens at the platform's login page.
 *   2. The USER types their own credentials — the app never sees or stores them.
 *   3. After successful login (detected by URL/cookie check), session cookies
 *      are saved locally to  data/platform-sessions/{name}.json
 *   4. All future operations (job search, profile sync, Easy Apply) load those
 *      cookies into a new Playwright context — the browser is already "logged in".
 *
 * IMPORTANT: This is fundamentally different from "programmatic login":
 *   - The user authenticates themselves in a real, visible browser.
 *   - No credentials are stored anywhere — only the session cookies.
 *   - This is equivalent to "Remember Me" in any browser.
 *   - The same technique is used by every mainstream job-search assistant tool.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const ROOT      = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA      = path.join(ROOT, 'data');
const SESS_DIR  = path.join(DATA, 'platform-sessions');

function sessFile(name) {
  fs.mkdirSync(SESS_DIR, { recursive: true });
  return path.join(SESS_DIR, `${name}.json`);
}

function readJson(fp, fallback = null) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return fallback; }
}

// Platform login URLs and logged-in detection patterns
const PLATFORMS = {
  linkedin: {
    label:      'LinkedIn',
    loginUrl:   'https://www.linkedin.com/login',
    loggedInRe: /linkedin\.com\/(feed|mynetwork|jobs|in\/)/,
    profileUrl: 'https://www.linkedin.com/in/me/',
    color:      '#0a66c2',
    icon:       'LI',
  },
  indeed: {
    label:      'Indeed',
    loginUrl:   'https://secure.indeed.com/auth?hl=en&co=US&continue=%2F&tmpl=desktop',
    loggedInRe: /indeed\.com\/(myjobs|account|dashboard|profile|viewjob)/,
    profileUrl: 'https://profile.indeed.com/',
    color:      '#003a9b',
    icon:       'IN',
  },
  glassdoor: {
    label:      'Glassdoor',
    loginUrl:   'https://www.glassdoor.com/profile/login_input.htm',
    loggedInRe: /glassdoor\.com\/(member|Profile|job-search)/,
    profileUrl: 'https://www.glassdoor.com/member/profile/index.htm',
    color:      '#0caa41',
    icon:       'GD',
  },
  ziprecruiter: {
    label:      'ZipRecruiter',
    loginUrl:   'https://www.ziprecruiter.com/authn/login',
    loggedInRe: /ziprecruiter\.com\/(profile|jobs|candidate|authn\/complete)/,
    profileUrl: 'https://www.ziprecruiter.com/profile',
    color:      '#1d6f42',
    icon:       'ZR',
  },
  google: {
    label:      'Google (for Google Jobs search)',
    loginUrl:   'https://www.google.com/search?q=analyst+jobs&udm=8&hl=en',
    // "Logged in" = the jobs vertical actually rendered (user passed any
    // human-verification wall and/or signed in) — not the /sorry/ page.
    loggedInRe: /google\.com\/search\?.*udm=8/,
    profileUrl: 'https://www.google.com/search?q=jobs&udm=8',
    color:      '#4285f4',
    icon:       'G',
  },
  monster: {
    label:      'Monster',
    loginUrl:   'https://www.monster.com/profile/detail',
    loggedInRe: /monster\.com\/(profile|jobs\/saved|settings)/,
    profileUrl: 'https://www.monster.com/profile/detail',
    color:      '#6e46ae',
    icon:       'MO',
  },
  careerbuilder: {
    label:      'CareerBuilder',
    loginUrl:   'https://www.careerbuilder.com/user/sign-in',
    loggedInRe: /careerbuilder\.com\/(user\/dashboard|myresumes|user\/profile)/,
    profileUrl: 'https://www.careerbuilder.com/user/dashboard',
    color:      '#7a5fd0',
    icon:       'CB',
  },
  dice: {
    label:      'Dice (Tech Jobs)',
    loginUrl:   'https://www.dice.com/dashboard/login',
    loggedInRe: /dice\.com\/(dashboard|home-feed|profile)/,
    profileUrl: 'https://www.dice.com/dashboard/profiles',
    color:      '#eb1c26',
    icon:       'DI',
  },
  wellfound: {
    label:      'Wellfound (Startups)',
    loginUrl:   'https://wellfound.com/login',
    loggedInRe: /wellfound\.com\/(jobs|candidate|profile\/edit)/,
    profileUrl: 'https://wellfound.com/profile/edit',
    color:      '#ec2e3a',
    icon:       'WF',
  },
};

// ── In-memory connect sessions (polling state) ────────────────────
const connectingSessions = new Map();  // platform → { browser, page, status, savedAt, error }

// ── Cookie persistence ────────────────────────────────────────────

export function getSessionStatus(platform) {
  const fp   = sessFile(platform);
  const data = readJson(fp, null);
  const connecting = connectingSessions.get(platform);
  return {
    platform,
    label:       PLATFORMS[platform]?.label || platform,
    connected:   !!data?.cookies?.length,
    connectedAt: data?.connectedAt || null,
    connecting:  connecting?.status === 'waiting' || false,
    error:       connecting?.error  || null,
  };
}

export function getAllStatuses() {
  return Object.keys(PLATFORMS).map(getSessionStatus);
}

async function saveCookies(platform, cookies) {
  const fp = sessFile(platform);
  fs.writeFileSync(fp, JSON.stringify({ cookies, connectedAt: new Date().toISOString() }, null, 2), 'utf8');
}

export function clearSession(platform) {
  const fp = sessFile(platform);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  // Close any connecting browser
  const s = connectingSessions.get(platform);
  if (s?.browser) s.browser.close().catch(() => {});
  connectingSessions.delete(platform);
}

export async function createContextWithSession(platform, { headless = false, offscreen = false } = {}) {
  const fp   = sessFile(platform);
  const data = readJson(fp, null);
  const browser = await chromium.launch({
    headless,
    slowMo:   headless ? 0 : 40,
    args: [
      '--no-sandbox', '--disable-blink-features=AutomationControlled',
      // Off-screen headed mode: real browser fingerprint (needed where headless
      // is refused, e.g. Google Jobs) without a visible window.
      ...(offscreen && !headless ? ['--window-position=-2400,-2400', '--window-size=1400,950'] : []),
    ],
  });
  const context = await browser.newContext({
    viewport:  { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  if (data?.cookies?.length) {
    await context.addCookies(data.cookies);
  }
  return { browser, context };
}

// ── Connect flow ──────────────────────────────────────────────────
// Opens a real browser at the platform login page. The user types their own
// credentials. We poll the URL until we detect the logged-in state, then
// save cookies and close the browser.

export async function startConnect(platform) {
  const cfg = PLATFORMS[platform];
  if (!cfg) throw new Error(`Unknown platform: ${platform}`);

  // Close any existing connect session for this platform
  const existing = connectingSessions.get(platform);
  if (existing?.browser) existing.browser.close().catch(() => {});

  const session = { browser: null, status: 'waiting', error: null };
  connectingSessions.set(platform, session);

  (async () => {
    try {
      const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
      });
      session.browser = browser;
      const context = await browser.newContext({
        viewport:  { width: 1280, height: 900 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();
      session.page = page;

      await page.goto(cfg.loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Poll every 1.5s for up to 5 minutes for successful login
      const deadline = Date.now() + 5 * 60 * 1000;
      while (Date.now() < deadline) {
        await page.waitForTimeout(1500);
        const url = page.url();
        if (cfg.loggedInRe.test(url)) {
          // Logged in — save cookies
          const cookies = await context.cookies();
          await saveCookies(platform, cookies);
          session.status = 'connected';
          // Keep browser open briefly so user can see it succeeded
          await page.waitForTimeout(2000);
          await browser.close();
          connectingSessions.delete(platform);
          return;
        }
        // Check if browser was closed by user
        if (browser.isConnected() === false) break;
      }
      session.status = 'timeout';
      session.error  = 'Login window timed out. Try again.';
      await browser.close().catch(() => {});
      connectingSessions.delete(platform);
    } catch (e) {
      session.status = 'error';
      session.error  = e.message;
      connectingSessions.delete(platform);
    }
  })();

  return { ok: true, msg: `Sign in to ${cfg.label} in the browser window that just opened.` };
}

// ── Profile sync ──────────────────────────────────────────────────

export async function syncProfile(platform, profileUrl) {
  const cfg = PLATFORMS[platform];
  if (!cfg) throw new Error(`Unknown platform: ${platform}`);

  const fp = sessFile(platform);
  if (!readJson(fp, null)) throw new Error(`No session for ${platform}. Connect first.`);

  const { browser, context } = await createContextWithSession(platform);
  try {
    const page = await context.newPage();

    // For LinkedIn: navigate to provided profile URL, or resolve /in/me/ redirect
    let targetUrl = profileUrl || cfg.profileUrl;
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // If we ended up on the feed (me/ redirected there), try to find the actual profile URL
    const landedUrl = page.url();
    if (platform === 'linkedin' && (landedUrl.includes('/feed') || landedUrl === 'https://www.linkedin.com/')) {
      // Navigate explicitly to /in/me which should redirect to the profile
      await page.goto('https://www.linkedin.com/in/me/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    }

    // Check for session expiry
    if (cfg.loggedInRe && !cfg.loggedInRe.test(page.url()) && page.url().includes('login')) {
      await browser.close();
      clearSession(platform);
      throw new Error('Session expired — please reconnect.');
    }

    // Wait for SPA content to render — LinkedIn needs longer
    await page.waitForTimeout(platform === 'linkedin' ? 5000 : 2000);

    // Full-page scroll + expand "see more" buttons to reveal all profile content
    if (platform === 'linkedin') {
      // Scroll in stages to trigger lazy loading of About, Experience, Skills sections
      await page.evaluate(async () => {
        const step = 800;
        const total = Math.max(document.body.scrollHeight, 5000);
        for (let y = 0; y < total; y += step) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 150));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1500);

      // Click all "see more" / "show more" expansion buttons so truncated sections are fully visible
      const expandSelectors = [
        'button[aria-label*="see more"]', 'button[aria-label*="See more"]',
        '.inline-show-more-text__button', '[class*="show-more-less-text__button"]',
        'button[data-tracking-control-name*="see_more"]',
        'button.lt-line-clamp__more', '[class*="lt-line-clamp"] button',
      ];
      for (const sel of expandSelectors) {
        try {
          const btns = await page.$$(sel);
          for (const btn of btns) {
            if (await btn.isVisible().catch(() => false)) {
              await btn.click().catch(() => {});
              await page.waitForTimeout(250);
            }
          }
        } catch { /* ignore */ }
      }
      await page.waitForTimeout(1000);
    }

    const rawText = await page.evaluate(() => document.body.innerText);

    let structured = null;
    if (platform === 'linkedin') {
      structured = await page.evaluate(() => {
        // ── Strategy 1: JSON-LD structured data (most reliable) ──
        const jsonLdScripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
        for (const s of jsonLdScripts) {
          try {
            const d = JSON.parse(s.textContent);
            const person = Array.isArray(d) ? d.find(x => x['@type'] === 'Person') : (d['@type'] === 'Person' ? d : null);
            if (person) {
              return {
                name:     person.name || '',
                headline: person.jobTitle || '',
                location: person.address?.addressLocality || '',
                about:    person.description || '',
                skills:   (person.knowsAbout || []).map(s => typeof s === 'string' ? s : s.name || '').filter(Boolean),
                _source:  'json-ld',
              };
            }
          } catch { /* continue */ }
        }

        // ── Strategy 2: DOM selectors (LinkedIn 2024-2025 class names) ──
        const try_ = (...sels) => {
          for (const sel of sels) {
            try {
              const el = document.querySelector(sel);
              const t = (el?.innerText || el?.textContent || '').trim();
              if (t.length > 2) return t;
            } catch { /* bad selector, skip */ }
          }
          return '';
        };
        const getAll = sel => {
          try { return [...document.querySelectorAll(sel)].map(e => (e.innerText || e.textContent || '').trim()).filter(Boolean); }
          catch { return []; }
        };

        const name = try_(
          'h1.text-heading-xlarge', 'h1.inline.t-24', 'h1',
        );
        const headline = try_(
          '.text-body-medium.break-words',
          '.pv-text-details__left-panel .text-body-medium',
          '[data-field="headline"]',
          '.ph5 .text-body-medium',
        );
        const location = try_(
          '.text-body-small.inline.t-black--light.break-words',
          '.pv-text-details__left-panel span.t-black--light',
          '[data-field="location_name"]',
        );

        // About section — look for the section containing id="about" anchor, then get text content
        let about = '';
        const aboutAnchor = document.getElementById('about');
        if (aboutAnchor) {
          // Walk up to containing section, then find the text container
          let section = aboutAnchor.closest('section') || aboutAnchor.parentElement;
          for (let i = 0; i < 5 && section; i++) {
            const candidate = section.querySelector('.pv-shared-text-with-see-more, .full-width, [class*="inline-show-more-text"]');
            if (candidate) { about = (candidate.innerText || candidate.textContent || '').trim(); break; }
            section = section.nextElementSibling;
          }
        }
        if (!about) {
          // Fallback: look for the longest paragraph-style block on the page that's not nav/header
          const candidates = [...document.querySelectorAll('p, .pv-shared-text-with-see-more, [class*="show-more-less-text"]')]
            .map(el => (el.innerText || el.textContent || '').trim())
            .filter(t => t.length > 80 && t.length < 3000);
          if (candidates.length) about = candidates.sort((a, b) => b.length - a.length)[0];
        }

        // Skills — multiple selector patterns
        const skills = [
          ...getAll('#skills ~ div .pvs-list__item--line-separated .hoverable-link-text span[aria-hidden="true"]'),
          ...getAll('#skills ~ div [data-field="skill_card_skill_topic"] span[aria-hidden="true"]'),
          ...getAll('.pv-skill-category-entity__name-text'),
          ...getAll('[class*="skill"] span[aria-hidden="true"]'),
        ].filter((v, i, a) => v.length > 1 && a.indexOf(v) === i);

        // Education section (anchor id="education")
        const education = [];
        const eduAnchor = document.getElementById('education');
        if (eduAnchor) {
          const eduSection = eduAnchor.closest('section') || eduAnchor.parentElement;
          if (eduSection) {
            const items = [...eduSection.querySelectorAll('li[class*="pvs-list__item"], li.artdeco-list__item')];
            items.forEach(item => {
              const spans = [...item.querySelectorAll('span[aria-hidden="true"]')]
                .map(s => s.textContent.trim()).filter(Boolean);
              if (spans.length) education.push({
                institution: spans[0] || '',
                degree:      spans[1] || '',
                field:       spans[2] || '',
                dates:       spans[3] || '',
              });
            });
          }
        }

        // Certifications / Licenses section
        const certifications = [];
        const certAnchor = document.getElementById('licenses_and_certifications')
          || document.getElementById('certifications');
        if (certAnchor) {
          const certSection = certAnchor.closest('section') || certAnchor.parentElement;
          if (certSection) {
            const items = [...certSection.querySelectorAll('li[class*="pvs-list__item"], li.artdeco-list__item')];
            items.forEach(item => {
              const spans = [...item.querySelectorAll('span[aria-hidden="true"]')]
                .map(s => s.textContent.trim()).filter(Boolean);
              if (spans.length) certifications.push({
                name:    spans[0] || '',
                issuer:  spans[1] || '',
                issued:  spans[2] || '',
                expires: spans[3] || '',
              });
            });
          }
        }

        // Reusable inline extractor for a section identified by anchor ID
        const extractSec = (anchorId, altId) => {
          const anchor = document.getElementById(anchorId) || (altId ? document.getElementById(altId) : null);
          if (!anchor) return [];
          const sec = anchor.closest('section') || anchor.parentElement;
          if (!sec) return [];
          return [...sec.querySelectorAll('li[class*="pvs-list__item"], li.artdeco-list__item')]
            .map(item => [...item.querySelectorAll('span[aria-hidden="true"]')].map(s => s.textContent.trim()).filter(Boolean))
            .filter(spans => spans.length > 0);
        };

        const projects = extractSec('projects').map(spans => ({
          name: spans[0] || '', dates: spans[1] || '', description: spans.slice(2).join(' '),
        }));
        const volunteer = extractSec('volunteering_experience', 'volunteering').map(spans => ({
          role: spans[0] || '', organization: spans[1] || '', dates: spans[2] || '', description: spans.slice(3).join(' '),
        }));
        const publications = extractSec('publications').map(spans => ({
          title: spans[0] || '', publisher: spans[1] || '', date: spans[2] || '', description: spans.slice(3).join(' '),
        }));
        const awards = extractSec('honors_and_awards', 'awards').map(spans => ({
          title: spans[0] || '', issuer: spans[1] || '', date: spans[2] || '',
        }));
        const languages = extractSec('languages').map(spans => ({
          language: spans[0] || '', proficiency: spans[1] || '',
        }));
        const organizations = extractSec('organizations').map(spans => ({
          name: spans[0] || '', role: spans[1] || '', dates: spans[2] || '',
        }));
        const courses = extractSec('courses').map(spans => ({
          name: spans[0] || '', provider: spans[1] || '',
        }));

        return { name, headline, location, about, skills, education, certifications, projects, volunteer, publications, awards, languages, organizations, courses, _source: 'dom' };
      }).catch(err => ({ name:'', headline:'', location:'', about:'', skills:[], education:[], certifications:[], projects:[], volunteer:[], publications:[], awards:[], languages:[], organizations:[], courses:[], _source:'dom-error', _err: String(err) }));

      // ── Strategy 3: AI extraction — always pass raw text for LinkedIn ──
      // DOM selectors are unreliable on LinkedIn; AI extraction in platforms.js
      // route uses this to override wrong DOM results, not just fill gaps.
      if (rawText && rawText.length > 200) {
        structured._rawForAI = rawText.slice(0, 20000);
      }
    }

    await browser.close();
    return { rawText: rawText.slice(0, 20000), structured, platform, fetchedAt: new Date().toISOString() };
  } catch (e) {
    await browser.close().catch(() => {});
    throw e;
  }
}

// ── Easy Apply via platform session ───────────────────────────────

export { PLATFORMS };
