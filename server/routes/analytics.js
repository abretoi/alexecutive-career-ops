import { Router } from 'express';
import { getApplications } from '../db/dataStore.js';
import { analyzeSkillsGap, detectBlindSpots } from '../services/claude.js';

const router = Router();

const FUNNEL_STAGES = ['Evaluated', 'Resume Ready', 'Applied', 'Responded', 'Interview', 'Offer', 'Accepted'];
const SCORE_BUCKETS = ['1.0-2.0', '2.0-3.0', '3.0-3.5', '3.5-4.0', '4.0-4.5', '4.5-5.0'];
const RESPONDED_STATUSES = new Set(['Responded', 'Interview', 'Offer', 'Accepted']);

function scoreRange(score) {
  if (score < 2.0) return '1.0-2.0';
  if (score < 3.0) return '2.0-3.0';
  if (score < 3.5) return '3.0-3.5';
  if (score < 4.0) return '3.5-4.0';
  if (score < 4.5) return '4.0-4.5';
  return '4.5-5.0';
}

router.get('/pipeline', (req, res) => {
  try {
    const apps = getApplications();
    const total = apps.length;

    const byStatus = {};
    for (const app of apps) {
      byStatus[app.status] = (byStatus[app.status] || 0) + 1;
    }

    const funnel = FUNNEL_STAGES.map(stage => {
      const count = byStatus[stage] || 0;
      return { stage, count, pct: total ? Math.round((count / total) * 100) : 0 };
    });

    const sourceMap = {};
    for (const app of apps) {
      const src = app.source || 'Unknown';
      if (!sourceMap[src]) sourceMap[src] = { source: src, count: 0, responded: 0 };
      sourceMap[src].count++;
      if (RESPONDED_STATUSES.has(app.status)) sourceMap[src].responded++;
    }
    const bySource = Object.values(sourceMap).map(s => ({
      ...s,
      responsePct: s.count ? Math.round((s.responded / s.count) * 100) : 0
    }));

    const bucketMap = Object.fromEntries(SCORE_BUCKETS.map(b => [b, 0]));
    for (const app of apps) {
      if (app.score != null) {
        const bucket = scoreRange(Number(app.score));
        if (bucket in bucketMap) bucketMap[bucket]++;
      }
    }
    const scoreDistribution = SCORE_BUCKETS.map(range => ({ range, count: bucketMap[range] }));

    const respondedApps = apps.filter(a =>
      a.dateApplied && a.dateResponded && RESPONDED_STATUSES.has(a.status)
    );
    let avgDaysToRespond = null;
    if (respondedApps.length) {
      const totalDays = respondedApps.reduce((sum, a) => {
        const diff = new Date(a.dateResponded) - new Date(a.dateApplied);
        return sum + diff / 86400000;
      }, 0);
      avgDaysToRespond = Math.round(totalDays / respondedApps.length);
    }

    res.json({ total, byStatus, funnel, bySource, scoreDistribution, avgDaysToRespond });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/skills-gap', async (req, res) => {
  try {
    const { jobs } = req.body;
    const result = await analyzeSkillsGap(jobs);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/blind-spots', async (req, res) => {
  try {
    const applications = getApplications();
    const result = await detectBlindSpots(applications);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
