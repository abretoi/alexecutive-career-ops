import { Router } from 'express';
import { getProfile, saveProfile, getConfig, saveConfig, getApiKey } from '../db/dataStore.js';
import { optimizeLinkedIn } from '../services/claude.js';
import { PROVIDERS, getProviderStatus } from '../services/aiAdapter.js';

const router = Router();

router.get('/',        (req, res) => res.json(getProfile()));
router.patch('/',      (req, res) => { saveProfile({ ...getProfile(), ...req.body }); res.json(getProfile()); });

// Config — AI provider settings
router.get('/config',  (req, res) => {
  const cfg = getConfig();
  const provider = cfg.aiProvider || 'anthropic';
  const noKeyNeeded = provider === 'ollama' || provider === 'custom';
  const hasKey = noKeyNeeded || !!getApiKey();
  res.json({ ...cfg, hasKey, noKeyNeeded, provider });
});
router.post('/config', (req, res) => {
  const body = { ...req.body };
  // aiKeys is a per-provider map — merge it so saving one provider's key
  // never wipes the keys stored for other providers.
  if (body.aiKeys && typeof body.aiKeys === 'object') {
    body.aiKeys = { ...(getConfig().aiKeys || {}), ...body.aiKeys };
  }
  saveConfig(body);
  res.json({ ok: true, hasKey: !!getApiKey() });
});

// Provider registry + current status (used by Settings UI)
router.get('/providers', (req, res) => res.json({ providers: PROVIDERS, current: getProviderStatus() }));

// Ollama liveness probe — called by Settings UI to show real-time connection status
router.get('/ollama-status', async (req, res) => {
  try {
    const probe = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    });
    if (!probe.ok) return res.json({ running: false, models: [], error: `Ollama returned HTTP ${probe.status}` });
    const data = await probe.json();
    const models = (data.models || []).map(m => m.name);
    res.json({ running: true, models });
  } catch (e) {
    const msg = e.name === 'TimeoutError' || e.code === 'ECONNREFUSED'
      ? 'Ollama is not running. Start it with: ollama serve'
      : e.message;
    res.json({ running: false, models: [], error: msg });
  }
});

router.post('/', (req, res) => { saveProfile({ ...getProfile(), ...req.body }); res.json(getProfile()); });

// LinkedIn optimizer
router.post('/linkedin', async (req, res) => {
  try {
    const result = await optimizeLinkedIn(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Scrape a URL (LinkedIn, GitHub, portfolio) to enrich profile
router.post('/scrape-url', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'Invalid URL' });
  // Store URL reference in profile for AI context during evaluations
  const profile = getProfile();
  const urls = new Set(profile.linkedUrls || []);
  urls.add(url);
  saveProfile({ ...profile, linkedUrls: [...urls] });
  res.json({ ok: true, urls: [...urls] });
});

// Open a visible browser window at a given URL so the user can sign in and copy profile text
router.post('/open-browser', async (req, res) => {
  const { url = 'https://www.linkedin.com/in/me/' } = req.body;
  try {
    const { chromium } = await import('@playwright/test');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    // Keep browser open — user will close it manually
    res.json({ ok: true, msg: 'Browser opened. Sign in and copy your profile text.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
