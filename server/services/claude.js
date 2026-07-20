/**
 * claude.js — AI service layer (provider-agnostic)
 * Routes all calls through aiAdapter.js — works with Anthropic, Ollama,
 * Groq, OpenRouter, Gemini, or any OpenAI-compatible endpoint.
 */
import { callFast, callPower } from './aiAdapter.js';
import { getProfile, getResume } from '../db/dataStore.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function loadMode(name) {
  try { return readFileSync(path.join(ROOT, 'modes', `${name}.md`), 'utf8'); }
  catch { return ''; }
}

function parseJson(text) {
  if (!text) return null;

  // 1. Strip markdown code fences: ```json ... ``` or ``` ... ```
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  // 2. Extract outermost JSON object or array
  const objMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  const json = objMatch?.[0];
  if (!json) return null;

  // 3. Direct parse
  try { return JSON.parse(json); } catch { /* fall through */ }

  // 4. Sanitize raw control characters inside string values, then retry
  try {
    const sanitized = json.replace(/("(?:[^"\\]|\\.)*")/g, match =>
      match.replace(/[\x00-\x1f\x7f]/g, ch => {
        const map = {'\n':'\\n','\r':'\\r','\t':'\\t','\b':'\\b','\f':'\\f'};
        return map[ch] ?? `\\u${ch.charCodeAt(0).toString(16).padStart(4,'0')}`;
      })
    );
    return JSON.parse(sanitized);
  } catch { /* fall through */ }

  // 5. Remove trailing commas before } or ] which some models emit
  try {
    const trailingCommaFixed = json.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(trailingCommaFixed);
  } catch { /* fall through */ }

  // 6. Salvage TRUNCATED JSON (response hit the token limit mid-object).
  //    Walk the string tracking string/escape state and bracket depth, then
  //    close any still-open structures at the last safe point. This recovers
  //    the complete array elements that DID arrive (critical for the 20-question
  //    Hiring Manager and 10-question Recruiter payloads).
  const salvaged = salvageTruncatedJson(cleaned);
  if (salvaged) return salvaged;

  return null;
}

function salvageTruncatedJson(input) {
  const start = input.search(/[{[]/);
  if (start < 0) return null;
  const s = input.slice(start);

  let inStr = false, esc = false;
  const stack = [];
  let lastComplete = -1; // index (exclusive) of a point where depth returns to a container boundary

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') {
      stack.pop();
      // Record a boundary right after a top-level array element closes
      if (stack.length === 1) lastComplete = i + 1;
    }
  }

  // Attempt 1: close whatever is still open from the current end.
  const tryClose = (str) => {
    let depth = [], q = false, e = false;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (q) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') q = false; continue; }
      if (c === '"') q = true;
      else if (c === '{' || c === '[') depth.push(c);
      else if (c === '}' || c === ']') depth.pop();
    }
    let out = str;
    if (q) out += '"';
    // strip a dangling trailing comma or partial key/value
    out = out.replace(/,\s*("[^"]*"\s*:?\s*)?$/, '');
    for (let i = depth.length - 1; i >= 0; i--) out += depth[i] === '{' ? '}' : ']';
    try { return JSON.parse(out); } catch { return null; }
  };

  let result = tryClose(s);
  if (result) return result;

  // Attempt 2: truncate back to the last complete top-level array element, then close.
  if (lastComplete > 0) {
    result = tryClose(s.slice(0, lastComplete));
    if (result) return result;
  }
  return null;
}

// Coerce a dates value (string OR {startDate,endDate} object) into a clean display string.
function fmtDates(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.trim();
  if (typeof d === 'object') {
    const s = (d.startDate || d.start || d.from || '').toString().trim();
    const e = (d.endDate || d.end || d.to || '').toString().trim();
    if (s && e) return `${s} – ${e}`;
    return s || e || '';
  }
  return String(d);
}

// Produce a clean, human-readable copy of a resume for feeding into AI prompts.
// Flattens {dates:{startDate}} → "April 2021 – Present" so the model evaluates
// resume CONTENT, not the JSON structure (which caused bogus "startDate format" flags).
function normalizeResume(resume) {
  if (!resume || typeof resume !== 'object') return resume;
  // Drop bulky fields that aren't needed for content evaluation and would crowd
  // out experience/education when the serialized prompt is truncated.
  const { rawText, styleMetadata, ...rest } = resume;
  return {
    ...rest,
    experience: (resume.experience || []).map(e => ({
      title:    e.title || '',
      company:  e.company || '',
      dates:    fmtDates(e.dates),
      location: e.location || '',
      bullets:  (e.bullets || []).map(b => (typeof b === 'string' ? b : (b?.text || b?.value || ''))).filter(Boolean),
    })),
    education: (resume.education || []).map(ed => ({
      degree:      ed.degree || ed.institution || '',
      institution: ed.institution || ed.school || '',
      year:        fmtDates(ed.year) || ed.year || '',
      location:    ed.location || '',
    })),
  };
}

// Render the stored resume as a traditional plain-text resume for AI prompts
// that judge the DOCUMENT (ATS audits, recruiter screens). Feeding raw JSON
// made models flag "resume is in JSON format" — a phantom issue: the user
// uploaded a PDF/DOCX; JSON is just our internal storage.
function resumeToText(resume) {
  if (!resume) return '';
  const r = normalizeResume(resume);
  const lines = [];
  if (r.name) lines.push(r.name.toUpperCase());
  const contact = [r.email, r.phone, r.location, r.linkedin].filter(Boolean).join(' | ');
  if (contact) lines.push(contact);
  if (r.summary) lines.push('', 'SUMMARY', r.summary);
  if (Array.isArray(r.skills) && r.skills.length) lines.push('', 'SKILLS', r.skills.join(', '));
  if (r.experience?.length) {
    lines.push('', 'EXPERIENCE');
    r.experience.forEach(e => {
      lines.push(`${e.title || ''} — ${e.company || ''}${e.dates ? ` (${e.dates})` : ''}${e.location ? `, ${e.location}` : ''}`);
      (e.bullets || []).forEach(b => lines.push(`• ${b}`));
      lines.push('');
    });
  }
  if (r.education?.length) {
    lines.push('EDUCATION');
    r.education.forEach(ed => lines.push(`${ed.degree || ''} — ${ed.institution || ''}${ed.year ? ` (${ed.year})` : ''}`));
  }
  if (Array.isArray(resume.certifications) && resume.certifications.length) {
    lines.push('', 'CERTIFICATIONS');
    resume.certifications.forEach(c => lines.push(typeof c === 'string' ? c : `${c.name || ''}${c.issuer ? ` — ${c.issuer}` : ''}${c.year ? ` (${c.year})` : ''}`));
  }
  return lines.join('\n');
}

// Strip leftover prompt-placeholder tokens (e.g. "<b>", "<rewritten>") and normalize
// dates in an AI-generated resume/CV object so the client never renders raw placeholders.
function stripPlaceholderStr(s) {
  if (typeof s !== 'string') return s;
  return /^<[^<>]{1,25}>$/.test(s.trim()) ? '' : s;
}
function sanitizeResumeOutput(r) {
  if (!r || typeof r !== 'object') return r;
  const cleanArr = a => (Array.isArray(a) ? a.map(stripPlaceholderStr).filter(Boolean) : a);
  // Models sometimes emit a single object or string where an array belongs
  // (e.g. education: {...} → "r.education.map is not a function" client crash).
  const forceArr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
  if (r.summary) r.summary = stripPlaceholderStr(r.summary);
  if (r.changesSummary) r.changesSummary = stripPlaceholderStr(r.changesSummary);
  if (r.skills != null) r.skills = cleanArr(forceArr(r.skills));
  if (r.keywordsAdded != null) r.keywordsAdded = cleanArr(forceArr(r.keywordsAdded));
  if (r.experience != null) {
    r.experience = forceArr(r.experience).map(e => (typeof e !== 'object' || !e) ? null : ({
      ...e,
      title:   stripPlaceholderStr(e.title),
      company: stripPlaceholderStr(e.company),
      dates:   fmtDates(e.dates),
      bullets: cleanArr(forceArr(e.bullets)),
    })).filter(Boolean);
  }
  if (r.education != null) {
    r.education = forceArr(r.education)
      .map(ed => typeof ed === 'string' ? { degree: ed } : ed)
      .filter(ed => ed && typeof ed === 'object');
  }
  return r;
}

