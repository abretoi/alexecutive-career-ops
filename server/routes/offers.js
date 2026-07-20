import { Router } from 'express';
import { analyzeOffer, generateNegotiationScript } from '../services/claude.js';

const router = Router();

router.post('/analyze', async (req, res) => {
  try {
    const { offer, job } = req.body;
    const result = await analyzeOffer(offer, job);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/negotiate', async (req, res) => {
  try {
    const { offer, job, targetComp } = req.body;
    const result = await generateNegotiationScript(offer, job, targetComp);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
