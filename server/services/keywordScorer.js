/**
 * keywordScorer.js — deterministic keyword match scoring
 * Extracts required skills from JD, scores against resume sections.
 * Section weights: skills section > experience bullets > summary
 */

const STOP = new Set([
  'the','and','for','with','this','that','will','you','are','have','our','all','can','from',
  'job','role','team','work','experience','skills','ability','strong','excellent','good','must',
  'year','years','company','business','looking','seeking','join','great','help','including',
  'across','about','other','within','also','well','both','more','your','their','they','which',
  'what','when','where','how','who','would','should','could','been','into','onto','than','then',
  'over','under','upon','such','each','every','through','between','among','its','some','any',
  'these','those','there','here','after','before','during','while','make','take','use','get',
  'give','keep','put','set','let','try','ask','end','add','own','see','say','know','come','go',
  'need','want','like','just','even','may','might','does','did','has','had','was','were','not',
  'but','per','via','etc'
]);

/**
 * Tokenize text into lowercase words, filtering stop words and short tokens.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[\s,;()/\-+|[\]{}]+/)
    .map(t => t.replace(/[^a-z0-9#.]/g, ''))
    .filter(t => t.length >= 3 && !STOP.has(t));
}

/**
 * Build a frequency map from an array of tokens.
 * @param {string[]} tokens
 * @returns {Map<string, number>}
 */
function freqMap(tokens) {
  const map = new Map();
  for (const t of tokens) map.set(t, (map.get(t) || 0) + 1);
  return map;
}

/**
 * Extract top keywords from a job description.
 * @param {string} jdText
 * @returns {string[]}
 */
export function extractJDKeywords(jdText) {
  if (!jdText) return [];
  const tokens = tokenize(jdText);
  const freq = freqMap(tokens);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([term]) => term);
}

/**
 * Score how well a resume matches a job description using keyword analysis.
 *
 * @param {object|null} resume  - parsed resume object from dataStore
 * @param {string|null} jdText  - raw job description text
 * @returns {{ pct: number, matched: string[], missing: string[], total: number }}
 */
export function scoreKeywords(resume, jdText) {
  if (!resume || !jdText) {
    return { pct: 0, matched: [], missing: [], total: 0 };
  }

  // ── Build weighted resume token map ──────────────────────────
  // weight 3 for skills, 2 for experience, 1 for summary
  const weightedResume = new Map();

  function addTokens(text, weight) {
    for (const t of tokenize(text)) {
      const current = weightedResume.get(t) || 0;
      if (current < weight) weightedResume.set(t, weight);
    }
  }

  // Skills section — weight 3
  for (const skill of (resume.skills || [])) addTokens(skill, 3);

  // Experience bullets / descriptions — weight 2
  for (const exp of (resume.experience || [])) {
    addTokens(exp.title || '', 2);
    if (Array.isArray(exp.bullets)) {
      for (const b of exp.bullets) addTokens(b, 2);
    } else {
      addTokens(exp.description || '', 2);
    }
  }

  // Summary — weight 1
  addTokens(resume.summary || '', 1);

  // ── Extract JD keywords ───────────────────────────────────────
  const jdKeywords = extractJDKeywords(jdText);
  if (jdKeywords.length === 0) return { pct: 0, matched: [], missing: [], total: 0 };

  // ── Score ─────────────────────────────────────────────────────
  const matched = [];
  const missing = [];
  let weightedHits = 0;
  const maxWeightPerKeyword = 3; // max possible weight per hit

  for (const kw of jdKeywords) {
    const w = weightedResume.get(kw);
    if (w !== undefined) {
      matched.push(kw);
      weightedHits += w;
    } else {
      missing.push(kw);
    }
  }

  const maxPossible = jdKeywords.length * maxWeightPerKeyword;
  const weightedScore = maxPossible > 0 ? weightedHits / maxPossible : 0;
  const pct = Math.min(100, Math.round(weightedScore * 100));

  return { pct, matched, missing, total: jdKeywords.length };
}
