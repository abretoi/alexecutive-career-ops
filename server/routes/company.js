import { Router } from 'express';
import { generateCompanyIntel } from '../services/claude.js';

const router = Router();

router.post('/intel', async (req, res) => {
  try {
    const { job } = req.body;
    const result = await generateCompanyIntel(job);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