// ── Quick Score ───────────────────────────────────────────────
// Shared scorer persona/rubric for single and batched scoring.
function buildScorerSystemPrompt() {
  const profile = getProfile();
  const resume  = getResume();
  const workHistory = (resume?.experience || []).slice(0, 4)
    .map(e => `- ${e.title || ''} at ${e.company || ''}`).join('\n');

  return `You are a seasoned technical recruiter scoring job-fit for one specific candidate. Score honestly and use the FULL 1.0-5.0 range — do not cluster scores in the middle.

CANDIDATE PROFILE:
Target roles: ${JSON.stringify(profile.targetRoles || [])}
Industry: ${profile.primaryIndustry || 'not specified'}
Seniority: ${profile.seniority || 'Mid'}
Remote preference: ${profile.remotePreference || 'any'}
${resume?.summary ? `Summary: ${resume.summary}` : ''}
${workHistory ? `Work history:\n${workHistory}` : ''}
${resume?.skills?.length ? `Skills: ${resume.skills.slice(0, 25).join(', ')}` : ''}

SCORING RUBRIC (anchor to these):
5.0 — Title and skills align directly with the candidate's strongest experience; they would be a top-quartile applicant.
4.0-4.5 — Strong overlap in function and skills; 1-2 minor gaps; clearly worth applying.
3.0-3.5 — Adjacent role: transferable skills but a real domain or seniority gap; worth considering with a tailored resume.
2.0-2.5 — Significant mismatch in function, seniority, or required skills; long-shot at best.
1.0-1.5 — Different profession entirely, or hard requirements (license, clearance, specific degree) the candidate lacks.

Verdict mapping: score >= 4.0 → "Apply"; 3.0-3.9 → "Consider"; < 3.0 → "Skip".`;
}

/**
 * quickScoreBatch — score up to ~8 jobs in ONE model call.
 * Rate-limit lifesaver: a 6-board search scoring 30 jobs each went from
 * ~180 requests to ~24, which is what makes free-tier providers (NVIDIA
 * 40 RPM, Gemini 15 RPM) usable at all.
 * Returns an array aligned by the input order; unscored entries get score null.
 */
export async function quickScoreBatch(jobs) {
  if (!jobs?.length) return [];
  const sys = buildScorerSystemPrompt();

  const jobLines = jobs.map((j, i) =>
    `JOB ${i + 1}: ${j.title} at ${j.company} (${j.location || 'unknown'})\n${(j.description || '').slice(0, 600)}`
  ).join('\n\n---\n\n');

  const usr = `Score EACH of the ${jobs.length} jobs below for the candidate. Return ONLY valid JSON — an array with EXACTLY ${jobs.length} entries, in the same order:
[{"i":1,"score":<1.0-5.0>,"archetype":"<Technology|Finance|Healthcare|Legal|Creative/Marketing|Operations|Sales|Education|Executive|Trades|Customer Success|HR|Government/Nonprofit|Scientific/R&D|Engineering>","verdict":"<Apply|Consider|Skip>","reason":"<one specific sentence>"}]

${jobLines}`;

  const empty = { score: null, archetype: 'Unknown', verdict: 'Unscored', reason: 'Scoring unavailable' };
  try {
    const text = await callFast(sys, usr, Math.min(220 * jobs.length + 100, 2000));
    const parsed = parseJson(text);
    const arr = Array.isArray(parsed) ? parsed : parsed?.results || parsed?.jobs || [];
    return jobs.map((_, idx) => {
      const hit = arr.find(r => r.i === idx + 1) || arr[idx];
      return (hit && typeof hit.score === 'number')
        ? { score: hit.score, archetype: hit.archetype || 'Unknown', verdict: hit.verdict || 'Consider', reason: hit.reason || '' }
        : { ...empty };
    });
  } catch (e) {
    console.error('quickScoreBatch error:', e.message);
    return jobs.map(() => ({ ...empty, reason: `Scoring unavailable: ${e.message.slice(0, 100)}` }));
  }
}

export async function quickScore(job) {
  const sys = buildScorerSystemPrompt();

  const usr = `Score this job for the candidate above. Return ONLY valid JSON.

Job: ${job.title} at ${job.company}
Location: ${job.location || 'unknown'}
Description: ${(job.description || '').slice(0, 1400)}

Return exactly:
{"score":<1.0-5.0, one decimal>,"archetype":"<Technology|Finance|Healthcare|Legal|Creative/Marketing|Operations|Sales|Education|Executive|Trades|Customer Success|HR|Government/Nonprofit|Scientific/R&D|Engineering>","verdict":"<Apply|Consider|Skip>","reason":"<one specific sentence citing the strongest match or mismatch>"}`;

  try {
    const text = await callFast(sys, usr, 250);
    const parsed = parseJson(text);
    if (parsed && typeof parsed.score === 'number') return parsed;
    // Never fake a middling score — a null score renders as unrated, not as 2.5.
    return { score: null, archetype: 'Unknown', verdict: 'Unscored', reason: 'AI scoring returned an unreadable response.' };
  } catch (e) {
    console.error('quickScore error:', e.message);
    return { score: null, archetype: 'Unknown', verdict: 'Unscored', reason: `AI scoring unavailable: ${e.message.slice(0, 120)}` };
  }
}

// ── Full Evaluation (6-block A–F report) ─────────────────────
export async function fullEvaluate(job) {
  const profile  = getProfile();
  const resume   = getResume();
  const evalMode = loadMode('evaluate');

  const sys = `You are an expert career coach producing a detailed job evaluation report.
${evalMode}
User Profile:
- Name: ${profile.name || 'Candidate'}
- Target roles: ${JSON.stringify(profile.targetRoles || [])}
- Industry: ${profile.primaryIndustry}
- Seniority: ${profile.seniority}
- Salary target: $${profile.salaryMin}–$${profile.salaryMax} ${profile.currency}
- Remote pref: ${profile.remotePreference}
- Deal-breakers: ${JSON.stringify(profile.dealBreakers || [])}
${profile.narrative ? `- Narrative: ${profile.narrative}` : ''}
Resume:
${resume ? JSON.stringify(resume, null, 2).slice(0, 3000) : 'No resume uploaded yet.'}`;

  const usr = `Evaluate this job. Return a comprehensive JSON report.

Company: ${job.company}
Title: ${job.title}
Location: ${job.location}
Salary: ${job.salary || 'Not listed'}
URL: ${job.url || 'N/A'}
Description:
${(job.description || '').slice(0, 4000)}

Return JSON with this exact structure:
{
  "score":<1.0-5.0>,"label":"<Excellent Match|Good Match|Worth Considering|Weak Match|Poor Match>",
  "verdict":"<Apply|Consider|Skip>","archetype":"<industry archetype>","legitimacy":<1|2|3>,
  "blockA":{"oneLiner":"<verdict>","strengths":["<s1>","<s2>","<s3>"],"gaps":["<g1>","<g2>"]},
  "blockB":{"requirements":[{"req":"<r>","match":"<strong|partial|gap>","note":"<n>"}]},
  "blockC":{"narrative":"<positioning>","differentiators":["<d1>","<d2>"]},
  "blockD":{"salaryAssessment":"<vs target>","marketRange":"<range>","flag":"<flags>"},
  "blockE":{"summaryChanges":"<changes>","keywordsToAdd":["<kw>"],"bulletsToRewrite":["<s>"]},
  "blockF":{"questions":["<q1>","<q2>","<q3>","<q4>","<q5>","<q6>","<q7>","<q8>"],"companyInsights":"<insights>","askTheInterviewer":["<q1>","<q2>","<q3>","<q4>"]}
}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const text = await callPower(sys, usr, 3500);
    const json = parseJson(text);
    if (json) return { ...json, job };
    if (attempt < 3) await new Promise(r => setTimeout(r, 800));
  }
  throw new Error('Invalid evaluation response from AI provider after 3 attempts');
}

// ── Resume Tailoring ──────────────────────────────────────────
export async function tailorResume(job, targetKeywords, writingStyle) {
  const resume = getResume();
  if (!resume) throw new Error('No resume uploaded. Upload your resume first.');

  const STYLE_NOTES = {
    formal: 'Use formal, structured language. Avoid contractions and colloquialisms.',
    technical: 'Use precise technical language. Emphasize technical depth and quantified outcomes.',
    executive: 'Use strategic, high-level language. Lead with impact and business outcomes.',
    conversational: 'Use warm, approachable language. Avoid stiff corporate-speak.',
    creative: 'Use narrative-driven, distinctive language with strong voice.',
    concise: 'Be extremely concise. Every word must earn its place. Avoid filler phrases.',
    academic: 'Use methodical, research-forward language. Cite contributions systematically.',
  };
  const styleInstruction = writingStyle && STYLE_NOTES[writingStyle]
    ? `\nWRITING STYLE (${writingStyle}): ${STYLE_NOTES[writingStyle]}` : '';

  const styleGuide = resume.styleMetadata ? `
ORIGINAL RESUME STYLE (preserve exactly):
- Format: ${resume.styleMetadata.format || 'standard'}
- Section order: ${(resume.styleMetadata.sectionOrder || []).join(' → ')}
- Bullet style: ${resume.styleMetadata.bulletStyle || 'hyphen'}
- Header style: ${resume.styleMetadata.headerStyle || 'ALL CAPS'}
- Date format: ${resume.styleMetadata.dateFormat || 'Month YYYY – Month YYYY'}
- Notable formatting: ${resume.styleMetadata.notes || 'none'}` : '';

  const sys = `You are an expert ATS resume writer. Tailor resumes truthfully without fabricating experience.
CRITICAL: Preserve the candidate's original style exactly — section order, bullet style, header casing, date formats, layout.
${styleGuide}${styleInstruction}
Rules: mirror exact JD keywords; never fabricate; preserve section order and bullet formatting; max 2 pages.`;

  const usr = `Tailor this resume for the job. Return JSON only. Fill EVERY field with real, finished content — never leave placeholder tokens or angle brackets in the output.

ORIGINAL RESUME (preserve its exact formatting style):
${JSON.stringify(normalizeResume(resume), null, 2).slice(0, 2500)}

ORIGINAL RAW TEXT SAMPLE (style reference):
${resume.rawText || ''}

JOB:
Title: ${job.title} at ${job.company}
Key requirements: ${(targetKeywords || []).join(', ')}
Description: ${(job.description || '').slice(0, 2000)}

Return this exact shape, with dates as plain strings like "April 2021 – Present":
{"summary":"rewritten professional summary","skills":["skill"],"experience":[{"title":"role title","company":"company name","dates":"April 2021 – Present","location":"City, ST","bullets":["achievement bullet"]}],"keywordsAdded":["keyword"],"changesCount":0,"changesSummary":"what changed and why","stylePreserved":true}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const text = await callPower(sys, usr, 4500);
    const json = parseJson(text);
    if (json) {
      // Merge invariant fields from the original resume — the AI only rewrites
      // summary/skills/experience; name, contact, education, certifications are preserved exactly.
      const contact = [resume.email, resume.phone, resume.location, resume.linkedin].filter(Boolean).join(' · ');
      return sanitizeResumeOutput({
        name: resume.name || '',
        email: resume.email || '',
        phone: resume.phone || '',
        location: resume.location || '',
        linkedin: resume.linkedin || '',
        contact,
        education: resume.education || [],
        certifications: resume.certifications || [],
        ...json,
      });
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 800));
  }
  throw new Error('Invalid tailoring response');
}

