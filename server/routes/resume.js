import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
import {
  getResume, saveResume, deleteResume,
  getCoverLetterSample, saveCoverLetterSample, deleteCoverLetterSample,
  getWritingStyle, saveWritingStyle,
} from '../db/dataStore.js';
import { buildResumeDocx, buildCoverLetterDocx } from '../services/docxExport.js';
import { parseResumeText, atsScore, generateCV, generateCoverLetter, diagnoserAudit, recruiterGapAnalysis, rewriterXYZ, hiringManagerInterview } from '../services/claude.js';

const router  = Router();
const storage = multer.memoryStorage();
const upload  = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Regex-based fallback parser — no AI required. Used when the AI provider
// is not configured or is unreachable so file uploads always succeed.
function basicParseResume(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const emailMatch = text.match(/[\w.+%-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);

  // Heuristic: first short line that looks like a person name (no @, no digits,
  // not a known section header, not a URL, title-ish capitalisation).
  const SECTION_HEADERS = /^(skills?|experience|education|summary|objective|work history|employment|certifications?|projects?|awards?|publications?|references?|contact|profile|about)\b/i;
  const name = lines.find(l =>
    !l.match(/[@\d(+\/\\]/) &&
    l.length > 2 && l.length < 60 &&
    !SECTION_HEADERS.test(l) &&
    !l.startsWith('http')
  ) || '';

  // Extract skills: lines after a "Skills" header or comma-separated terms
  const skillsIdx = lines.findIndex(l => /^skills?/i.test(l));
  const rawSkills = skillsIdx >= 0 ? lines.slice(skillsIdx + 1, skillsIdx + 4).join(', ') : '';
  const skills = rawSkills
    .split(/[,|•·\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 50)
    .slice(0, 25);

  return {
    name,
    email:    emailMatch?.[0]  || '',
    phone:    phoneMatch?.[0]  || '',
    location: '',
    linkedin: linkedinMatch?.[0] || '',
    summary:  '',
    skills,
    experience:     [],
    education:      [],
    certifications: [],
    rawText:  text.slice(0, 300),
    styleMetadata: { format: 'unknown', sectionOrder: [], bulletStyle: 'unknown', headerStyle: 'unknown', dateFormat: 'unknown', tone: 'unknown', notes: 'Parsed without AI — re-upload after configuring your AI provider for full extraction.' },
    _aiParsed: false,
  };
}

// Extract text bytes from an uploaded file buffer. Throws on unrecognised type.
async function extractTextFromBuffer({ mimetype, buffer, originalname }) {
  const ext = (originalname || '').split('.').pop().toLowerCase();
  if (mimetype === 'application/pdf' || ext === 'pdf') {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    return (await pdfParse(buffer)).text;
  }
  if (
    mimetype.includes('word') ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx' || ext === 'doc'
  ) {
    const mammoth = await import('mammoth');
    return (await mammoth.extractRawText({ buffer })).value;
  }
  if (mimetype.startsWith('text/') || ext === 'txt') {
    return buffer.toString('utf8');
  }
  throw Object.assign(new Error(`Unsupported file type: "${mimetype}". Upload a PDF, DOCX, or TXT file.`), { status: 400 });
}

router.get('/', (req, res) => res.json(getResume()));

// Upload PDF, DOCX, or TXT — field name must be 'resume' (matches frontend FormData).
// AI parsing is attempted but the upload always succeeds if the file is readable:
// on AI failure a regex-parsed fallback is saved with _aiParsed:false so the
// user can re-run AI parse later from the Resume view without re-uploading.
router.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file received. Make sure you selected a PDF, DOCX, or TXT file.' });

    let text;
    try {
      text = await extractTextFromBuffer(req.file);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    if (!text.trim()) return res.status(400).json({ error: 'File appears to be empty or unreadable. Try pasting the text directly.' });

    // Persist the ORIGINAL file so ATS upload fields can receive the real PDF/DOCX.
    try {
      const ext = path.extname(req.file.originalname || '').toLowerCase() || '.pdf';
      const dataDir = path.join(ROOT, 'data');
      // Clear any previous original (extension may differ)
      for (const f of fs.readdirSync(dataDir)) {
        if (f.startsWith('resume-original')) fs.unlinkSync(path.join(dataDir, f));
      }
      fs.writeFileSync(path.join(dataDir, `resume-original${ext}`), req.file.buffer);
    } catch (persistErr) {
      console.warn('Could not persist original resume file:', persistErr.message);
    }

    let parsed;
    let warning = null;
    try {
      parsed = await parseResumeText(text);
      parsed._aiParsed = true;
    } catch (aiErr) {
      parsed = basicParseResume(text);
      warning = `File uploaded and text extracted successfully, but AI parsing failed (${aiErr.message}). Configure your AI provider in Settings to get full field extraction. Basic information has been saved.`;
    }

    saveResume({ ...parsed, uploadedAt: new Date().toISOString() });
    res.json({ ...parsed, ...(warning ? { warning } : {}) });
  } catch (e) {
    res.status(500).json({ error: `Upload failed: ${e.message}` });
  }
});

// Paste plain text — same AI-optional pattern as /upload
router.post('/paste', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

    let parsed;
    let warning = null;
    try {
      parsed = await parseResumeText(text);
      parsed._aiParsed = true;
    } catch (aiErr) {
      parsed = basicParseResume(text);
      warning = `Text saved, but AI parsing failed (${aiErr.message}). Configure your AI provider in Settings to get full field extraction.`;
    }

    saveResume({ ...parsed, uploadedAt: new Date().toISOString() });
    res.json({ ...parsed, ...(warning ? { warning } : {}) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ATS check
router.post('/ats-check', async (req, res) => {
  try {
    const resume = req.body.resume || getResume();
    if (!resume) return res.status(400).json({ error: 'No resume found' });
    const result = await atsScore(resume);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update resume fields manually
router.patch('/', (req, res) => {
  const current = getResume() || {};
  const updated = { ...current, ...req.body };
  saveResume(updated);
  res.json(updated);
});

// Generate CV for a specific role
router.post('/generate-cv', async (req, res) => {
  try {
    const { job } = req.body;
    const resume  = getResume();
    if (!resume) return res.status(400).json({ error: 'No resume uploaded yet.' });
    const result = await generateCV(job, resume);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/generate-cover-letter', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: 'Job description required' });
    const result = await generateCoverLetter(title || '', description.trim());
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Export resume or CV as plain text file
router.get('/export-doc', (req, res) => {
  try {
    const resume = getResume();
    if (!resume) return res.status(404).json({ error: 'No resume found' });
    const format = req.query.format || 'txt';
    const filename = format === 'cv' ? 'cv.txt' : 'resume.txt';

    const lines = [
      resume.name || 'Resume',
      resume.email || '',
      resume.phone || '',
      resume.location || '',
      '',
      '── SUMMARY ──',
      resume.summary || '',
      '',
      '── EXPERIENCE ──',
      ...(resume.experience || []).flatMap(e => [
        `${e.title} at ${e.company} (${e.dates || ''})`,
        ...(e.bullets || []).map(b => `  • ${b}`),
        '',
      ]),
      '── SKILLS ──',
      (resume.skills || []).join(', '),
      '',
      '── EDUCATION ──',
      ...(resume.education || []).map(e => `${e.degree} — ${e.school} (${e.year || ''})`),
    ];

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(lines.join('\n'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 4-Persona Resume Chain ───────────────────────────────────

router.post('/chain/diagnoser', async (req, res) => {
  try {
    const resume = req.body.resume || getResume();
    if (!resume) return res.status(400).json({ error: 'No resume found. Upload your resume first.' });
    const result = await diagnoserAudit(resume, req.body.jd || '');
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chain/recruiter', async (req, res) => {
  try {
    const resume = req.body.resume || getResume();
    if (!resume) return res.status(400).json({ error: 'No resume found. Upload your resume first.' });
    if (!req.body.jd?.trim()) return res.status(400).json({ error: 'Paste a job description to run the recruiter analysis.' });
    const result = await recruiterGapAnalysis(resume, req.body.jd);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chain/rewriter', async (req, res) => {
  try {
    const resume = req.body.resume || getResume();
    if (!resume) return res.status(400).json({ error: 'No resume found. Upload your resume first.' });
    const result = await rewriterXYZ(resume, req.body.jd || '', req.body.missingKeywords || []);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chain/hiring-manager', async (req, res) => {
  try {
    const resume = req.body.resume || getResume();
    if (!resume) return res.status(400).json({ error: 'No resume found. Upload your resume first.' });
    const result = await hiringManagerInterview(resume, req.body.jd || '');
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Clear resume ─────────────────────────────────────────────
router.delete('/', (req, res) => {
  try { deleteResume(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Export resume as PDF (styled print page) ─────────────────
router.get('/export/pdf', (req, res) => {
  const r = getResume();
  if (!r) return res.status(404).send('<p>No resume found.</p>');
  const e = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const expHtml = (r.experience || []).map(ex => `
    <div class="job">
      <div class="job-title">${e(ex.title)} <span class="at">at</span> ${e(ex.company)}</div>
      <div class="job-dates">${e(ex.dates || '')}</div>
      ${(ex.bullets || []).map(b => `<div class="bullet">• ${e(b)}</div>`).join('')}
    </div>`).join('');
  const eduHtml = (r.education || []).map(ed =>
    `<div class="edu">${e(ed.degree)} — ${e(ed.school)} (${e(ed.year || '')})</div>`).join('');
  const skillHtml = (r.skills || []).map(s => `<span class="skill">${e(s)}</span>`).join('');
  const certHtml  = (r.certifications || []).length
    ? `<section><h2>Certifications</h2>${(r.certifications).map(c=>typeof c==='string'?`<div>${e(c)}</div>`:`<div>${e(c.name||'')}${c.issuer?` — ${e(c.issuer)}`:''}</div>`).join('')}</section>` : '';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${e(r.name)} — Resume</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Georgia', serif; font-size: 11pt; color: #111; background: #fff; padding: 32px 40px; max-width: 800px; margin: auto; }
  h1 { font-size: 20pt; font-weight: 700; letter-spacing: -.3px; }
  .contact { font-size: 9.5pt; color: #444; margin: 4px 0 18px; }
  .contact a { color: #444; }
  h2 { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #555; border-bottom: 1px solid #ccc; margin: 18px 0 8px; padding-bottom: 3px; }
  .summary { font-size: 10.5pt; line-height: 1.6; margin-bottom: 6px; }
  .job { margin-bottom: 12px; }
  .job-title { font-size: 11pt; font-weight: 700; }
  .at { font-weight: 400; color: #555; }
  .job-dates { font-size: 9.5pt; color: #666; margin: 2px 0 4px; }
  .bullet { font-size: 10.5pt; line-height: 1.55; padding-left: 8px; margin-bottom: 2px; }
  .edu { font-size: 10.5pt; margin-bottom: 4px; }
  .skill { display: inline-block; font-size: 9.5pt; background: #f0f0f0; border-radius: 3px; padding: 2px 7px; margin: 2px 3px 2px 0; }
  .export-bar { text-align: center; margin-bottom: 20px; padding: 10px; background: #f8f8f8; border-radius: 6px; font-family: sans-serif; font-size: 10pt; }
  .export-bar button { font-size: 10pt; padding: 6px 18px; background: #111; color: #fff; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px; }
  @media print { .export-bar { display: none; } body { padding: 0; } }
</style>
</head><body>
<div class="export-bar">Ready to save as PDF → <button onclick="window.print()">Save as PDF</button></div>
<h1>${e(r.name)}</h1>
<div class="contact">
  ${[r.email, r.phone, r.location, r.linkedin].filter(Boolean).map(e).join(' &nbsp;·&nbsp; ')}
</div>
${r.summary ? `<section><h2>Summary</h2><div class="summary">${e(r.summary)}</div></section>` : ''}
${(r.experience||[]).length ? `<section><h2>Experience</h2>${expHtml}</section>` : ''}
${skillHtml ? `<section><h2>Skills</h2><div style="margin-top:4px">${skillHtml}</div></section>` : ''}
${eduHtml ? `<section><h2>Education</h2>${eduHtml}</section>` : ''}
${certHtml}
</body></html>`);
});

// ── Export resume as DOCX ─────────────────────────────────────
router.get('/export/docx', async (req, res) => {
  const r = getResume();
  if (!r) return res.status(404).json({ error: 'No resume found.' });
  try {
    const buf = await buildResumeDocx(r);
    const name = (r.name || 'resume').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${name}_resume.docx"`);
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Cover Letter Sample ──────────────────────────────────────
router.get('/cover-letter', (req, res) => {
  const cl = getCoverLetterSample();
  res.json(cl || { text: '', uploadedAt: null });
});

router.post('/cover-letter/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file received. Select a PDF, DOCX, or TXT file.' });

    let text = '';
    const { mimetype, buffer, originalname } = req.file;
    const ext = (originalname || '').split('.').pop().toLowerCase();

    if (mimetype === 'application/pdf' || ext === 'pdf') {
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      text = (await pdfParse(buffer)).text;
    } else if (
      mimetype.includes('word') ||
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx' || ext === 'doc'
    ) {
      const mammoth = await import('mammoth');
      text = (await mammoth.extractRawText({ buffer })).value;
    } else {
      text = buffer.toString('utf8');
    }

    if (!text.trim()) return res.status(400).json({ error: 'File appears to be empty or unreadable. Try pasting the text instead.' });

    const sample = { text: text.trim(), uploadedAt: new Date().toISOString() };
    saveCoverLetterSample(sample);
    res.json(sample);
  } catch (e) { res.status(500).json({ error: `Upload failed: ${e.message}` }); }
});

router.post('/cover-letter/paste', (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });
    const sample = { text: text.trim(), uploadedAt: new Date().toISOString() };
    saveCoverLetterSample(sample);
    res.json(sample);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/cover-letter', (req, res) => {
  try { deleteCoverLetterSample(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Cover letter export: PDF ──────────────────────────────────
router.get('/cover-letter/export/pdf', (req, res) => {
  const cl = getCoverLetterSample();
  if (!cl?.text?.trim()) return res.status(404).send('<p>No cover letter found.</p>');
  const e = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const bodyHtml = e(cl.text).replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cover Letter</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Georgia', serif; font-size: 11pt; color: #111; background: #fff; padding: 32px 40px; max-width: 720px; margin: auto; line-height: 1.65; }
  p { margin-bottom: 14px; }
  .export-bar { text-align: center; margin-bottom: 24px; padding: 10px; background: #f8f8f8; border-radius: 6px; font-family: sans-serif; font-size: 10pt; }
  .export-bar button { font-size: 10pt; padding: 6px 18px; background: #111; color: #fff; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px; }
  @media print { .export-bar { display: none; } }
</style></head><body>
<div class="export-bar">Ready to save as PDF → <button onclick="window.print()">Save as PDF</button></div>
<p>${bodyHtml}</p>
</body></html>`);
});

// ── Cover letter export: DOCX ─────────────────────────────────
router.get('/cover-letter/export/docx', async (req, res) => {
  const cl = getCoverLetterSample();
  if (!cl?.text?.trim()) return res.status(404).json({ error: 'No cover letter found.' });
  try {
    const buf = await buildCoverLetterDocx(cl.text);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="cover_letter.docx"');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Writing Style ─────────────────────────────────────────────
router.get('/writing-style', (req, res) => res.json(getWritingStyle()));

router.post('/writing-style', (req, res) => {
  try {
    const { style, customNote } = req.body;
    const data = { style: style || 'professional', customNote: customNote || '' };
    saveWritingStyle(data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Cover letter upload: also use extractTextFromBuffer ──────
// (already uses the correct field name 'file' and has null guard above)
// Re-parse CL upload to use the shared helper for consistency
// (the route above handles it inline — no change needed there)

// ── Multer error handler ──────────────────────────────────────
// Must be a 4-argument middleware to be treated as an error handler by Express.
// Without this, MulterError (e.g. wrong field name) leaks an HTML stack trace.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum upload size is 10 MB.' });
  }
  if (err?.name === 'MulterError' || err?.code?.startsWith?.('LIMIT_')) {
    return res.status(400).json({ error: `Upload error: ${err.message}. Make sure you are uploading to the correct field.` });
  }
  // Pass non-multer errors to the next handler
  next(err);
});

export default router;
