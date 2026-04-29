import { Router } from 'express';
import multer from 'multer';
import { transcribe } from '../services/groq.js';

const router = Router();

// Whisper API лимит — 25 МБ. Голосовое сообщение 30 секунд weighs ~300КБ, так что с запасом.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post('/', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'audio file required' });
    }

    const text = await transcribe(
      req.file.buffer,
      req.file.originalname || 'audio.webm',
    );

    res.json({ text });
  } catch (err) {
    console.error('[transcribe] error:', err);
    res.status(500).json({ error: err.message || 'transcribe failed' });
  }
});

export default router;