// ── CV Generation ─────────────────────────────────────────────
export async function generateCV(job, resume) {
  const sys = `You are an expert CV writer. Build on the candidate's existing style — same section naming, bullet formatting, header casing, and tone. Do not switch templates.`;

  const usr = `Generate a tailored CV for this candidate. Return JSON only.

CANDIDATE:
${JSON.stringify({ name: resume.name, email: resume.email, phone: resume.phone, location: resume.location, linkedin: resume.linkedin, summary: resume.summary, skills: resume.skills, ...normalizeResume(resume), certifications: resume.certifications }, null, 2).slice(0, 2500)}

STYLE REFERENCE:
${resume.rawText ? `Raw text sample: ${resume.rawText.slice(0, 400)}` : ''}
${resume.styleMetadata ? `Style: ${JSON.stringify(resume.styleMetadata)}` : ''}

TARGET ROLE:
Title: ${job?.title || 'General'}
Company: ${job?.company || ''}
Description: ${(job?.description || '').slice(0, 1500)}

Fill EVERY field with real, finished content — never leave placeholder tokens or angle brackets in the output. Dates must be plain strings like "April 2021 – Present".
Return structured JSON — same shape as a tailored resume, NOT a text blob:
{"name":"full name","contact":"email · phone · location · linkedin","summary":"rewritten professional summary targeting the role","skills":["skill"],"experience":[{"title":"title","company":"company","dates":"April 2021 – Present","location":"City, ST","bullets":["achievement bullet"]}],"education":[{"degree":"degree","institution":"school","year":"year"}],"keywordsAdded":["keyword"],"changesCount":0,"changesSummary":"what was emphasized for this role"}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const text = await callPower(sys, usr, 4000);
    const json = parseJson(text);
    if (json) return sanitizeResumeOutput(json);
    if (attempt < 3) await new Promise(r => setTimeout(r, 800));
  }
  throw new Error('Invalid CV response');
}

// ── LinkedIn Optimization ─────────────────────────────────────
export async function optimizeLinkedIn(currentContent) {
  const profile = getProfile();
  const resume  = getResume();

  const sys = `You are an expert LinkedIn profile optimizer. Write compelling, keyword-rich profiles recruiters discover. Work with whatever the candidate provides — many people keep detailed bullets off their public profile, so infer intelligently from their headline, About text, free-form profile text, target roles, and resume. Never refuse for lack of detail; produce a strong optimization from what's available.`;

  // Pull together every scrap of signal: pasted fields, free-form profile text, and the resume.
  const resumeExperience = (resume?.experience || []).map(e => ({
    title: e.title, company: e.company,
    bullets: (e.bullets || []).slice(0, 5),
  }));

  const usr = `Optimize this LinkedIn profile for the candidate's target roles. Fill every field with finished content — no placeholder tokens or angle brackets.

Target roles: ${JSON.stringify(profile.targetRoles || [])}
Industry: ${profile.primaryIndustry || 'Not specified'}
Resume summary: ${resume?.summary || 'Not provided'}
Resume experience — rewrite bullets for EVERY SINGLE role listed here, no limit: ${JSON.stringify(resumeExperience).slice(0, 8000)}

Current LinkedIn content the candidate provided:
Headline: ${currentContent.headline || '(none)'}
About: ${currentContent.about || '(none)'}
Full profile text / experience: ${(currentContent.profileText || currentContent.bullets || '(none)').slice(0, 6000)}
Listed skills: ${(currentContent.skills || []).join(', ') || '(none)'}

REQUIREMENTS:
1. experienceBullets: write 2-3 CONCRETE rewritten bullets for EVERY SINGLE role in the resume experience above — there is no limit, rewrite ALL roles regardless of career length. Take the candidate's real accomplishments and rewrite them recruiter-optimized (metric-driven, keyword-rich, LinkedIn-appropriate). Never return generic advice like "add more metrics" — write the actual finished bullet they should paste.
2. checklistAudit: grade the profile against each item of the standard LinkedIn optimization checklist below using ONLY the evidence provided (mark "unknown" for items you cannot see, e.g. photo/banner):
   - headline: optimized with 2-3 keywords, no "seeking opportunities"
   - about: 500+ words, story-driven, keyword-rich, call-to-action at end
   - experience-bullets: all roles have 3-5 metric-driven bullets
   - skills: strong skill list led by target-role keywords (50 max on LinkedIn)
   - keywords: target-role terms present across headline + about + experience
   - open-to-work: clear target titles
   For each: status "pass" | "partial" | "fail" | "unknown", a 0-10 score, and 1-2 sentences of SPECIFIC feedback quoting their actual content.

Return ONLY valid JSON:
{"headline":{"current":${JSON.stringify(currentContent.headline || '')},"optimized":"120-char keyword-rich headline","explanation":"why this is stronger"},"about":{"optimized":"full About section, 3-5 short paragraphs","hook":"first 2 lines","keywords":["keyword"]},"experienceBullets":[{"role":"role title at company","original":"their actual current bullet or (none listed publicly)","optimized":"finished rewritten bullet ready to paste"}],"checklistAudit":[{"item":"headline","label":"Headline optimized","status":"pass|partial|fail|unknown","score":0,"feedback":"specific feedback quoting their content"}],"topSkills":["skill"],"openToWorkTitles":["target title"],"profileScore":0,"topImprovements":["specific action"]}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const text = await callPower(sys, usr, 8000);
    const json = parseJson(text);
    if (json) return json;
    if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
  }
  return {
    headline: { current: currentContent.headline || '', optimized: '', explanation: '' },
    about: { optimized: '', hook: '', keywords: [] },
    experienceBullets: [], topSkills: currentContent.skills || [], openToWorkTitles: [],
    profileScore: 0, topImprovements: [],
    _error: 'The optimizer response could not be parsed after 3 attempts. Try a more capable AI provider, or check Settings.',
  };
}

// ── Parse Resume from Text ────────────────────────────────────
export async function parseResumeText(rawText) {
  const sys = `Parse resume text into structured JSON. Be accurate and COMPLETE.
CRITICAL: Include EVERY position in the work history — all jobs, all past roles, oldest to newest, with all their bullets. Never summarize, sample, or drop older roles. A resume with 8 positions must produce 8 experience entries.`;
  const usr = `Parse this resume in full. Return ONLY JSON.

RESUME TEXT:
${rawText.slice(0, 14000)}

Return:
{"name":"","email":"","phone":"","location":"","linkedin":"","summary":"","skills":[""],"experience":[{"title":"","company":"","dates":"","location":"","bullets":[""]}],"education":[{"degree":"","school":"","year":"","location":"","details":""}],"certifications":[{"name":"","issuer":"","year":""}],"rawText":"<first 300 chars>","styleMetadata":{"format":"<single-column|two-column|hybrid>","sectionOrder":["<sections in order>"],"bulletStyle":"<hyphen|bullet-dot|no-bullet|arrow>","headerStyle":"<ALL CAPS|Title Case|bold>","dateFormat":"<Month YYYY|MM/YYYY|Year only|other>","tone":"<formal|modern|academic|creative>","notes":"<formatting quirks>"}}`;

  // Power model + a large completion budget: parsing happens once per upload
  // and completeness matters — the old 3k-token fast call truncated long
  // resumes, silently dropping older roles.
  const text = await callPower(sys, usr, 8000);
  const json = parseJson(text);
  if (!json) throw new Error('Could not parse resume');
  return sanitizeResumeOutput(json);
}

// ── Writing style descriptors ─────────────────────────────────
const STYLE_DESCRIPTORS = {
  professional: 'polished, business-standard language — confident, clear, and universally appropriate across industries',
  formal:       'structured and traditional with careful grammar and measured tone — appropriate for law, finance, banking, government, and academic institutions',
  technical:    'precise and jargon-comfortable with specific terminology — best for engineering, data science, DevOps, and IT roles where specificity builds credibility',
  executive:    'strategic and high-level with leadership framing — focus on vision, impact, and organizational outcomes; appropriate for Director, VP, and C-suite applications',
  conversational: 'warm, natural, and approachable without being casual — builds human connection; works well at startups, creative companies, and mission-driven organizations',
  creative:     'engaging, narrative-driven, and distinctive with thoughtful word choice — for marketing, design, content, UX, and media roles where voice signals craft',
  concise:      'direct, efficiency-focused, and respectful of the reader\'s time — tight sentences, active voice, no filler; every word earns its place',
  academic:     'research-forward and methodical with careful attribution of claims — appropriate for higher education, R&D, scientific, and policy roles',
};

// ── Application Packet (batch apply) ─────────────────────────
export async function generateApplicationPacket(job, options = {}) {
  const profile = getProfile();
  const resume  = getResume();

  // Accept explicit overrides or fall through to dataStore
  const { writingStyle: styleOverride, coverLetterSample: sampleOverride } = options;

  let writingStyle = styleOverride;
  let coverLetterSample = sampleOverride;

  if (!writingStyle || !coverLetterSample) {
    try {
      const { getWritingStyle, getCoverLetterSample } = await import('../db/dataStore.js');
      if (!writingStyle) {
        const ws = getWritingStyle();
        writingStyle = ws?.style || 'professional';
      }
      if (!coverLetterSample) {
        const cl = getCoverLetterSample();
        coverLetterSample = cl?.text || null;
      }
    } catch {}
  }

  const styleDesc = STYLE_DESCRIPTORS[writingStyle] || STYLE_DESCRIPTORS.professional;
  const styleLabel = writingStyle ? writingStyle.charAt(0).toUpperCase() + writingStyle.slice(1) : 'Professional';

  const sampleBlock = coverLetterSample
    ? `\nCANDIDATE WRITING SAMPLE (cover letter they previously wrote — mirror their sentence structure, vocabulary choices, and rhythm closely):\n${coverLetterSample.slice(0, 1200)}\n`
    : '';

  const sys = `You are an expert career coach and professional writer. Generate a complete, ready-to-paste application packet for a job seeker. Be specific and tailor everything to the exact job. Never use placeholder brackets like [Your Name] — use the actual candidate info provided.

WRITING STYLE: ${styleLabel} — ${styleDesc}.${coverLetterSample ? ' The candidate has provided a writing sample. Mirror their authentic voice — their sentence length, paragraph rhythm, vocabulary level, and tone — while elevating the content for this specific role.' : ''}`;

  const usr = `Generate a complete application packet for this candidate applying to this job.

JOB: ${job.title} at ${job.company}
LOCATION: ${job.location || 'Not specified'}
URL: ${job.url || 'N/A'}
JD EXCERPT: ${(job.description || '').slice(0, 800)}

CANDIDATE:
Name: ${resume?.name || profile?.name || 'Applicant'}
Email: ${profile?.email || ''}
Target roles: ${(profile?.targetRoles || []).join(', ')}
Summary: ${(resume?.summary || '').slice(0, 400)}
Skills: ${(resume?.skills || []).slice(0, 20).join(', ')}
${sampleBlock}
WRITING STYLE INSTRUCTION: Write the cover letter and all answers in a ${styleLabel} style — ${styleDesc}.${coverLetterSample ? ' Closely mirror the voice and rhythm of the provided writing sample.' : ''}

Return valid JSON only:
{
  "openingPitch": "<2-3 sentence elevator pitch tailored to this specific role and company, in the specified writing style>",
  "coverLetter": "<3 tight paragraphs, specific to role and company, written in the specified style, no placeholder brackets>",
  "answers": [
    {"question": "Why do you want to work here?", "answer": "<company/role-specific answer, 2-3 sentences, in specified style>"},
    {"question": "Tell us about yourself", "answer": "<tailored 2-3 sentence professional pitch in specified style>"},
    {"question": "What is your desired salary?", "answer": "<professional answer with market context>"},
    {"question": "Why are you leaving your current role?", "answer": "<positive, forward-looking answer in specified style>"},
    {"question": "What are your greatest strengths relevant to this role?", "answer": "<3 specific strengths tied to the JD, in specified style>"}
  ],
  "keyKeywords": ["<ats keyword 1>", "<ats keyword 2>", "<ats keyword 3>", "<ats keyword 4>", "<ats keyword 5>"]
}`;

  const text = await callPower(sys, usr, 2200);
  const packet = parseJson(text);
  if (packet) return packet;
  return {
    openingPitch: `I am excited to apply for the ${job.title} position at ${job.company}.`,
    coverLetter: `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${job.title} role at ${job.company}. My background aligns well with this opportunity.\n\nI look forward to discussing how I can contribute to your team.\n\nBest regards,\n${resume?.name || profile?.name || 'Applicant'}`,
    answers: [],
    keyKeywords: [],
  };
}

// ── Application Writer — answer any job application question ──
export async function answerApplicationQuestion(questionsText, writingStyle, customNote, jobContext) {
  const profile = getProfile();
  const resume  = getResume();

  const styleDesc  = STYLE_DESCRIPTORS[writingStyle] || STYLE_DESCRIPTORS.professional;
  const styleLabel = writingStyle
    ? writingStyle.charAt(0).toUpperCase() + writingStyle.slice(1)
    : 'Professional';

  let coverLetterSample = null;
  try {
    const { getCoverLetterSample } = await import('../db/dataStore.js');
    const cl = getCoverLetterSample();
    coverLetterSample = cl?.text || null;
  } catch {}

  const sampleBlock = coverLetterSample
    ? `\nCANDIDATE WRITING SAMPLE — mirror this voice, rhythm, and vocabulary:\n${coverLetterSample.slice(0, 800)}\n`
    : '';

  const sys = `You are an expert career coach writing authentic, tailored answers for job application questions on behalf of a candidate. Write in their voice — specific, honest, and compelling. Never use placeholder brackets. Only use the candidate information provided.

WRITING STYLE: ${styleLabel} — ${styleDesc}.${customNote ? ` Additional style note: ${customNote}` : ''}${coverLetterSample ? ' Mirror the candidate\'s authentic voice from their writing sample.' : ''}`;

  const recentRoles = (resume?.experience || []).slice(0, 3)
    .map(e => `${e.title} at ${e.company} (${e.dates || ''})`)
    .join(', ');

  const jobBlock = (jobContext?.company || jobContext?.jobTitle || jobContext?.jobDescription)
    ? `\nTARGET ROLE:\n${jobContext.company ? `Company: ${jobContext.company}\n` : ''}${jobContext.jobTitle ? `Title: ${jobContext.jobTitle}\n` : ''}${jobContext.jobDescription ? `Job Description:\n${jobContext.jobDescription.slice(0, 1500)}\n` : ''}`
    : '';

  const usr = `Write complete, ready-to-paste answers for each of the following job application questions.
${jobBlock}
CANDIDATE PROFILE:
Name: ${resume?.name || profile?.name || 'Applicant'}
Target Roles: ${(profile?.targetRoles || []).join(', ')}
Industry: ${profile?.primaryIndustry || 'Not specified'}
Summary: ${(resume?.summary || '').slice(0, 400)}
Top Skills: ${(resume?.skills || []).slice(0, 20).join(', ')}
Recent Experience: ${recentRoles}
Education: ${(resume?.education || []).map(e => [e.degree, e.field, e.school].filter(Boolean).join(' in ')).join('; ')}
Certifications: ${(resume?.certifications || []).map(c => c.name).join(', ')}
${sampleBlock}
APPLICATION QUESTIONS:
${questionsText.slice(0, 3000)}

INSTRUCTIONS:
- Answer EVERY question individually
- Short fields (work auth, salary, start date): 1 concise sentence
- Medium fields (why interested, strengths): 2-4 sentences
- Essay fields (tell us about yourself, cover letter paragraph): 2-3 focused paragraphs
- Write in ${styleLabel} style: ${styleDesc}
- Ground every answer in the candidate's real background above — no generic filler
- Never write placeholder brackets like [Your Company] or [specific achievement]

Return ONLY valid JSON:
{"answers":[{"question":"<question text>","answer":"<complete written answer>","wordCount":<number>}]}`;

  const text = await callPower(sys, usr, 2500);
  const json = parseJson(text);
  if (json) return json;
  throw new Error('Could not generate answers — try again or switch AI providers in Settings');
}

// ── Cover Letter Generator ────────────────────────────────────
export async function generateCoverLetter(jobTitle, jobDescription) {
  const profile = getProfile();
  const resume  = getResume();

  let writingStyle = 'professional';
  let coverLetterSample = null;
  try {
    const { getWritingStyle, getCoverLetterSample } = await import('../db/dataStore.js');
    const ws = getWritingStyle();
    writingStyle = ws?.style || 'professional';
    const cl = getCoverLetterSample();
    coverLetterSample = cl?.text || null;
  } catch {}

  const styleDesc  = STYLE_DESCRIPTORS[writingStyle] || STYLE_DESCRIPTORS.professional;
  const styleLabel = writingStyle.charAt(0).toUpperCase() + writingStyle.slice(1);

  const sampleBlock = coverLetterSample
    ? `\nCANDIDATE WRITING SAMPLE (mirror sentence structure, vocabulary, and rhythm):\n${coverLetterSample.slice(0, 1200)}\n`
    : '';

  const recentRoles = (resume?.experience || []).slice(0, 3)
    .map(e => `${e.title} at ${e.company} (${e.dates || ''})`)
    .join(', ');

  const sys = `You are an expert career coach writing a compelling, specific cover letter on behalf of a candidate. Never use placeholder brackets. Write in ${styleLabel} style — ${styleDesc}.${coverLetterSample ? ' Mirror the candidate\'s authentic voice from their writing sample.' : ''}`;

  const usr = `Write a cover letter for this candidate applying to this role.

ROLE: ${jobTitle || 'the position'}
JOB DESCRIPTION:
${(jobDescription || '').slice(0, 1800)}

CANDIDATE:
Name: ${resume?.name || profile?.name || 'Applicant'}
Summary: ${(resume?.summary || '').slice(0, 400)}
Top Skills: ${(resume?.skills || []).slice(0, 20).join(', ')}
Recent Experience: ${recentRoles}
Education: ${(resume?.education || []).map(e => [e.degree, e.field, e.school].filter(Boolean).join(' in ')).join('; ')}
${sampleBlock}
Write exactly 3 tight paragraphs:
1. Opening — why this specific role at this specific company, grounded in details from the JD
2. Evidence — 2-3 concrete achievements from their background that directly match the JD requirements
3. Closing — confident, forward-looking call to action

Start with "Dear Hiring Manager," (or a specific name/title if apparent from the JD). Return ONLY the cover letter text — no JSON, no markdown.`;

  const text = await callPower(sys, usr, 1000);
  if (!text?.trim()) throw new Error('No cover letter generated — try again');
  return { coverLetter: text.trim() };
}

// ── Recommend Similar Jobs ────────────────────────────────────
export async function recommendSimilar(job) {
  const profile = getProfile();
  const resume  = getResume();

  const sys = 'You are a career strategist recommending related job opportunities.';
  const usr = `Suggest 4 similar roles for this candidate. Return JSON only.

CANDIDATE: ${JSON.stringify({ targetRoles: profile.targetRoles, industry: profile.primaryIndustry, skills: resume?.skills?.slice(0, 15) })}
INTERACTED JOB: ${job.title} at ${job.company} (${job.location || 'Remote'})

Return:
{"jobs":[{"title":"","company":"","location":"","score":<3.0-5.0>,"scoreReason":"<one sentence>","verdict":"<Apply|Consider>","source":"recommended"}],"searchTerms":["<term>"]}`;

  const text = await callFast(sys, usr, 1000);
  return parseJson(text) ?? { jobs: [], searchTerms: [] };
}

// ── Salary Band Estimation ────────────────────────────────────
export async function estimateSalaryBand(job) {
  const profile = getProfile();

  const sys = `You are a compensation analyst with deep knowledge of US salary market data.
Sources: BLS OES (bls.gov/oes), Glassdoor Salary, LinkedIn Salary Insights, Levels.fyi, PayScale, Indeed Salary Guide, Salary.com.
Be accurate and conservative. Return percentile-based ranges.`;

  const usr = `Estimate salary bands for this role. Return ONLY valid JSON.

Role: ${job.title}
Company: ${job.company}
Location: ${job.location || 'United States (national)'}
Career level: ${job.careerLevel || 'mid'}
Industry: ${job.archetype || profile.primaryIndustry || 'General'}
${job.salary ? `Posted salary: ${job.salary}` : 'No salary listed.'}

Return:
{"hasPostedSalary":<bool>,"postedSalary":"<string or null>","estimatedBand":{"p25":<int>,"p50":<int>,"p75":<int>,"p90":<int>},"hourlyEquivalent":{"p25":<p25/2080>,"p50":<p50/2080>},"confidenceLevel":"<high|medium|low>","confidenceNote":"<one sentence>","primarySources":["<BLS OES>","<source>"],"sourceContext":"<one sentence>","locationAdjustment":"<e.g. NYC +18% vs national>","totalCompNote":"<bonus/equity note or null>"}`;

  const text = await callFast(sys, usr, 600);
  const json = parseJson(text);
  if (!json) throw new Error('Invalid salary response');
  return json;
}

// ── ATS Score ─────────────────────────────────────────────────
export async function atsScore(resume) {
  const clean = normalizeResume(resume);
  const sys = `You are a senior technical recruiter and ATS-optimization expert. You evaluate the ACTUAL CONTENT and writing quality of a resume — not its data format.

CRITICAL RULES — do NOT flag any of the following (they are normal and correct):
- Date ranges written as "Month YYYY – Present" or "Month YYYY – Month YYYY" (this is the standard human-readable resume format; never demand YYYY-MM-DD).
- A personal email such as firstname@gmail.com or a professional/business email — both are acceptable. Only flag an email if it is actually missing or clearly malformed (no @ or no domain).
- A phone number in any common format ((XXX) XXX-XXXX, XXX-XXX-XXXX, +1 XXX...). Only flag if missing or obviously invalid.
- The fact that data is presented to you as JSON. You are judging the resume, not a database schema. Never reference field names like "startDate".

Focus your issues ONLY on things that genuinely hurt a candidate: missing quantified impact, weak/passive verbs, missing keywords for the target role, overly long bullets, missing sections (summary/skills/experience), inconsistent tense, or unclear job scope.`;

  const usr = `Evaluate this resume for ATS compatibility AND recruiter readability (0-100). Judge the writing and content quality. Return JSON only.

RESUME:
${JSON.stringify(clean, null, 2).slice(0, 2500)}

Return:
{"score":<0-100>,"grade":"<A|B|C|D|F>","issues":[{"severity":"high|medium|low","issue":"<specific content/writing problem>","fix":"<concrete rewrite guidance>"}],"strengths":["<genuine strength>"],"topKeywordsFound":["<keyword actually present>"],"recommendation":"<2-3 sentence overall assessment and top priority>"}

If the resume is already strong, it is correct to return few or zero issues and a high score. Do not invent problems.`;

  const text = await callFast(sys, usr, 1200);
  return parseJson(text) ?? { score: 50, grade: 'C', issues: [], strengths: [], recommendation: 'Unable to analyze ATS compatibility.' };
}

// ── LinkedIn Connection Request ───────────────────────────────
export async function generateLinkedInRequest(job, contactName) {
  const profile = getProfile();
  const resume  = getResume();

  const sys = 'Expert networking coach for professional LinkedIn outreach.';
  const usr = `Write a LinkedIn connection request (300 character max). Include job title, company, why connecting, and a personalized hook.

Candidate: ${profile.name || 'Candidate'}
Target: ${contactName || 'the team'} at ${job.company}
Role: ${job.title}
JD excerpt: ${(job.description || '').slice(0, 400)}
Resume summary: ${(resume?.summary || '').slice(0, 200)}

Return ONLY valid JSON: {"message":"<300 char max connection request>"}`;

  try {
    const text = await callPower(sys, usr, 400);
    return parseJson(text) ?? { message: `Hi, I came across the ${job.title} role at ${job.company} and would love to connect to learn more about the team.` };
  } catch (e) {
    console.error('generateLinkedInRequest error:', e.message);
    return { message: `Hi, I came across the ${job.title} role at ${job.company} and would love to connect to learn more about the team.` };
  }
}

// ── Cold Email ────────────────────────────────────────────────
export async function generateColdEmail(job, contactName, contactRole) {
  const profile = getProfile();
  const resume  = getResume();

  const sys = 'Expert cold outreach specialist. Write professional, concise cold emails that get replies.';
  const usr = `Write a 3-paragraph cold email with subject line. Paragraph 1: hook/connection. Paragraph 2: why this role/company. Paragraph 3: specific ask.

Sender: ${profile.name || 'Candidate'}
Recipient: ${contactName || 'Hiring Manager'}${contactRole ? `, ${contactRole}` : ''} at ${job.company}
Role: ${job.title}
JD excerpt: ${(job.description || '').slice(0, 500)}
Resume summary: ${(resume?.summary || '').slice(0, 300)}

Return ONLY valid JSON: {"subject":"<subject>","body":"<email body>"}`;

  try {
    const text = await callPower(sys, usr, 800);
    return parseJson(text) ?? {
      subject: `Re: ${job.title} at ${job.company}`,
      body: `Dear ${contactName || 'Hiring Team'},\n\nI wanted to reach out about the ${job.title} role at ${job.company}...`
    };
  } catch (e) {
    console.error('generateColdEmail error:', e.message);
    return {
      subject: `Re: ${job.title} at ${job.company}`,
      body: `Dear ${contactName || 'Hiring Team'},\n\nI wanted to reach out about the ${job.title} role at ${job.company}...`
    };
  }
}

// ── Referral Ask ──────────────────────────────────────────────
export async function generateReferralAsk(job, contactName, relationship) {
  const profile = getProfile();
  const resume  = getResume();

  const sys = 'Career coach specializing in warm networking and referral asks.';
  const usr = `Write a professional referral request message. It should feel warm, not transactional. Mention the relationship, why this role fits the candidate, and make a specific ask to refer or intro.

Sender: ${profile.name || 'Candidate'}
Contact: ${contactName}
Relationship: ${relationship || 'professional contact'}
Company: ${job.company}
Role: ${job.title}
JD excerpt: ${(job.description || '').slice(0, 400)}
Resume summary: ${(resume?.summary || '').slice(0, 200)}

Return ONLY valid JSON: {"message":"<referral request message>"}`;

  try {
    const text = await callPower(sys, usr, 600);
    return parseJson(text) ?? { message: `Hi ${contactName}, I hope you're doing well! I came across an opening at ${job.company} for a ${job.title}...` };
  } catch (e) {
    console.error('generateReferralAsk error:', e.message);
    return { message: `Hi ${contactName}, I hope you're doing well! I came across an opening at ${job.company} for a ${job.title}...` };
  }
}

