/**
 * routes/jobs.js — Job search & evaluation endpoints
 * POST /api/jobs/search        → returns { searchId }
 * GET  /api/jobs/stream/:id    → SSE stream of job results
 * POST /api/jobs/evaluate      → full 6-block Claude evaluation
 * POST /api/jobs/tailor        → tailor resume for a job
 */
import { Router } from 'express';
import { randomBytes } from 'crypto';
import { search, dedupKey } from '../services/jobSearch.js';
import { fullEvaluate, tailorResume, generateApplicationPacket, recommendSimilar, estimateSalaryBand } from '../services/claude.js';

const router  = Router();
const pending = new Map(); // searchId → { params, results[], done }

// ── POST /api/jobs/search ─────────────────────────────────────
router.post('/search', (req, res) => {
  const searchId = randomBytes(8).toString('hex');
  pending.set(searchId, {
    params: req.body, results: [], updates: [],
    done: false, scoringDone: false, sources: [],
    _seen: new Map(), _byKey: new Map(),
  });

  // Start search in background
  const state = pending.get(searchId);
  search(req.body, (jobs, source) => {
    let added = 0;
    for (const job of jobs) {
      const key = dedupKey(job);
      if (!state._seen.has(key)) {
        state._seen.set(key, job.source);
        job.seenOnBoards = [job.source];
        const idx = state.results.length;
        state.results.push(job);
        state._byKey.set(key, idx);
        added++;
      } else {
        // Duplicate — merge board list, applicant count, and any late-arriving
        // AI score into the original (boards emit instantly with hybrid
        // relevance, then again once background AI scoring completes).
        const idx = state._byKey.get(key);
        if (idx !== undefined) {
          const orig = state.results[idx];
          if (!orig.seenOnBoards) orig.seenOnBoards = [orig.source];
          if (!orig.seenOnBoards.includes(job.source)) orig.seenOnBoards.push(job.source);
          if (job.numApplicants && (!orig.numApplicants || job.numApplicants > orig.numApplicants)) {
            orig.numApplicants = job.numApplicants;
          }
          if (job.score != null && orig.score == null) {
            orig.score = job.score;
            orig.archetype = job.archetype ?? orig.archetype;
            orig.verdict = job.verdict ?? orig.verdict;
            orig.scoreReason = job.scoreReason ?? orig.scoreReason;
            // Queue an SSE update so the already-rendered card gets its score
            state.updates.push({ ...orig });
          }
        }
      }
    }
    // count = unique jobs added; found = raw results from the board before
    // cross-board dedup. Several startup boards surface the same underlying ATS
    // postings, so a healthy board can legitimately add 0 NEW jobs.
    state.sources.push({ source, count: added, found: jobs.length });
  }).then(result => {
    // Phase 1 complete: all boards returned, all results emitted.
    state.done = true;
    // Phase 2 (AI enrichment) finishes on its own schedule.
    (result?.scoringDone || Promise.resolve()).then(() => { state.scoringDone = true; });
  }).catch(e => {
    state.error = e.message;
    state.done  = true;
    state.scoringDone = true;
  });

  res.json({ searchId });
});

// ── GET /api/jobs/stream/:id ──────────────────────────────────
// SSE: streams results as they arrive, then sends 'done' event
router.get('/stream/:searchId', (req, res) => {
  const { searchId } = req.params;
  const state = pending.get(searchId);
  if (!state) return res.status(404).json({ error: 'Search not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let sent = 0, sentUpdates = 0, boardsDoneSent = false;

  const interval = setInterval(() => {
    const st = pending.get(searchId) || {};
    const { results, updates, done, scoringDone, error } = st;

    // Send any new results — named SSE events so addEventListener('job') fires
    while (sent < (results?.length || 0)) {
      const job = results[sent++];
      res.write(`event: job\ndata: ${JSON.stringify(job)}\n\n`);
    }

    // Stream AI-score updates for already-sent cards
    while (sentUpdates < (updates?.length || 0)) {
      const upd = updates[sentUpdates++];
      res.write(`event: update\ndata: ${JSON.stringify(upd)}\n\n`);
    }

    // Phase 1 done: results complete — client leaves "searching" state while
    // AI scores keep streaming in the background.
    if (done && !boardsDoneSent) {
      boardsDoneSent = true;
      res.write(`event: status\ndata: ${JSON.stringify({ phase: 'scoring', total: sent })}\n\n`);
    }

    if ((done && scoringDone) || error) {
      clearInterval(interval);
      res.write(`event: done\ndata: ${JSON.stringify({ total: sent, error: error || null })}\n\n`);
      res.end();
      // Clean up after 5 min
      setTimeout(() => pending.delete(searchId), 300000);
    }
  }, 250);

  req.on('close', () => clearInterval(interval));
});

// ── GET /api/jobs/status/:id ─────────────────────────────────
router.get('/status/:searchId', (req, res) => {
  const state = pending.get(req.params.searchId);
  if (!state) return res.status(404).json({ error: 'Not found' });
  res.json({ done: state.done, count: state.results.length, sources: state.sources });
});

// ── POST /api/jobs/evaluate ───────────────────────────────────
router.post('/evaluate', async (req, res) => {
  try {
    const result = await fullEvaluate(req.body.job ?? req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/jobs/tailor ─────────────────────────────────────
router.post('/tailor', async (req, res) => {
  try {
    const { job, keywords } = req.body;
    const writingStyle = job?.writingStyle || req.body.writingStyle;
    const result = await tailorResume(job, keywords, writingStyle);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/jobs/application-packet ────────────────────────
// Generates pre-filled cover letter + ATS Q&A for a single job
router.post('/application-packet', async (req, res) => {
  try {
    const { job } = req.body;
    const packet = await generateApplicationPacket(job);
    res.json(packet);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/jobs/recommend ──────────────────────────────────
router.post('/recommend', async (req, res) => {
  try {
    const { job } = req.body;
    const results = await recommendSimilar(job);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/jobs/salary-estimate ──────────────────────────
// Returns salary band from BLS OES, Glassdoor, LinkedIn Salary, Levels.fyi, etc.
router.post('/salary-estimate', async (req, res) => {
  try {
    const { job } = req.body;
    const result = await estimateSalaryBand(job);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
