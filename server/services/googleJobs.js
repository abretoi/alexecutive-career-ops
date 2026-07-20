/**
 * googleJobs.js — Google Jobs vertical (udm=8) via the user's own trusted
 * Google session.
 *
 * Why a session: Google fronts ALL automated search with its /sorry/ bot wall
 * ("unusual traffic") — plain fetch, headless, and even headed automation get
 * the wall on a flagged network. The one architecture that works without paid
 * proxy fleets is the same one used for Glassdoor/ZipRecruiter here: the user
 * opens the Connect window once, passes any human-verification as a human,
 * and searches ride the saved trusted cookies. Google Jobs is Google's index
 * of essentially every company career page on the web — this is the
 * whole-internet channel.
 */
import { getSessionStatus, createContextWithSession } from './platformSessions.js';

function hasSession() {
  try { return !!getSessionStatus('google')?.connected; } catch { return false; }
}
export function googleJobsAvailable() { return hasSession(); }

export async function searchGoogleJobs(keywords, location, limit = 20) {
  if (!hasSession()) {
    console.warn('[googlejobs] no connected Google session — connect Google in Profile & Settings → Platform Accounts');
    return [];
  }
  let browser;
  try {
    // Headed but positioned off-screen: Google refuses to boot the jobs app
    // in headless browsers; an off-screen headed window has a real fingerprint
    // and is invisible in practice.
    const ctx = await createContextWithSession('google', { headless: false, offscreen: true });
    browser = ctx.browser;
    const page = await ctx.context.newPage();
    const q = `${keywords} jobs${location ? ` near ${location}` : ''}`;
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}&udm=8&hl=en&gl=us`, {
      waitUntil: 'domcontentloaded', timeout: 35000,
    });
    await page.waitForTimeout(4500);

    if (page.url().includes('/sorry/')) {
      console.warn('[googlejobs] Google verification wall — reconnect Google in Platform Accounts and complete the check');
      return [];
    }

    // Card structure (verified against the live rendered page): each job is a
    // div[data-share-url] whose innerText lines are
    //   [logo-initial?, Title, Company, "Loc • via Source", posted, salary?, type?, perks…]
    // (the role="listitem" elements are the FILTER CHIPS, not the jobs).
    const raw = await page.evaluate((max) => {
      return [...document.querySelectorAll('[data-share-url]')]
        .filter(el => /via\s/i.test(el.innerText || ''))
        .slice(0, max)
        .map(el => ({
          // drop 1-char logo-initial lines
          lines: (el.innerText || '').split('\n').map(s => s.trim()).filter(s => s.length > 1),
          share: el.getAttribute('data-share-url') || '',
          href:  el.querySelector('a[href^="http"]')?.href || '',
        }));
    }, limit);

    return raw.map((c, i) => {
      const viaIdx = c.lines.findIndex(l => /\bvia\s/i.test(l));
      const title   = c.lines[0] || '';
      const company = c.lines[1] || '';
      let location = '', via = '';
      if (viaIdx >= 0) {
        const [locPart, viaPart] = c.lines[viaIdx].split(/[•·]?\s*via\s+/i);
        location = (locPart || '').replace(/[•·]\s*$/, '').trim();
        via = (viaPart || '').trim();
      }
      const meta = c.lines.slice(viaIdx + 1).join(' · ');
      const salary = (meta.match(/\$?[\d,.]+K?\s*[–-]\s*\$?[\d,.]+K?\s*a\s*year/i) || [''])[0];
      return {
        id: `gj-${(title + company).replace(/\W+/g, '').slice(0, 48) || i}`,
        title, company, location,
        remote: /remote|anywhere|work from home/i.test(location),
        url: c.share || c.href || `https://www.google.com/search?q=${encodeURIComponent(`${title} ${company}`)}&udm=8`,
        description: `${title} at ${company} — ${location}${via ? ` (via ${via})` : ''}. ${meta}`.slice(0, 1500),
        salary,
        datePosted: '',
        _via: via, // the site Google indexed this from (company career page, etc.)
      };
    }).filter(j => j.title && j.company && j.title !== 'Search Results');
  } catch (e) {
    console.warn('[googlejobs] search failed:', e.message.slice(0, 120));
    return [];
  } finally {
    await browser?.close().catch(() => {});
  }
}
