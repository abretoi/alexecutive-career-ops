import express from 'express';
import { answerApplicationQuestion } from '../services/claude.js';

const router = express.Router();

// POST /api/app-writer/answer
// Body: { questions: string, writingStyle?: string, customNote?: string }
router.post('/answer', async (req, res) => {
  try {
    const { questions, writingStyle, customNote, jobContext } = req.body;
    if (!questions?.trim()) return res.status(400).json({ error: 'Question text required' });
    const result = await answerApplicationQuestion(questions.trim(), writingStyle || 'professional', customNote || null, jobContext || null);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
