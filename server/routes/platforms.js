import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getAllStatuses,
  getSessionStatus,
  startConnect,
  clearSession,
  syncProfile,
  PLATFORMS,
} from '../services/platformSessions.js';

const router = express.Router();
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// GET /api/platforms/status — status of all platforms
router.get('/status', (req, res) => {
  try {
    res.json({ ok: true, platforms: getAllStatuses() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/platforms/:name/connect — open headed browser, user logs in
router.post('/:name/connect', async (req, res) => {
  const { name } = req.params;
  if (!PLATFORMS[name]) return res.status(400).json({ ok: false, error: `Unknown platform: ${name}` });
  try {
    const result = await startConnect(name);
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// DELETE /api/platforms/:name — disconnect / clear session
router.delete('/:name', (req, res) => {
  const { name } = req.params;
  if (!PLATFORMS[name]) return res.status(400).json({ ok: false, error: `Unknown platform: ${name}` });
  clearSession(name);
  res.json({ ok: true, msg: `${name} session cleared.` });
});

// POST /api/platforms/:name/sync — sync profile from platform
// Body: { profileUrl?: string } — optional explicit profile URL (e.g. linkedin.com/in/username)
router.post('/:name/sync', async (req, res) => {
  const { name } = req.params;
  if (!PLATFORMS[name]) return res.status(400).json({ ok: false, error: `Unknown platform: ${name}` });
  try {
    const data = await syncProfile(name, req.body?.profileUrl || null);

    // Use AI to extract structured data from raw LinkedIn page text.
    // Runs on every LinkedIn sync — DOM selectors are unreliable, AI is the source of truth.
    if (name === 'linkedin' && data.structured?._rawForAI) {
      try {
        const { callPower } = await import('../services/aiAdapter.js');
        const rawForAI = data.structured._rawForAI;
        delete data.structured._rawForAI;

        const prompt = `Extract structured profile data from this LinkedIn profile page text. Return ONLY valid JSON with these exact fields:
{
  "name": "<full name>",
  "headline": "<professional headline — the 1-2 line tagline directly under the person's name, NOT a job title>",
  "location": "<city, state or region>",
  "about": "<the About/Summary section ONLY — personal bio the person wrote about themselves, typically 2-5 paragraphs. Do NOT include job listings, activity posts, or feed content>",
  "skills": ["<skill1>", "<skill2>", ...],
  "experience": [
    {
      "title": "<job title>",
      "company": "<company name>",
      "dates": "<date range e.g. Jan 2020 – Present>",
      "bullets": ["<key accomplishment bullet>"]
    }
  ],
  "education": [
    {
      "institution": "<school or university name>",
      "degree": "<degree type e.g. Bachelor of Science, Master of Arts>",
      "field": "<field of study>",
      "dates": "<graduation year or date range>"
    }
  ],
  "certifications": [
    {
      "name": "<certification or license name>",
      "issuer": "<issuing organization>",
      "issued": "<date issued>",
      "expires": "<expiration date, or empty string if none>"
    }
  ],
  "projects": [
    {
      "name": "<project name>",
      "dates": "<date range>",
      "description": "<project description>"
    }
  ],
  "volunteer": [
    {
      "role": "<role or title>",
      "organization": "<organization name>",
      "dates": "<date range>",
      "description": "<description>"
    }
  ],
  "publications": [
    {
      "title": "<publication title>",
      "publisher": "<publisher or journal>",
      "date": "<date>",
      "description": "<brief description>"
    }
  ],
  "awards": [
    {
      "title": "<award or honor name>",
      "issuer": "<issuing organization>",
      "date": "<date received>"
    }
  ],
  "languages": [
    {
      "language": "<language name>",
      "proficiency": "<proficiency level>"
    }
  ],
  "organizations": [
    {
      "name": "<organization name>",
      "role": "<role>",
      "dates": "<date range>"
    }
  ],
  "courses": [
    {
      "name": "<course name>",
      "provider": "<provider or institution>"
    }
  ]
}
Rules:
- "headline" is the short professional tagline on the profile card (e.g. "Senior Data Analyst | Python · SQL · Tableau")
- "about" is the personal About/bio section only — NOT job postings, activity feed, or shared posts
- "skills" must be ALL actual professional skills from the Skills section, not navigation text — extract every skill with no limit
- "experience" lists ALL work history roles found — no limit, include every position
- "education" lists all degrees, diplomas, bootcamps, and academic credentials found
- "certifications" lists all professional certifications and licenses found (may also appear under "Licenses & Certifications" section)
- "projects" lists all side projects, research projects, and featured work
- "volunteer" lists all volunteer and community involvement
- "publications" lists all articles, papers, and publications
- "awards" lists all awards, honors, and achievements
- "languages" lists all languages with proficiency levels
- "organizations" lists all professional organizations and memberships
- "courses" lists any courses, training, or certificates of completion
If a field cannot be confidently identified, use empty string or empty array.

LinkedIn profile page text:
${rawForAI}`;

        const aiText = await callPower(
          'You extract structured profile data from LinkedIn page text. Return only valid JSON. Be precise: "headline" is the tagline under the name, "about" is the personal bio section — never activity posts or job listings. Extract ALL sections with no item limits.',
          prompt, 5000
        );
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          let aiParsed;
          try { aiParsed = JSON.parse(jsonMatch[0]); } catch { aiParsed = null; }
          if (aiParsed) {
            // AI takes priority over DOM for LinkedIn — DOM selectors are unreliable
            const s = data.structured;
            if (aiParsed.name)               s.name       = aiParsed.name;
            if (aiParsed.headline)           s.headline   = aiParsed.headline;
            if (aiParsed.location)           s.location   = aiParsed.location;
            if (aiParsed.about)              s.about      = aiParsed.about;
            if (aiParsed.skills?.length)          s.skills          = aiParsed.skills;
            if (aiParsed.experience?.length)      s.experience      = aiParsed.experience;
            if (aiParsed.education?.length)       s.education       = aiParsed.education;
            if (aiParsed.certifications?.length)  s.certifications  = aiParsed.certifications;
            if (aiParsed.projects?.length)        s.projects        = aiParsed.projects;
            if (aiParsed.volunteer?.length)       s.volunteer       = aiParsed.volunteer;
            if (aiParsed.publications?.length)    s.publications    = aiParsed.publications;
            if (aiParsed.awards?.length)          s.awards          = aiParsed.awards;
            if (aiParsed.languages?.length)       s.languages       = aiParsed.languages;
            if (aiParsed.organizations?.length)   s.organizations   = aiParsed.organizations;
            if (aiParsed.courses?.length)         s.courses         = aiParsed.courses;
            s._source = 'ai';
          }
        }
      } catch (aiErr) {
        console.warn('LinkedIn AI extraction failed:', aiErr.message);
      }
    }

    res.json({ ok: true, ...data });
  } catch (e) {
    const status = e.message.includes('expired') ? 401 : 500;
    res.status(status).json({ ok: false, error: e.message });
  }
});

export default router;