// ── Follow-Up Email ───────────────────────────────────────────
export async function generateFollowUp(job, applicationDate) {
  const profile = getProfile();
  const resume  = getResume();

  const sys = 'Job search coach. Write follow-up emails that are professional and not desperate.';
  const usr = `Write a 7-day follow-up email after applying. Reiterate interest, highlight one key qualification, include a polite CTA.

Candidate: ${profile.name || 'Candidate'}
Role: ${job.title} at ${job.company}
Applied: ${applicationDate || 'recently'}
Resume summary: ${(resume?.summary || '').slice(0, 200)}
Top skills: ${(resume?.skills || []).slice(0, 8).join(', ')}

Return ONLY valid JSON: {"subject":"<subject>","body":"<email body>"}`;

  try {
    const text = await callFast(sys, usr, 500);
    return parseJson(text) ?? {
      subject: `Following Up — ${job.title} Application`,
      body: `Dear Hiring Team,\n\nI wanted to follow up on my application for the ${job.title} role at ${job.company} submitted on ${applicationDate || 'recently'}...`
    };
  } catch (e) {
    console.error('generateFollowUp error:', e.message);
    return {
      subject: `Following Up — ${job.title} Application`,
      body: `Dear Hiring Team,\n\nI wanted to follow up on my application for the ${job.title} role at ${job.company} submitted on ${applicationDate || 'recently'}...`
    };
  }
}

