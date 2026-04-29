import Groq, { toFile } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const LLM_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const STT_MODEL = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';

/**
 * Распознавание речи. Принимает Buffer с аудио + имя файла (для определения формата).
 * MediaRecorder в браузере шлёт webm/ogg/mp4 — Whisper-turbo принимает всё.
 */
export async function transcribe(audioBuffer, filename = 'audio.webm') {
  const file = await toFile(audioBuffer, filename);
  const result = await groq.audio.transcriptions.create({
    file,
    model: STT_MODEL,
    language: 'ru',
    response_format: 'json',
    // temperature: 0 даёт самый стабильный результат для коротких фраз
    temperature: 0,
  });
  return result.text || '';
}

/**
 * Стриминг LLM. Возвращает async iterable с дельтами текста.
 * messages — формат OpenAI: [{role, content}, ...]
 */
export async function* streamChat(messages) {
  const stream = await groq.chat.completions.create({
    model: LLM_MODEL,
    messages,
    stream: true,
    temperature: 0.6,
    max_tokens: 400, // ответы короткие — это голосовой Q&A
    top_p: 0.9,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
