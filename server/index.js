/**
 * Alexecutive Career Ops — Express server
 * Serves the dashboard SPA + API endpoints
 * Start: npm start  →  open http://localhost:3000
 */
import express from 'express';
import cors    from 'cors';
import path    from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';

// Load .env if present
try {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  if (existsSync(envPath)) {
    readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k?.trim() && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
    });
  }
} catch {}

import jobsRouter           from './routes/jobs.js';
import trackerRouter        from './routes/tracker.js';
import resumeRouter         from './routes/resume.js';
import profileRouter        from './routes/profile.js';
import exportRouter         from './routes/export.js';
import outreachRouter       from './routes/outreach.js';
import interviewRouter      from './routes/interview.js';
import analyticsRouter      from './routes/analytics.js';
import companyRouter        from './routes/company.js';
import offersRouter         from './routes/offers.js';
import contactsRouter       from './routes/contacts.js';
import alertsRouter         from './routes/alerts.js';
import resumeVersionsRouter from './routes/resume-versions.js';
import sessionsRouter       from './routes/sessions.js';
import platformsRouter      from './routes/platforms.js';
import appWriterRouter      from './routes/appWriter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT      = process.env.PORT || 3000;
const PUBLIC    = path.join(__dirname, '..', 'public');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
// no-cache on app assets: this is a local dev-style app that updates in place —
// stale cached JS after an update caused confusing "old bug still happening" reports.
app.use(express.static(PUBLIC, {
  etag: false,
  setHeaders: res => res.setHeader('Cache-Control', 'no-cache, must-revalidate'),
}));

// API routes — core
app.use('/api/jobs',            jobsRouter);
app.use('/api/tracker',         trackerRouter);
app.use('/api/resume',          resumeRouter);
app.use('/api/profile',         profileRouter);
app.use('/api/export',          exportRouter);
// API routes — extended features
app.use('/api/outreach',        outreachRouter);
app.use('/api/interview',       interviewRouter);
app.use('/api/analytics',       analyticsRouter);
app.use('/api/company',         companyRouter);
app.use('/api/offers',          offersRouter);
app.use('/api/contacts',        contactsRouter);
app.use('/api/sessions',        sessionsRouter);
app.use('/api/platforms',       platformsRouter);
app.use('/api/app-writer',      appWriterRouter);
app.use('/api/alerts',          alertsRouter);
app.use('/api/resume-versions', resumeVersionsRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0.0' }));

// SPA fallback — all non-API routes → index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

// Verify public directory exists before starting
if (!existsSync(PUBLIC)) {
  console.error(`\n  ✗  Cannot find public/ directory at: ${PUBLIC}`);
  console.error(`  Make sure you started the server from inside the project folder:`);
  console.error(`  cd ~/Desktop/"Alexecutive Career Ops" && npm start\n`);
  process.exit(1);
}

// On startup: clear applications if no named session is active.
// This ensures server restarts always start clean unless the user saved a named session.
const DATA_DIR      = path.join(__dirname, '..', 'data');
const ACTIVE_SESS_F = path.join(DATA_DIR, 'active-session.json');
const APPS_F        = path.join(DATA_DIR, 'applications.json');
try {
  const hasActiveSession = existsSync(ACTIVE_SESS_F) &&
    JSON.parse(readFileSync(ACTIVE_SESS_F, 'utf8'))?.id;
  if (!hasActiveSession && existsSync(APPS_F)) {
    writeFileSync(APPS_F, '[]', 'utf8');
    console.log('  ℹ  No active session — application list cleared for fresh start.');
  }

  // Full fresh start: if the user has NO saved data at all (no resume, no
  // profile identity, no applications), wipe any stray working files so the
  // app launches truly anew. AI provider config (API keys) is never touched.
  const readJsonSafe = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
  const resumeF  = path.join(DATA_DIR, 'resume.json');
  const profileF = path.join(DATA_DIR, 'profile.json');
  const hasResume  = existsSync(resumeF) && !!readJsonSafe(resumeF)?.name;
  const profile    = readJsonSafe(profileF) || {};
  const hasProfile = !!(profile.name || (profile.targetRoles || []).length || profile.primaryIndustry);
  const hasApps    = (readJsonSafe(APPS_F) || []).length > 0;
  if (!hasResume && !hasProfile && !hasApps) {
    for (const f of ['resume.json', 'profile.json', 'cover-letter.json', 'active-session.json', 'writing-style.json']) {
      const fp = path.join(DATA_DIR, f);
      if (existsSync(fp)) unlinkSync(fp);
    }
    console.log('  ℹ  No saved candidate data — launching with a completely fresh state.');
  }
} catch {}

const server = app.listen(PORT, () => {
  console.log(`\n  ✓  Alexecutive Career Ops — http://localhost:${PORT}`);
  console.log(`     Open your browser to get started.`);
  console.log(`     First time? Go to Settings → AI Provider.\n`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗  Port ${PORT} is already in use.`);
    console.error(`\n  To fix this, run ONE of the following:\n`);
    console.error(`     Option A — Kill the existing process:`);
    console.error(`     kill $(lsof -ti:${PORT})\n`);
    console.error(`     Option B — Use a different port:`);
    console.error(`     PORT=${Number(PORT)+1} npm start\n`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});
