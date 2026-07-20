import { Router } from 'express';
import { generateLinkedInRequest, generateColdEmail, generateReferralAsk, generateFollowUp } from '../services/claude.js';

const router = Router();

router.post('/linkedin-request', async (req, res) => {
  try {
    const { job, contactName } = req.body;
    const result = await generateLinkedInRequest(job, contactName);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/cold-email', async (req, res) => {
  try {
    const { job, contactName, contactRole } = req.body;
    const result = await generateColdEmail(job, contactName, contactRole);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/referral-ask', async (req, res) => {
  try {
    const { job, contactName, relationship } = req.body;
    const result = await generateReferralAsk(job, contactName, relationship);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/followup', async (req, res) => {
  try {
    const { job, applicationDate } = req.body;
    const result = await generateFollowUp(job, applicationDate);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