// ── STAR Behavioral Answers ───────────────────────────────────
export async function generateStarAnswers(job, questions) {
  const resume = getResume();

  const sys = 'Interview coach expert in behavioral interviewing and STAR method. Use the candidate\'s actual resume experience.';
  const usr = `Generate a STAR answer for each question using the candidate's real resume experience.

Resume summary: ${resume?.summary || ''}
Recent experience:
${JSON.stringify((resume?.experience || []).slice(0, 3), null, 2).slice(0, 1500)}

Job: ${job.title} at ${job.company}
JD excerpt: ${(job.description || '').slice(0, 400)}

Questions:
${(questions || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}

Return ONLY valid JSON:
{"answers":[{"question":"<q>","situation":"<S>","task":"<T>","action":"<A>","result":"<R>","fullAnswer":"<full STAR paragraph>"}]}`;

  try {
    const text = await callPower(sys, usr, 2000);
    return parseJson(text) ?? { answers: [] };
  } catch (e) {
    console.error('generateStarAnswers error:', e.message);
    return { answers: [] };
  }
}

// ── Company Brief ─────────────────────────────────────────────
export async function generateCompanyBrief(job) {
  const sys = 'Business intelligence analyst creating pre-interview company briefings.';
  const usr = `Create a 1-page "know before you go" interview brief for this company/role. Include: company overview, likely culture signals from the JD, what they're probably trying to solve with this hire, 3 smart questions to ask in the interview, red flags to watch for, and recommended interview angle.

Company: ${job.company}
Role: ${job.title}
Location: ${job.location || 'unknown'}
JD: ${(job.description || '').slice(0, 2000)}

Return ONLY valid JSON:
{"overview":"<company overview>","cultureSignals":["<signal>"],"hiringPurpose":"<what problem this role solves>","smartQuestions":["<q1>","<q2>","<q3>"],"redFlags":["<flag>"],"recommendedAngle":"<interview positioning advice>"}`;

  try {
    const text = await callPower(sys, usr, 1500);
    return parseJson(text) ?? { overview: '', cultureSignals: [], hiringPurpose: '', smartQuestions: [], redFlags: [], recommendedAngle: '' };
  } catch (e) {
    console.error('generateCompanyBrief error:', e.message);
    return { overview: '', cultureSignals: [], hiringPurpose: '', smartQuestions: [], redFlags: [], recommendedAngle: '' };
  }
}

