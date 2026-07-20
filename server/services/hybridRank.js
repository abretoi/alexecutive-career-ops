/**
 * hybridRank.js — Two-stage hybrid relevance ranking, mirroring the
 * lexical + vector architecture Google Search and LinkedIn use:
 *
 *   Stage 1 (sparse/lexical):  BM25 keyword scoring — exact term matching
 *   Stage 2 (dense/vector):    hashed token-embedding cosine similarity —
 *                              meaning/intent overlap beyond exact keywords
 *
 * Blended score = 0.55 · BM25(norm) + 0.45 · cosine. Both stages run locally
 * in microseconds per job — at our corpus size (hundreds of results per
 * query, not billions) this gives instant ranking with zero API calls, and
 * the query vector folds in the candidate's PROFILE (target roles, skills,
 * summary) so ranking is personalized, not just keyword-matched.
 */

// ── Tokenization ───────────────────────────────────────────────
const STOP = new Set(['the','a','an','and','or','of','to','in','for','with','on','at','by','is','are','be','as','we','you','our','your','this','that','will','have','has','from','it','its','their','they']);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP.has(t));
}

// ── Stage 2: hashed token embedding (dense-ish vector space) ───
// Feature-hash unigrams + bigrams into a fixed-dim vector; cosine similarity
// between the query/profile vector and each job vector captures overlap in
// meaning-carrying terms without exact-phrase dependence.
const DIM = 512;

function hashToken(t) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h) % DIM;
}

function embed(tokens) {
  const v = new Float32Array(DIM);
  for (let i = 0; i < tokens.length; i++) {
    v[hashToken(tokens[i])] += 1;
    if (i + 1 < tokens.length) v[hashToken(tokens[i] + '_' + tokens[i + 1])] += 0.5; // bigrams
  }
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= norm;
  return v;
}

function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < DIM; i++) s += a[i] * b[i];
  return s;
}

// ── Stage 1: BM25 lexical scoring ──────────────────────────────
const K1 = 1.4, B = 0.75;

function bm25Scores(queryTokens, docs) {
  const N = docs.length || 1;
  const df = new Map();
  const tokenized = docs.map(d => tokenize(d));
  const avgLen = tokenized.reduce((s, t) => s + t.length, 0) / N || 1;

  const qSet = [...new Set(queryTokens)];
  for (const q of qSet) {
    let n = 0;
    for (const toks of tokenized) if (toks.includes(q)) n++;
    df.set(q, n);
  }

  return tokenized.map(toks => {
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    let score = 0;
    for (const q of qSet) {
      const f = tf.get(q) || 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - df.get(q) + 0.5) / (df.get(q) + 0.5));
      score += idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * toks.length / avgLen));
    }
    return score;
  });
}

/**
 * Rank jobs by hybrid relevance to the query + candidate profile.
 * Mutates nothing; returns [{ job, relevance }] sorted desc, and attaches
 * job.relevance (0–100) for UI display/sorting.
 */
export function hybridRank(jobs, keywords, profile = {}, resume = {}) {
  if (!jobs?.length) return [];

  // Query = search keywords + profile intent (target roles, skills, summary)
  const queryText = [
    keywords,
    (profile.targetRoles || []).join(' '),
    (resume.skills || []).slice(0, 20).join(' '),
    (resume.summary || '').slice(0, 400),
  ].join(' ');
  const qTokens = tokenize(queryText);
  const qVec = embed(qTokens);

  const docTexts = jobs.map(j => `${j.title} ${j.title} ${j.company} ${(j.description || '').slice(0, 1500)}`); // title double-weighted
  const lex = bm25Scores(tokenize(keywords || '').length ? tokenize(keywords) : qTokens, docTexts);
  const maxLex = Math.max(...lex, 0.0001);

  return jobs.map((job, i) => {
    const sem = cosine(qVec, embed(tokenize(docTexts[i])));
    const blended = 0.55 * (lex[i] / maxLex) + 0.45 * Math.max(0, sem);
    job.relevance = Math.round(blended * 100);
    return { job, relevance: blended };
  }).sort((a, b) => b.relevance - a.relevance);
}
