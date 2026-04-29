// POST /api/chat — упрощённая версия без LLM.
// Принимает текст вопроса, ищет ответ в knowledge base через brain.answer(),
// режет на предложения и стримит mp3 по SSE.
//
// Формат событий тот же, что и раньше:
//   event: text   data: {"delta":"..."}
//   event: audio  data: {"mp3":"<base64>","sentence":"..."}
//   event: done
//   event: error  data: {"message":"..."}

import { Router } from 'express';
import { textToSpeech } from '../services/elevenlabs.js';
import { answer } from '../services/brain.js';

const router = Router();

const SENTENCE_END_RE = /([.!?…]|\n)\s/;

router.post('/', async (req, res) => {
  const { message } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const t0 = Date.now();

  try {
    // 1. Получаем ответ от "мозга" — это мгновенно
    const fullText = answer(message);
    console.log(`  ❓ "${message}"`);
    console.log(`  💬 "${fullText}"`);

    // 2. Сразу шлём весь текст для подписей (анимировать стрим тут смысла нет —
    //    ответ генерится мгновенно, не стримом)
    send('text', { delta: fullText });

    // 3. Режем на предложения и параллельно отправляем в TTS
    const sentences = [];
    let buf = fullText;
    while (true) {
      const m = buf.match(SENTENCE_END_RE);
      if (!m) {
        if (buf.trim()) sentences.push(buf);
        break;
      }
      const endIdx = m.index + m[0].length;
      sentences.push(buf.slice(0, endIdx));
      buf = buf.slice(endIdx);
    }

    // Если предложений нет — добавляем хотя бы целую фразу
    if (sentences.length === 0) sentences.push(fullText);

    // Все TTS параллельно, отдаём по очереди
    const ttsPromises = sentences.map((s) =>
      textToSpeech(s.trim())
        .then((mp3) => ({ mp3: mp3.toString('base64'), sentence: s.trim() }))
        .catch((err) => ({ error: err.message, sentence: s.trim() })),
    );

    let firstAudioLogged = false;
    for (const p of ttsPromises) {
      const item = await p;
      if (!firstAudioLogged) {
        console.log(`  ⚡ TTFA: ${Date.now() - t0}мс`);
        firstAudioLogged = true;
      }
      if (item.error) {
        send('error', { message: `TTS: ${item.error}` });
      } else {
        send('audio', item);
      }
    }

    console.log(`  ✓ done за ${Date.now() - t0}мс\n`);
    send('done', { fullText });
  } catch (err) {
    console.error('[chat] error:', err);
    send('error', { message: err.message || 'chat failed' });
  } finally {
    res.end();
  }
});

export default router;