// ── Technical Q&A ─────────────────────────────────────────────
export async function generateTechQA(job) {
  const sys = 'Senior technical interviewer with expertise across domains.';
  const usr = `Generate 6 role-specific interview questions with model answers. Calibrate to the job's domain and career level.

Role: ${job.title} at ${job.company}
Archetype: ${job.archetype || 'General'}
JD excerpt: ${(job.description || '').slice(0, 1500)}

Return ONLY valid JSON:
{"questions":[{"q":"<question>","modelAnswer":"<answer>","difficulty":"easy|medium|hard","type":"behavioral|technical|situational"}]}`;

  try {
    const text = await callPower(sys, usr, 2000);
    return parseJson(text) ?? { questions: [] };
  } catch (e) {
    console.error('generateTechQA error:', e.message);
    return { questions: [] };
  }
}

// ── Mock Answer Evaluator ─────────────────────────────────────
export async function evaluateMockAnswer(job, question, answer) {
  const sys = 'Expert interview coach providing candid, constructive feedback.';
  const usr = `Evaluate the candidate's interview answer. Score 1-10, identify strengths, give 2-3 specific improvements, and rewrite the answer with those improvements applied.

Role: ${job.title} at ${job.company}
Question: ${question}
Candidate's Answer: ${answer}

Return ONLY valid JSON:
{"score":<1-10>,"grade":"A|B|C|D","strengths":["<s>"],"improvements":["<i>"],"rewrittenAnswer":"<improved answer>"}`;

  try {
    const text = await callPower(sys, usr, 1500);
    return parseJson(text) ?? { score: 5, grade: 'C', strengths: [], improvements: ['Add more specifics'], rewrittenAnswer: answer };
  } catch (e) {
    console.error('evaluateMockAnswer error:', e.message);
    return { score: 5, grade: 'C', strengths: [], improvements: ['Add more specifics'], rewrittenAnswer: answer };
  }
}

// ── Skills Gap Analysis ───────────────────────────────────────
export async function analyzeSkillsGap(jobs) {
  const profile = getProfile();
  const resume  = getResume();

  const sys = 'Career development coach analyzing skill gaps across multiple job opportunities.';
  const usr = `Analyze skill gaps across these ${(jobs || []).length} jobs. Identify top 5 recurring gaps, estimate how often each gap appears (as % of jobs), suggest specific upskilling resources (course names, platforms), and compute a "readiness score" as % of roles the candidate currently qualifies for.

Candidate target roles: ${JSON.stringify(profile.targetRoles || [])}
Industry: ${profile.primaryIndustry || 'not specified'}
Resume skills: ${(resume?.skills || []).slice(0, 25).join(', ')}

Jobs:
${JSON.stringify((jobs || []).map(j => ({ title: j.title, company: j.company, verdict: j.verdict, score: j.score, scoreReason: j.scoreReason, description: (j.description || '').slice(0, 200) })), null, 2).slice(0, 3000)}

Return ONLY valid JSON:
{"topGaps":[{"skill":"<skill>","frequency":"<68%>","urgency":"high|medium|low","resources":[{"name":"<course name>","platform":"<platform>","duration":"<est. time>"}]}],"readinessScore":<0-100>,"readinessByLevel":[{"level":"<level>","pct":<n>}],"summary":"<paragraph>"}`;

  try {
    const text = await callPower(sys, usr, 1500);
    return parseJson(text) ?? { topGaps: [], readinessScore: 50, readinessByLevel: [], summary: 'Insufficient data' };
  } catch (e) {
    console.error('analyzeSkillsGap error:', e.message);
    return { topGaps: [], readinessScore: 50, readinessByLevel: [], summary: 'Insufficient data' };
  }
}

