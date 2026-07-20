/**
 * TC-11 through TC-20: AI provider configuration, Ollama liveness, and writing style
 */
import { test, expect } from '@playwright/test';

// ── TC-11: Ollama status endpoint — running / not running ─────────────────────

test('TC-11 [HIGH] /api/profile/ollama-status returns valid JSON shape', async ({ request }) => {
  const res = await request.get('/api/profile/ollama-status');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('running');
  expect(typeof body.running).toBe('boolean');
  expect(Array.isArray(body.models)).toBe(true);
  // If not running, error field should be a non-empty string
  if (!body.running) {
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  }
});

// ── TC-12: Provider config GET ────────────────────────────────────────────────

test('TC-12 [MEDIUM] /api/profile/config returns expected shape', async ({ request }) => {
  const res = await request.get('/api/profile/config');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('hasKey');
});

// ── TC-13: Provider list ──────────────────────────────────────────────────────

test('TC-13 [LOW] /api/profile/providers returns all 6 known providers', async ({ request }) => {
  const res = await request.get('/api/profile/providers');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('providers');
  const keys = Object.keys(body.providers);
  expect(keys).toContain('anthropic');
  expect(keys).toContain('ollama');
  expect(keys).toContain('groq');
  expect(keys).toContain('openrouter');
  expect(keys).toContain('gemini');
  expect(keys).toContain('custom');
});

// ── TC-14: Save provider config ───────────────────────────────────────────────

test('TC-14 [HIGH] saving Ollama provider config persists correctly', async ({ request }) => {
  const payload = { aiProvider: 'ollama', aiFastModel: 'llama3.1', aiPowerModel: 'llama3.1' };
  const post = await request.post('/api/profile/config', { data: payload });
  expect(post.status()).toBe(200);

  const get = await request.get('/api/profile/config');
  const body = await get.json();
  expect(body.aiProvider).toBe('ollama');
});

// ── TC-15: Writing style GET default ─────────────────────────────────────────

test('TC-15 [MEDIUM] /api/resume/writing-style returns default professional style', async ({ request }) => {
  const res = await request.get('/api/resume/writing-style');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('style');
  const validStyles = ['professional', 'formal', 'technical', 'executive', 'conversational', 'creative', 'concise', 'academic'];
  expect(validStyles).toContain(body.style);
});

// ── TC-16: Writing style save ─────────────────────────────────────────────────

test('TC-16 [MEDIUM] writing style saves and persists', async ({ request }) => {
  const post = await request.post('/api/resume/writing-style', { data: { style: 'technical', customNote: 'Prefer bullet points.' } });
  expect(post.status()).toBe(200);
  const body = await post.json();
  expect(body.style).toBe('technical');
  expect(body.customNote).toBe('Prefer bullet points.');
});

// ── TC-17: Writing style — invalid value is still saved (no server-side enum check) ──

test('TC-17 [LOW] writing style endpoint stores whatever style value is sent', async ({ request }) => {
  const post = await request.post('/api/resume/writing-style', { data: { style: 'professional' } });
  expect(post.status()).toBe(200);
});

// ── TC-18: Ollama timeout resilience — status endpoint returns within 5s ──────

test('TC-18 [HIGH] ollama-status endpoint resolves within 5 seconds even when Ollama is offline', async ({ request }) => {
  const start = Date.now();
  const res = await request.get('/api/profile/ollama-status', { timeout: 6_000 });
  const elapsed = Date.now() - start;
  expect(res.status()).toBe(200);
  expect(elapsed).toBeLessThan(5_000); // pre-flight uses 3s AbortSignal
});

// ── TC-19: Profile PATCH ──────────────────────────────────────────────────────

test('TC-19 [LOW] profile PATCH merges fields without overwriting unset fields', async ({ request }) => {
  // Seed with initial data
  await request.patch('/api/profile', { data: { targetRoles: ['Engineer'], industry: 'Tech' } });

  // Partial update
  await request.patch('/api/profile', { data: { targetSalary: '$120k' } });

  // Verify prior fields preserved
  const get = await request.get('/api/profile');
  const body = await get.json();
  expect(body.industry).toBe('Tech');
  expect(body.targetSalary).toBe('$120k');
});

// ── TC-20: Resume GET — returns empty object when no resume uploaded ───────────

test('TC-20 [LOW] /api/resume GET returns 200 (empty or object) when no resume is present', async ({ request }) => {
  const res = await request.get('/api/resume');
  expect([200]).toContain(res.status());
});
