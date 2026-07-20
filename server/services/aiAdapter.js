/**
 * aiAdapter.js — Provider-agnostic AI call adapter
 *
 * Supports: Anthropic (native SDK), Ollama (local/free), Groq (free tier),
 *           OpenRouter (aggregator), Google Gemini, and any Custom OpenAI-compatible endpoint.
 *
 * All providers expose OpenAI-compatible /chat/completions — except Anthropic,
 * which uses its own SDK for reliability.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../db/dataStore.js';

// ── Provider registry ──────────────────────────────────────────
export const PROVIDERS = {
  anthropic: {
    label:       'Anthropic (Claude)',
    description: 'Pay-per-token API. Haiku is ~$0.80/1M tokens. Requires a separate Anthropic API account at console.anthropic.com — NOT your Claude.ai Pro/Max subscription.',
    baseUrl:     'https://api.anthropic.com/v1',
    fastModel:   'claude-haiku-4-5-20251001',
    powerModel:  'claude-sonnet-4-6',
    models:      ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-8'],
    keyLabel:    'Anthropic API Key',
    keyPrefix:   'sk-ant-',
    keyHint:     'Get yours at console.anthropic.com → API Keys',
    freeOption:  false,
    needsKey:    true,
    setupSteps: [
      'Sign up at console.anthropic.com',
      'Go to API Keys → Create Key',
      'Paste the key (starts with sk-ant-) into the field below',
    ],
  },

  ollama: {
    label:       'Ollama (Local — Free)',
    description: 'Runs AI models entirely on your machine. No account, no API key, no cost. IMPORTANT: small models (8B, e.g. llama3.1) produce noticeably weaker resume tailoring, evaluations, and long structured output than 70B-class models. If your machine has 32GB+ RAM, use llama3.3 or qwen2.5:32b as the Power model — otherwise Ollama Cloud (below) or a free cloud tier (NVIDIA, Groq, Gemini) will give dramatically better results without bogging down your machine.',
    baseUrl:     'http://localhost:11434/v1',
    fastModel:   'llama3.1',
    powerModel:  'qwen2.5:14b',
    models:      ['llama3.1', 'llama3.3', 'qwen2.5:14b', 'qwen2.5:32b', 'mistral', 'gemma2', 'phi4'],
    keyLabel:    null,   // no key needed
    keyHint:     null,
    freeOption:  true,
    needsKey:    false,
    setupSteps: [
      'Install Ollama from ollama.com',
      'Run in terminal: ollama pull llama3.1 (fast) and ollama pull qwen2.5:14b (power, needs ~12GB RAM)',
      'With 32GB+ RAM, prefer: ollama pull llama3.3 (70B) as the power model',
      'Ollama auto-starts a local server at localhost:11434',
      'No API key needed — just click Save below',
    ],
  },

  ollamacloud: {
    label:       'Ollama Cloud (Hosted)',
    description: 'Runs Ollama models on Ollama\'s cloud GPUs — NOTHING runs on your machine, so it never bogs down. Access large models (gpt-oss 120B, Qwen3-Coder 480B, DeepSeek, Kimi, GLM) that would never fit locally. Requires a free API key from ollama.com. OpenAI-compatible.',
    baseUrl:     'https://ollama.com/v1',
    fastModel:   'gpt-oss:120b',
    powerModel:  'gpt-oss:120b',
    models:      ['gpt-oss:120b', 'qwen3-coder:480b', 'deepseek-v3.2', 'glm-5', 'kimi-k2.6', 'gemma3:27b', 'minimax-m2.5', 'nemotron-3-ultra'],
    keyLabel:    'Ollama API Key',
    keyPrefix:   '',
    keyHint:     'Get your key at ollama.com → sign in → Settings → API keys',
    freeOption:  true,
    needsKey:    true,
    setupSteps: [
      'Sign in at ollama.com (free account)',
      'Go to Settings → API keys → Create key',
      'Paste the key into the field below — no local Ollama install or GPU needed',
      'Models run entirely on Ollama\'s cloud; your machine stays idle',
    ],
  },

  nvidia: {
    label:       'NVIDIA (Free API Credits)',
    description: 'NVIDIA-hosted models at build.nvidia.com — free API key with generous credits (~40 req/min). Runs Llama 3.3 70B, Nemotron, Qwen, DeepSeek and more on NVIDIA infrastructure. Excellent free way to get 70B-class quality without local hardware.',
    baseUrl:     'https://integrate.api.nvidia.com/v1',
    fastModel:   'meta/llama-3.1-8b-instruct',
    powerModel:  'meta/llama-3.3-70b-instruct',
    models:      ['meta/llama-3.3-70b-instruct', 'meta/llama-3.1-8b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct', 'qwen/qwen2.5-72b-instruct', 'deepseek-ai/deepseek-r1'],
    keyLabel:    'NVIDIA API Key',
    keyPrefix:   'nvapi-',
    keyHint:     'Get your free key at build.nvidia.com → pick any model → Get API Key',
    freeOption:  true,
    needsKey:    true,
    maxOut:      4096,   // NIM endpoints cap completion tokens at 4096 on most models
    setupSteps: [
      'Sign up free at build.nvidia.com (NVIDIA account)',
      'Open any model page (e.g. meta/llama-3.3-70b-instruct) → click "Get API Key"',
      'Paste the key (starts with nvapi-) into the field below',
      'Also strong: nvidia/llama-3.1-nemotron-70b-instruct as the power model',
    ],
  },

  openai: {
    label:       'OpenAI (GPT)',
    description: 'OpenAI\'s GPT models via API. Pay-per-token — GPT-4o-mini is very cheap (~$0.15/1M input tokens) and strong for scoring; GPT-4o for high-quality tailoring. Requires an OpenAI platform account.',
    baseUrl:     'https://api.openai.com/v1',
    fastModel:   'gpt-4o-mini',
    powerModel:  'gpt-4o',
    models:      ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
    keyLabel:    'OpenAI API Key',
    keyPrefix:   'sk-',
    keyHint:     'Get your key at platform.openai.com → API Keys',
    freeOption:  false,
    needsKey:    true,
    setupSteps: [
      'Sign up at platform.openai.com',
      'Go to API Keys → Create new secret key',
      'Paste the key (starts with sk-) into the field below',
    ],
  },

  llama: {
    label:       'Meta Llama API',
    description: 'Meta\'s official hosted Llama models (Llama 4 Maverick/Scout, Llama 3.3) via an OpenAI-compatible endpoint. Free preview access via llama.developer.meta.com.',
    baseUrl:     'https://api.llama.com/compat/v1',
    fastModel:   'Llama-3.3-8B-Instruct',
    powerModel:  'Llama-4-Maverick-17B-128E-Instruct-FP8',
    models:      ['Llama-4-Maverick-17B-128E-Instruct-FP8', 'Llama-4-Scout-17B-16E-Instruct-FP8', 'Llama-3.3-70B-Instruct', 'Llama-3.3-8B-Instruct'],
    keyLabel:    'Llama API Key',
    keyPrefix:   '',
    keyHint:     'Get your key at llama.developer.meta.com → API Keys',
    freeOption:  true,
    needsKey:    true,
    setupSteps: [
      'Sign up at llama.developer.meta.com (Meta account)',
      'Create an API key from the dashboard',
      'Paste the key into the field below',
      'Model IDs are case-sensitive — check the exact names in Meta\'s docs',
    ],
  },

  groq: {
    maxOut:      6000,   // free tier TPM is 12,000 (prompt + completion) — leave prompt headroom
    label:       'Groq (Free Tier Available)',
    description: 'Extremely fast inference using custom hardware. Generous free tier with rate limits. Runs Llama, Mistral, and Gemma models. Great for high-speed job scoring.',
    baseUrl:     'https://api.groq.com/openai/v1',
    fastModel:   'llama-3.1-8b-instant',
    powerModel:  'llama-3.3-70b-versatile',
    models:      ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it', 'qwen-qwq-32b'],
    keyLabel:    'Groq API Key',
    keyPrefix:   'gsk_',
    keyHint:     'Get your free key at console.groq.com → API Keys',
    freeOption:  true,
    needsKey:    true,
    setupSteps: [
      'Sign up free at console.groq.com',
      'Go to API Keys → Create API Key',
      'Paste the key (starts with gsk_) into the field below',
    ],
  },

  openrouter: {
    label:       'OpenRouter (Multi-Model)',
    description: 'Aggregator for 200+ models including Claude, GPT-4, Llama, Gemini, and Mistral. Has free-tier models (look for :free suffix). Pay only for premium models.',
    baseUrl:     'https://openrouter.ai/api/v1',
    fastModel:   'meta-llama/llama-3.1-8b-instruct:free',
    powerModel:  'meta-llama/llama-3.3-70b-instruct:free',
    models:      ['meta-llama/llama-3.3-70b-instruct:free', 'meta-llama/llama-3.1-8b-instruct:free', 'deepseek/deepseek-r1:free', 'google/gemini-2.0-flash-exp:free'],
    keyLabel:    'OpenRouter API Key',
    keyPrefix:   'sk-or-',
    keyHint:     'Get your key at openrouter.ai → Keys. Free models available with no billing required.',
    freeOption:  true,
    needsKey:    true,
    setupSteps: [
      'Sign up at openrouter.ai',
      'Go to Keys → Create Key',
      'Paste the key (starts with sk-or-) below',
      'Free models: use meta-llama/llama-3.1-8b-instruct:free as the fast model',
    ],
  },

  gemini: {
    label:       'Google Gemini (Free Tier)',
    description: 'Google\'s Gemini models via OpenAI-compatible endpoint. Free tier covers Gemini 2.5 Flash-Lite (~1,000 req/day) and 2.5 Flash (~250 req/day); older 2.0-flash has NO free quota on new keys. Requires a Google AI Studio API key.',
    baseUrl:     'https://generativelanguage.googleapis.com/v1beta/openai',
    fastModel:   'gemini-2.5-flash-lite',
    powerModel:  'gemini-2.5-flash',
    models:      ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    keyLabel:    'Google AI Studio API Key',
    keyPrefix:   'AIza',
    keyHint:     'Get your free key at aistudio.google.com → Get API Key',
    freeOption:  true,
    needsKey:    true,
    setupSteps: [
      'Sign in at aistudio.google.com with your Google account',
      'Click Get API Key → Create API key in new project',
      'Paste the key (starts with AIza) into the field below',
      'Free tier models: gemini-2.5-flash-lite (fast) and gemini-2.5-flash (power) — 2.0-flash returns "quota 0" on free keys',
    ],
  },

  custom: {
    label:       'Custom / Self-Hosted',
    description: 'Any OpenAI-compatible API endpoint — vLLM, LM Studio, Together AI, Fireworks, Perplexity, or your own server. Provide the base URL and an API key if required.',
    baseUrl:     '',
    fastModel:   '',
    powerModel:  '',
    keyLabel:    'API Key (if required)',
    keyPrefix:   '',
    keyHint:     'Leave blank if your endpoint requires no authentication.',
    freeOption:  true,
    needsKey:    false,
    setupSteps: [
      'Enter your endpoint base URL (e.g. http://localhost:1234/v1)',
      'Enter the model names exactly as your server expects',
      'Add an API key if your server requires one, or leave blank',
    ],
  },
};

// ── Build call config from saved settings ─────────────────────
function getCallConfig() {
  const cfg = getConfig();
  const providerKey = cfg.aiProvider || 'anthropic';
  const meta  = PROVIDERS[providerKey] || PROVIDERS.anthropic;

  // Per-provider key map (aiKeys) lets every provider keep its own key across
  // switches; aiApiKey remains as the legacy single-key fallback.
  const apiKey   = cfg.aiKeys?.[providerKey] || cfg.aiApiKey || (providerKey === 'anthropic' ? (cfg.apiKey || '') : '');
  const baseUrl  = cfg.aiBaseUrl   || meta.baseUrl;
  const fastMdl  = cfg.aiFastModel  || meta.fastModel;
  const powerMdl = cfg.aiPowerModel || meta.powerModel;

  if (!baseUrl && providerKey !== 'ollama') throw new Error(`No base URL configured for provider "${meta.label}".`);

  return { providerKey, meta, apiKey, baseUrl, fastMdl, powerMdl };
}

// ── Anthropic native call ──────────────────────────────────────
async function callAnthropic({ apiKey, model, systemPrompt, userPrompt, maxTokens }) {
  if (!apiKey) throw new Error('No Anthropic API key configured. Go to Settings → AI Provider → enter your key.');
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return msg.content[0].text;
}

// ── Request governor ───────────────────────────────────────────
// Free-tier providers enforce strict limits (NVIDIA: 40 req/min AND ~16
// concurrent). Without throttling, a job search scoring dozens of jobs in
// parallel produces 429/503 storms. This governor enforces per-provider
// RPM + concurrency with a FIFO queue, and retries transient 429/503/timeouts
// with exponential backoff.
const PROVIDER_LIMITS = {
  nvidia:     { rpm: 36, concurrency: 4 },                // free tier: 40 RPM / 16 concurrent — stay under
  groq:       { rpm: 28, concurrency: 4, tpm: 10500 },    // free tier: 30 RPM AND 12,000 tokens/min on 70B
  gemini:     { rpm: 9,  concurrency: 3, tpm: 220000 },   // free tier: 10 RPM on 2.5-flash
  openrouter: { rpm: 18, concurrency: 4 },                // free models: 20 RPM
  llama:      { rpm: 30, concurrency: 4 },
  openai:     { rpm: 60, concurrency: 8 },
  anthropic:  { rpm: 50, concurrency: 8 },
  ollama:      { rpm: 9999, concurrency: 2 },             // local: serialize to avoid RAM thrash
  ollamacloud: { rpm: 30, concurrency: 4 },               // hosted free tier — conservative
  custom:     { rpm: 60, concurrency: 6 },
};

const governorState = {}; // providerKey → { stamps, tokenStamps, active, queue }

function govFor(providerKey) {
  if (!governorState[providerKey]) governorState[providerKey] = { stamps: [], tokenStamps: [], active: 0, queue: [] };
  return governorState[providerKey];
}

// tokens = estimated total tokens this request will consume against the
// provider's TPM window (prompt estimate + requested completion budget).
function acquireSlot(providerKey, tokens = 0) {
  const limits = PROVIDER_LIMITS[providerKey] || PROVIDER_LIMITS.custom;
  const g = govFor(providerKey);
  return new Promise(resolve => {
    const tryAcquire = () => {
      const now = Date.now();
      g.stamps = g.stamps.filter(t => now - t < 60000);
      if (limits.tpm) g.tokenStamps = g.tokenStamps.filter(s => now - s.t < 60000);
      const tokensInWindow = limits.tpm ? g.tokenStamps.reduce((sum, s) => sum + s.n, 0) : 0;
      // A single request larger than the whole TPM budget must not deadlock —
      // let it through on an empty window and rely on maxOut clamping + retry.
      const tokensOk = !limits.tpm
        || tokensInWindow + tokens <= limits.tpm
        || (tokensInWindow === 0 && g.active === 0);
      if (g.active < limits.concurrency && g.stamps.length < limits.rpm && tokensOk) {
        g.active++;
        g.stamps.push(now);
        if (limits.tpm) g.tokenStamps.push({ t: now, n: tokens });
        resolve();
        return true;
      }
      return false;
    };
    if (tryAcquire()) return;
    g.queue.push(tryAcquire);
    // Drain loop: poll queued acquisitions as slots free up / the minute window slides
    if (!g._drain) {
      g._drain = setInterval(() => {
        while (g.queue.length && g.queue[0]()) g.queue.shift();
        if (!g.queue.length) { clearInterval(g._drain); g._drain = null; }
      }, 400);
    }
  });
}

function releaseSlot(providerKey) {
  const g = govFor(providerKey);
  g.active = Math.max(0, g.active - 1);
}

function isTransient(err) {
  const m = String(err?.message || '');
  // 413 = Groq's tokens-per-minute overrun; RESOURCE_EXHAUSTED = Gemini quota window.
  // Both clear on their own within the minute — worth the backoff retry.
  return /\b429\b|\b503\b|\b413\b|Too Many Requests|ResourceExhausted|RESOURCE_EXHAUSTED|rate_limit_exceeded|tokens per minute|Service Unavailable|aborted due to timeout|TimeoutError/i.test(m);
}

// Providers often say exactly how long to wait ("Please try again in 4.67s",
// "retryDelay": "55s"). Honor that instead of guessing.
function retryHintMs(err) {
  const m = String(err?.message || '');
  const hit = m.match(/try again in ([\d.]+)\s*s/i) || m.match(/retry(?:Delay)?["':\s]+([\d.]+)s/i);
  if (hit) return Math.min(Math.ceil(parseFloat(hit[1]) * 1000) + 750, 65000);
  return null;
}

// Wrap a raw provider call with slot acquisition + transient-error retry.
async function governedCall(providerKey, fn, estTokens = 0) {
  const MAX_ATTEMPTS = 3;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await acquireSlot(providerKey, estTokens);
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isTransient(e) || attempt === MAX_ATTEMPTS) throw e;
      // Prefer the provider's own retry hint; else 5s then 22s (+ jitter) —
      // the longer second wait lets per-minute token windows slide open.
      const delay = retryHintMs(e) ?? ((attempt === 1 ? 5000 : 22000) + Math.random() * 2000);
      await new Promise(r => setTimeout(r, delay));
    } finally {
      releaseSlot(providerKey);
    }
  }
  throw lastErr;
}

// NVIDIA NIM routes by full model ID ("org/model"). A bare name like
// "llama-3.3-70b-instruct" has no route and returns a plain "404 page not found".
// Auto-prefix the common families so a missing org prefix never breaks calls.
const NVIDIA_ORG_PREFIXES = [
  [/nemotron/i,           'nvidia/'],  // must precede the llama rule: "llama-3.1-nemotron-…" is an nvidia/ model
  [/^llama|^meta-llama/i, 'meta/'],
  [/^qwen/i,              'qwen/'],
  [/^deepseek/i,          'deepseek-ai/'],
  [/^mistral|^mixtral/i,  'mistralai/'],
  [/^gemma/i,             'google/'],
  [/^phi/i,               'microsoft/'],
];
function normalizeNvidiaModel(model) {
  if (!model || model.includes('/')) return model;
  for (const [re, prefix] of NVIDIA_ORG_PREFIXES) {
    if (re.test(model)) return prefix + model.replace(/^meta-llama-/i, 'llama-');
  }
  return model;
}

// ── OpenAI-compatible call (all other providers) ───────────────
async function callOpenAICompat({ baseUrl, apiKey, model, systemPrompt, userPrompt, maxTokens, providerKey }) {
  if (providerKey === 'nvidia') model = normalizeNvidiaModel(model);
  const headers = { 'Content-Type': 'application/json' };

  // All OpenAI-compatible endpoints — INCLUDING Gemini's /v1beta/openai path —
  // authenticate with a Bearer token. (x-goog-api-key is only for Gemini's
  // native API and produced "Missing or invalid Authorization header" here.)
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // OpenRouter requires these headers per their docs
  if (providerKey === 'openrouter') {
    headers['HTTP-Referer'] = 'http://localhost:3000';
    headers['X-Title'] = 'Alexecutive Career Ops';
  }

  // Clamp output tokens to the provider's completion cap (e.g. NVIDIA NIM rejects
  // requests above 4096). The truncation-salvage in claude.js parseJson() recovers
  // gracefully when a large payload gets cut at the cap.
  const cap = PROVIDERS[providerKey]?.maxOut;
  const effectiveMax = cap ? Math.min(maxTokens, cap) : maxTokens;

  const body = {
    model,
    max_tokens: effectiveMax,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
  };

  // Generous timeouts: free-tier 70B models generating 4k tokens routinely take
  // 2-3 minutes; the old 90s ceiling caused "operation aborted due to timeout"
  // on the Recruiter / Hiring Manager chain steps.
  const timeoutMs = providerKey === 'ollama' ? 300000 : 240000;

  // Ollama liveness pre-flight: surface a clear error before the model call times out
  if (providerKey === 'ollama') {
    try {
      const probe = await fetch(`${baseUrl.replace('/v1', '').replace(/\/$/, '')}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!probe.ok) throw new Error('not ok');
      const tags = await probe.json();
      const models = (tags.models || []).map(m => m.name);
      if (models.length > 0 && !models.some(m => m.startsWith(model.split(':')[0]))) {
        throw new Error(
          `Ollama model "${model}" not found. Models available: ${models.join(', ')}. ` +
          `Run: ollama pull ${model}`
        );
      }
    } catch (e) {
      if (e.message.includes('ollama model') || e.message.includes('not found')) throw e;
      throw new Error(
        'Ollama is not running or not reachable at localhost:11434. ' +
        'Start it with: ollama serve'
      );
    }
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    if (providerKey === 'nvidia' && res.status === 404) {
      throw new Error(
        `NVIDIA API 404 — model "${model}" was not found. NVIDIA model IDs need the org prefix ` +
        `(e.g. "meta/llama-3.3-70b-instruct", "nvidia/llama-3.1-nemotron-70b-instruct"). ` +
        `Check the exact ID on build.nvidia.com and update Settings → AI Provider.`
      );
    }
    throw new Error(`${PROVIDERS[providerKey]?.label || providerKey} API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Public adapter functions ───────────────────────────────────

/**
 * callFast — uses the fast/cheap model (Haiku-equivalent)
 * For: quick scoring, ATS checks, parsing, salary estimates, recommendations
 */