// ── Company Intel ─────────────────────────────────────────────
export async function generateCompanyIntel(job) {
  const sys = 'Business intelligence analyst. You synthesize company intelligence from job description signals, industry knowledge, and publicly available information.';
  const usr = `Generate a structured company intelligence brief based on the job description and your knowledge of this company/industry. Include funding stage inference, culture signals, headcount trajectory guess, typical interview process for this company type, and what problem this role likely solves.

Company: ${job.company}
Role: ${job.title}
Location: ${job.location || 'unknown'}
JD: ${(job.description || '').slice(0, 2000)}

Return ONLY valid JSON:
{"fundingStage":"<inference>","cultureSignals":["<signal>"],"headcountTrend":"growing|stable|uncertain","hiringPurpose":"<what problem this role solves>","interviewProcess":{"stages":["<stage>"],"typicalDuration":"<e.g. 2-3 weeks>","difficulty":"low|medium|high"},"redFlags":["<flag>"],"greenFlags":["<flag>"],"glassdoorContext":"<what reviews/context likely say about this company type>"}`;

  try {
    const text = await callPower(sys, usr, 1200);
    return parseJson(text) ?? {
      fundingStage: 'Unknown',
      cultureSignals: [],
      headcountTrend: 'uncertain',
      hiringPurpose: `Intelligence based on job description signals only for ${job.company}.`,
      interviewProcess: { stages: [], typicalDuration: 'Unknown', difficulty: 'medium' },
      redFlags: [],
      greenFlags: [],
      glassdoorContext: `Intelligence based on job description signals only for ${job.company}.`
    };
  } catch (e) {
    console.error('generateCompanyIntel error:', e.message);
    return {
      fundingStage: 'Unknown',
      cultureSignals: [],
      headcountTrend: 'uncertain',
      hiringPurpose: `Intelligence based on job description signals only for ${job.company}.`,
      interviewProcess: { stages: [], typicalDuration: 'Unknown', difficulty: 'medium' },
      redFlags: [],
      greenFlags: [],
      glassdoorContext: `Intelligence based on job description signals only for ${job.company}.`
    };
  }
}

// ── Offer Analysis ────────────────────────────────────────────
export async function analyzeOffer(offer, job) {
  const profile = getProfile();

  const sys = 'Compensation expert and career advisor. Analyze job offers with deep market knowledge.';
  const usr = `Analyze this job offer. Compute total comp estimate, market percentile, assess each component (base, equity, bonus, benefits), and provide an overall recommendation.

Offer:
${JSON.stringify(offer, null, 2)}

Role: ${job?.title || offer.role || 'N/A'}
Candidate target: $${profile.salaryMin}–$${profile.salaryMax} ${profile.currency || 'USD'}
Location: ${offer.location || job?.location || 'US'}

Return ONLY valid JSON:
{"totalComp":{"low":<n>,"mid":<n>,"high":<n>},"basePercentile":"<e.g. 65th>","components":[{"name":"<base|equity|bonus|benefits>","value":"<string>","assessment":"above|market|below","note":"<note>"}],"overallVerdict":"strong|fair|weak","recommendation":"<paragraph>","negotiabilityScore":"<1-10>"}`;

  try {
    const text = await callPower(sys, usr, 1000);
    return parseJson(text) ?? { totalComp: { low: 0, mid: 0, high: 0 }, basePercentile: 'unknown', components: [], overallVerdict: 'fair', recommendation: 'Unable to analyze.', negotiabilityScore: '5' };
  } catch (e) {
    console.error('analyzeOffer error:', e.message);
    return { totalComp: { low: 0, mid: 0, high: 0 }, basePercentile: 'unknown', components: [], overallVerdict: 'fair', recommendation: 'Unable to analyze.', negotiabilityScore: '5' };
  }
}

// ── Negotiation Script ────────────────────────────────────────
export async function generateNegotiationScript(offer, job, targetComp) {
  const sys = 'Executive compensation negotiation specialist.';
  const usr = `Generate 3 ranked negotiation asks with specific scripts. The candidate's target comp is ${targetComp || 'unspecified'}. Be assertive but professional.

Offer:
${JSON.stringify(offer, null, 2)}

Role: ${job?.title || offer.role || 'N/A'} at ${offer.company || job?.company || 'the company'}

Return ONLY valid JSON:
{"asks":[{"rank":<1-3>,"ask":"<what to ask for>","rationale":"<why>","script":"<exact words to say>","expectedOutcome":"<realistic outcome>"}],"openingScript":"<how to open the negotiation call>","closingLine":"<closing statement>","totalImpact":"<estimated $ impact across all asks>"}`;

  try {
    const text = await callPower(sys, usr, 1500);
    return parseJson(text) ?? { asks: [], openingScript: '', closingLine: '', totalImpact: '' };
  } catch (e) {
    console.error('generateNegotiationScript error:', e.message);
    return { asks: [], openingScript: '', closingLine: '', totalImpact: '' };
  }
}

// ── Blind Spot Detection ──────────────────────────────────────
export async function detectBlindSpots(applications) {
  const FALLBACK = { insights: [], overallHealthScore: 50, topRecommendation: 'Add more application data to unlock insights.' };

  if (!applications || applications.length < 5) {
    return { ...FALLBACK, topRecommendation: `Add at least ${5 - (applications?.length || 0)} more applications to unlock blind spot analysis.` };
  }

  const sys = 'Behavioral analytics expert spotting career search patterns.';
  const usr = `Analyze these job applications for hidden patterns and blind spots. Look for: response rate by company size signal (startup/enterprise based on company name), response rate by seniority level, response rate by archetype/industry, score distribution (are they applying to too many low-fit roles?), and timing patterns.

Applications (${applications.length} total):
${JSON.stringify(applications.map(a => ({ company: a.company, role: a.role, status: a.status, score: a.score, verdict: a.verdict, archetype: a.archetype, dateAdded: a.dateAdded })), null, 2).slice(0, 3000)}

Return ONLY valid JSON:
{"insights":[{"pattern":"<pattern name>","finding":"<what the data shows>","recommendation":"<actionable fix>","severity":"high|medium|low"}],"overallHealthScore":<0-100>,"topRecommendation":"<single most important action>"}`;

  try {
    const text = await callPower(sys, usr, 1200);
    return parseJson(text) ?? FALLBACK;
  } catch (e) {
    console.error('detectBlindSpots error:', e.message);
    return FALLBACK;
  }
}

// ── 4-Persona Resume Chain ───────────────────────────────────
// Each persona is a standalone AI call; they share jdText + resumeJson.

export async function diagnoserAudit(resumeJson, jdText) {
  const sys = `You are a strict ATS filter engine. You scan resumes exactly the way applicant tracking systems do — looking for red flags, vague language, and missing requirements that cause automatic rejection before a human ever reads the document.

IMPORTANT: The candidate uploaded their resume as a PDF/DOCX file; below is the extracted TEXT CONTENT. You are auditing the CONTENT ONLY. NEVER comment on file format, JSON, data structure, or how the resume is stored — those are artifacts of extraction, not properties of the candidate's document.`;
  const usr = `Perform a rigorous ATS audit on this resume's content against the job description. Flag every content issue that would cause rejection. Be specific, not generic.

Resume (extracted text from the candidate's uploaded document):
${resumeToText(resumeJson).slice(0, 2500)}

Job Description:
${(jdText || '').slice(0, 2000)}

Return ONLY valid JSON:
{
  "overallRisk": "high|medium|low",
  "formattingIssues": [{"issue":"<desc>","fix":"<exact change>","severity":"high|medium|low"}],
  "contentIssues": [{"issue":"<desc>","fix":"<exact change>","severity":"high|medium|low"}],
  "vagueLanguage": [{"original":"<vague phrase>","suggestedReplacement":"<specific version>"}],
  "missingRequirements": ["<requirement from JD not addressed>"],
  "passedChecks": ["<thing that is already correct>"],
  "summary": "<2-3 sentence overall diagnosis>"
}`;

  try {
    const text = await callPower(sys, usr, 2500);
    const parsed = parseJson(text);
    if (!parsed) console.error('diagnoserAudit: parseJson returned null. Raw:', text?.slice(0, 200));
    return parsed ?? { overallRisk: 'medium', formattingIssues: [], contentIssues: [], vagueLanguage: [], missingRequirements: [], passedChecks: [], summary: 'Audit failed to parse — try again or check AI provider connection.' };
  } catch (e) {
    console.error('diagnoserAudit error:', e.message);
    return { overallRisk: 'medium', formattingIssues: [], contentIssues: [], vagueLanguage: [], missingRequirements: [], passedChecks: [], summary: e.message };
  }
}

