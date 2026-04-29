import { Router } from 'express';
import { generateSpeech, RECOMMENDED_VOICES } from '../services/tts.js';

export const ttsRouter = Router();

// POST /api/tts/speak — генерация голоса Ларкинса
ttsRouter.post('/speak', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ error: 'Текст не может быть пустым' });
    }

    const audioBuffer = await generateSpeech(text);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.send(audioBuffer);

  } catch (err) {
    console.error('TTS error:', err);
    
    // Если нет ключа — даём понятный ответ
    if (err.message.includes('не задан')) {
      return res.status(501).json({ 
        error: 'TTS не настроен',
        hint: 'Добавь ELEVENLABS_API_KEY в .env',
        voices: RECOMMENDED_VOICES,
      });
    }
    
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tts/voices — список рекомендованных голосов
ttsRouter.get('/voices', (req, res) => {
  res.json({ voices: RECOMMENDED_VOICES });
});
