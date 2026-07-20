import { Router } from 'express';
import { generateStarAnswers, generateCompanyBrief, generateTechQA, evaluateMockAnswer } from '../services/claude.js';

const router = Router();

router.post('/star-answers', async (req, res) => {
  try {
    const { job, questions } = req.body;
    const result = await generateStarAnswers(job, questions);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/company-brief', async (req, res) => {
  try {
    const { job } = req.body;
    const result = await generateCompanyBrief(job);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tech-qa', async (req, res) => {
  try {
    const { job } = req.body;
    const result = await generateTechQA(job);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/mock-feedback', async (req, res) => {
  try {
    const { job, question, answer } = req.body;
    const result = await evaluateMockAnswer(job, question, answer);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