export async function recruiterGapAnalysis(resumeJson, jdText) {
  const sys = `You are a senior recruiter who reviews hundreds of resumes per week. You know exactly what the top 10% of applicants have that the rest don't. You give brutally honest match scores and identify the specific gaps that will eliminate a candidate in the first 10 seconds of screening.`;
  const usr = `You are a senior recruiter who screens hundreds of resumes per week. Analyze this candidate's resume against the job description with brutal honesty. Give a detailed match analysis — not surface-level. Point out specific gaps, exact missing keywords, and concrete red flags a recruiter would spot in the first 10 seconds.

Resume (extracted text from the candidate's uploaded PDF/DOCX — judge content only, never storage format):
${resumeToText(resumeJson).slice(0, 2500)}

Job Description:
${(jdText || '').slice(0, 2000)}

Provide substantive, specific written analysis in every text field — this is the most important output. Return ONLY valid JSON:
{
  "matchScore": 0,
  "matchGrade": "A|B|C|D|F",
  "scoreSummary": "3-4 sentences explaining the score: what matches, what's missing, and the recruiter's gut reaction when seeing this resume",
  "experienceGapAnalysis": "specific analysis of how this candidate's experience aligns or falls short of the years/seniority required",
  "skillGapAnalysis": "detailed breakdown of which required skills are present, partially present, or entirely missing",
  "topMissingKeywords": [{"keyword":"exact term from JD","context":"which section it should appear in","priority":"must-have|nice-to-have"}],
  "recruiterRedFlags": [{"flag":"specific issue a recruiter notices — concrete, not vague","impact":"eliminates|hurts|minor"}],
  "recruiterGreenFlags": ["specific strength that jumps off the page"],
  "competitiveAdvantage": "honest assessment: what makes this candidate stand out vs. the applicant pool — or why they'd be passed over",
  "recommendation": "strong-apply|apply|revise-first|do-not-apply",
  "phoneScreenQuestions": [{"question":"phone screen question","purpose":"what it tests","idealAnswer":"what to say"}]
}
Include 5-6 phoneScreenQuestions. Keep each idealAnswer to one sentence so the full JSON is returned complete.`;

  try {
    const text = await callPower(sys, usr, 6000);
    const parsed = parseJson(text);
    // Only fall back if we truly got nothing usable; a partial salvage with a real score is fine.
    if (parsed && (parsed.scoreSummary || parsed.matchScore != null)) return parsed;
    return { matchScore: 50, matchGrade: 'C', scoreSummary: 'The recruiter analysis could not be generated in full. Please re-run this step.', experienceGapAnalysis: '', skillGapAnalysis: '', topMissingKeywords: [], recruiterRedFlags: [], recruiterGreenFlags: [], competitiveAdvantage: '', recommendation: 'revise-first', phoneScreenQuestions: [] };
  } catch (e) {
    console.error('recruiterGapAnalysis error:', e.message);
    return { matchScore: 50, matchGrade: 'C', scoreSummary: `Recruiter analysis failed: ${e.message}`, experienceGapAnalysis: '', skillGapAnalysis: '', topMissingKeywords: [], recruiterRedFlags: [], recruiterGreenFlags: [], competitiveAdvantage: '', recommendation: 'revise-first', phoneScreenQuestions: [] };
  }
}

export async function rewriterXYZ(resumeJson, jdText, missingKeywords) {
  const sys = `You are an elite resume writer specializing in the Google XYZ achievement formula: "Accomplished [X] as measured by [Y] by doing [Z]." You rewrite bland bullet points into high-impact, quantified achievements that naturally incorporate missing keywords without keyword-stuffing.`;
  const usr = `Rewrite the work experience bullet points from this resume. Use the Google XYZ formula wherever possible. Naturally integrate the missing keywords listed below. Make every bullet punchy, action-oriented, and specific to the target role.

Resume experience (ALL roles):
${JSON.stringify((resumeJson?.experience || []), null, 2).slice(0, 3500)}

Target role context (from JD):
${(jdText || '').slice(0, 1000)}

Missing keywords to integrate naturally:
${(missingKeywords || []).map(k => `- ${typeof k === 'string' ? k : k.keyword}`).join('\n')}

Rules:
- Keep the same role/company/date structure — only rewrite bullets
- Each bullet must start with a strong action verb
- Use XYZ format where possible: "Accomplished X as measured by Y by doing Z"
- Add quantification (%, $, time saved, team size) where it fits the context
- Do NOT invent metrics that can't be plausible — use estimates like "~20%" if exact numbers are unknown

Return ONLY valid JSON:
{
  "rewrittenExperience": [
    {
      "title": "<job title>",
      "company": "<company>",
      "dates": "<dates>",
      "originalBullets": ["<original>"],
      "rewrittenBullets": ["<XYZ rewritten>"],
      "keywordsIntegrated": ["<keyword>"]
    }
  ],
  "summary": "<rewritten professional summary that integrates target role keywords>"
}`;

  try {
    const text = await callPower(sys, usr, 6000);
    return parseJson(text) ?? { rewrittenExperience: [], summary: '' };
  } catch (e) {
    console.error('rewriterXYZ error:', e.message);
    return { rewrittenExperience: [], summary: e.message };
  }
}

export async function hiringManagerInterview(resumeJson, jdText) {
  const sys = `You are the Hiring Manager for this role. You have read the candidate's resume and the job description. You are about to conduct a thorough first-round interview. You ask the 20 most critical, role-specific questions — a mix of technical, behavioral, situational, case, and leadership questions — that will separate the top 10% of candidates from the rest. You grade answers harshly but fairly. Every question must be specific to THIS role and THIS candidate's background, not generic.`;
  const usr = `Based on this candidate's resume and the job description, generate exactly 20 interview questions. Cover: behavioral (4), situational (4), technical/functional (5), case/problem-solving (4), culture/motivation/leadership (3). For EVERY question include what a strong answer looks like AND what a weak/rejected answer looks like.

Resume summary: ${resumeJson?.summary || ''}
Key skills: ${(resumeJson?.skills || []).slice(0, 15).join(', ')}
Recent role: ${resumeJson?.experience?.[0]?.title || ''} at ${resumeJson?.experience?.[0]?.company || ''}

Job: ${jdText?.slice(0, 1500) || ''}

IMPORTANT: Keep strongAnswer and weakAnswer to ONE tight sentence each, and followUp to one short sentence, so all 20 questions fit in a single complete JSON response. Do not omit any of the 20 questions.

Return ONLY valid JSON:
{
  "questions": [
    {
      "number": 1,
      "question": "the interview question — specific to this role, not generic",
      "type": "technical|behavioral|situational|case|leadership",
      "difficulty": "hard|very-hard",
      "whatTheyAreTesting": "the specific competency or red flag being probed (one phrase)",
      "strongAnswer": "one sentence: what a top-10% answer looks like",
      "weakAnswer": "one sentence: what an average or rejected answer looks like",
      "followUp": "one short follow-up question"
    }
  ],
  "interviewerTone": "how this hiring manager conducts interviews — their style and priorities",
  "eliminationCriteria": "exactly what would cause an immediate no-hire decision for this role"
}`;

  try {
    // 6000 fits within every provider's completion clamp AND free-tier TPM
    // windows — the old 12000 ask made the governor hold Persona 4 in the
    // token queue long enough to look like an infinite spinner.
    const text = await callPower(sys, usr, 6000);
    const parsed = parseJson(text);
    if (parsed && Array.isArray(parsed.questions) && parsed.questions.length) return parsed;
    return { questions: [], interviewerTone: '', eliminationCriteria: '', _error: 'The interview questions could not be generated in full. Please re-run this step.' };
  } catch (e) {
    console.error('hiringManagerInterview error:', e.message);
    return { questions: [], interviewerTone: '', eliminationCriteria: '', _error: `Hiring Manager step failed: ${e.message}` };
  }
}

// ── Outreach for Contact ──────────────────────────────────────
export async function generateOutreachForContact(contact, job, type) {
  const profile = getProfile();
  const resume  = getResume();

  const formatInstructions = type === 'email'
    ? 'Return ONLY valid JSON: {"subject":"<subject>","body":"<email body>"}'
    : 'Return ONLY valid JSON: {"message":"<outreach message>"}';

  const sys = 'Networking expert drafting personalized outreach.';
  const usr = `Generate ${type} outreach for this contact.${job ? ` Reference the ${job.title} role at ${job.company}.` : ''}

Contact: ${contact.name || 'Contact'}${contact.role ? `, ${contact.role}` : ''}${contact.company ? ` at ${contact.company}` : ''}
Outreach type: ${type}
Sender: ${profile.name || 'Candidate'}
Resume summary: ${(resume?.summary || '').slice(0, 200)}
${job ? `Job description excerpt: ${(job.description || '').slice(0, 300)}` : ''}

${formatInstructions}`;

  try {
    const text = await callPower(sys, usr, 600);
    return parseJson(text) ?? (type === 'email' ? { subject: '', body: '' } : { message: '' });
  } catch (e) {
    console.error('generateOutreachForContact error:', e.message);
    return type === 'email' ? { subject: '', body: '' } : { message: '' };
  }
}
