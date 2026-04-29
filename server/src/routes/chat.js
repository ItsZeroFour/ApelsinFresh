// POST /api/chat — теперь возвращает только текст (без аудио).
// TTS делается на клиенте через window.speechSynthesis — это обходит
// все блокировки внешних API.

import { Router } from 'express';
import { answer } from '../services/brain.js';

const router = Router();

router.post('/', async (req, res) => {
  const { message } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  try {
    const text = answer(message);
    console.log(`  ❓ "${message}"`);
    console.log(`  💬 "${text}"\n`);
    res.json({ text });
  } catch (err) {
    console.error('[chat] error:', err);
    res.status(500).json({ error: err.message || 'chat failed' });
  }
});

export default router;