// Rough token estimate for TPM budgeting: ~1 token per 4 chars of prompt,
// plus the full completion budget (providers count max_tokens against TPM).
function estimateTokens(systemPrompt, userPrompt, maxTokens) {
  return Math.ceil(((systemPrompt?.length || 0) + (userPrompt?.length || 0)) / 4) + maxTokens;
}

export async function callFast(systemPrompt, userPrompt, maxTokens = 512) {
  const { providerKey, apiKey, baseUrl, fastMdl } = getCallConfig();
  if (!fastMdl) throw new Error('No fast model configured. Go to Settings → AI Provider.');

  return governedCall(providerKey, () => providerKey === 'anthropic'
    ? callAnthropic({ apiKey, model: fastMdl, systemPrompt, userPrompt, maxTokens })
    : callOpenAICompat({ baseUrl, apiKey, model: fastMdl, systemPrompt, userPrompt, maxTokens, providerKey }),
    estimateTokens(systemPrompt, userPrompt, maxTokens));
}

/**
 * callPower — uses the powerful model (Sonnet-equivalent)
 * For: full evaluation, resume tailoring, CV generation, LinkedIn optimizer, application assistance
 */
export async function callPower(systemPrompt, userPrompt, maxTokens = 2048) {
  const { providerKey, apiKey, baseUrl, powerMdl } = getCallConfig();
  if (!powerMdl) throw new Error('No power model configured. Go to Settings → AI Provider.');

  // Clamp the TPM estimate to the provider's output cap so the governor
  // budgets what will actually be requested.
  const cap = PROVIDERS[providerKey]?.maxOut;
  const effMax = cap ? Math.min(maxTokens, cap) : maxTokens;

  return governedCall(providerKey, () => providerKey === 'anthropic'
    ? callAnthropic({ apiKey, model: powerMdl, systemPrompt, userPrompt, maxTokens })
    : callOpenAICompat({ baseUrl, apiKey, model: powerMdl, systemPrompt, userPrompt, maxTokens, providerKey }),
    estimateTokens(systemPrompt, userPrompt, effMax));
}

/**
 * getProviderStatus — returns current provider + connection info for the Settings UI
 */
export function getProviderStatus() {
  try {
    const cfg = getConfig();
    const providerKey = cfg.aiProvider || 'anthropic';
    const meta  = PROVIDERS[providerKey] || PROVIDERS.anthropic;
    const apiKey = cfg.aiApiKey || (providerKey === 'anthropic' ? cfg.apiKey : '');
    const configured = providerKey === 'ollama' ? true : !!apiKey;
    return { providerKey, label: meta.label, configured, freeOption: meta.freeOption };
  } catch {
    return { providerKey: 'anthropic', label: 'Anthropic', configured: false, freeOption: false };
  }
}
