// POST /api/chat — главный эндпоинт.
// Принимает текст вопроса (после Whisper), стримит ответ через Server-Sent Events:
//
//   event: text   data: "{\"delta\":\"...\"}"        — кусок текста ответа (для подписей)
//   event: audio  data: "{\"mp3\":\"<base64>\",\"sentence\":\"...\"}"  — mp3 одного предложения
//   event: done   data: "{}"
//   event: error  data: "{\"message\":\"...\"}"
//
// Логика: пока LLM стримит токены, мы собираем их в буфер, и как только встречаем
// конец предложения (.!?\n) при длине буфера >= MIN_SENTENCE_LEN — отправляем
// этот кусок в ElevenLabs и стримим mp3 в base64. Фронт играет в очереди.
//
// Это даёт latency до первого звука ~0.8-1.5 сек на коротком ответе — основной wow.

import { Router } from 'express';
import { streamChat } from '../services/groq.js';
import { textToSpeech } from '../services/elevenlabs.js';
import { getContext, formatContext } from '../services/knowledge.js';
import { buildSystemPrompt } from '../prompt.js';

const router = Router();

const MIN_SENTENCE_LEN = 15; // нижний порог для НЕ-первых предложений
const SENTENCE_END_RE = /([.!?…]|\n)\s/;

router.post('/', async (req, res) => {
  const { message, history = [] } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  // --- SSE заголовки ---
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // на случай nginx — чтобы не буферизовал
  });
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // --- Сборка контекста ---
  const entries = getContext(message);
  const systemPrompt = buildSystemPrompt(formatContext(entries));

  const messages = [
    { role: 'system', content: systemPrompt },
    // последние 6 сообщений истории (3 круга диалога) — больше для голосового Q&A не нужно
    ...history.slice(-6),
    { role: 'user', content: message },
  ];

  // --- Тайминги для диагностики (видно в консоли сервера на каждый запрос) ---
  const t0 = Date.now();
  let tFirstToken = null;
  let tFirstAudio = null;
  const ms = (t) => `${Date.now() - t}мс`;

  // --- Очередь TTS — НЕ ждём окончания одного предложения, чтобы начать следующее.
  //     Все TTS-запросы летят параллельно, но в SSE отдаются строго по порядку. ---
  const ttsQueue = []; // массив Promise<{mp3, sentence}>

  const enqueueTts = (sentence) => {
    const trimmed = sentence.trim();
    if (!trimmed) return;
    const tStart = Date.now();
    const p = textToSpeech(trimmed)
      .then((mp3) => {
        console.log(`  [tts] "${trimmed.slice(0, 40)}…" → ${mp3.length}b за ${ms(tStart)}`);
        return { mp3: mp3.toString('base64'), sentence: trimmed };
      })
      .catch((err) => {
        console.error('[tts] error:', err.message);
        return { error: err.message, sentence: trimmed };
      });
    ttsQueue.push(p);
  };

  let buffer = '';
  let fullText = '';
  let firstSentenceSent = false; // ⚡ для первого предложения скипаем проверку min_len
  // ВАЖНО: объявляем llmDone ДО запуска drainTts.
  // drainTts — это IIFE, тело async-функции начинает крутиться синхронно до первого await,
  // и в первом же while-tick читает llmDone. Если объявление ниже — TDZ ReferenceError.
  let llmDone = false;

  // Промис, который дренирует очередь TTS и шлёт audio events в правильном порядке.
  const drainTts = (async () => {
    let nextIndex = 0;
    while (true) {
      if (nextIndex >= ttsQueue.length) {
        // если стрим LLM ещё идёт — ждём пополнения
        if (!llmDone) {
          await new Promise((r) => setTimeout(r, 8)); // короткий poll — реакция почти мгновенная
          continue;
        }
        // LLM закончил, очередь пуста — выходим
        return;
      }
      const item = await ttsQueue[nextIndex++];
      if (tFirstAudio === null && !item.error) {
        tFirstAudio = Date.now();
        console.log(`  ⚡ TTFA (time to first audio): ${tFirstAudio - t0}мс`);
      }
      if (item.error) {
        send('error', { message: `TTS: ${item.error}` });
      } else {
        send('audio', item);
      }
    }
  })();

  try {
    for await (const delta of streamChat(messages)) {
      if (tFirstToken === null) {
        tFirstToken = Date.now();
        console.log(`  ⚡ LLM TTFT: ${tFirstToken - t0}мс`);
      }
      fullText += delta;
      buffer += delta;
      send('text', { delta });

      // Режем буфер на предложения
      while (true) {
        const m = buffer.match(SENTENCE_END_RE);
        if (!m) break;

        const endIdx = m.index + m[0].length;
        const sentence = buffer.slice(0, endIdx);

        // ⚡ Для ПЕРВОГО предложения — скипаем проверку min_len, шлём как есть.
        // Это снижает latency до первого звука: даже короткое "Да." уйдёт в TTS немедленно.
        // Для последующих — проверяем длину, чтобы не дробить речь на огрызки.
        if (firstSentenceSent && sentence.trim().length < MIN_SENTENCE_LEN) break;

        buffer = buffer.slice(endIdx);
        enqueueTts(sentence);
        firstSentenceSent = true;
      }
    }

    // Дотрейлим остаток буфера
    if (buffer.trim().length > 0) {
      enqueueTts(buffer);
      buffer = '';
    }

    llmDone = true;
    await drainTts;
    console.log(`  ✓ done за ${ms(t0)} (всего ${fullText.length} символов)\n`);
    send('done', { fullText });
  } catch (err) {
    llmDone = true;
    console.error('[chat] error:', err);
    send('error', { message: err.message || 'chat failed' });
    try {
      await drainTts;
    } catch {}
  } finally {
    res.end();
  }
});

export default router;