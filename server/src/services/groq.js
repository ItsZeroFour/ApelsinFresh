// Гибридный сервис:
//   • LLM  → Groq (llama-3.3-70b)        — быстрый "мозг"
//   • STT  → Deepgram Nova-2             — обходит IP-блок Groq Audio на VPS
//
// Почему так: Groq Audio API режется по IP на некоторых VPS (Cloudflare 403),
// тогда как chat.completions работает нормально. Deepgram доступен с любого
// VPS, при регистрации даёт $200 бесплатных кредитов.
//
// Имя файла оставлено прежним (groq.js), чтобы не трогать импорты в routes/.

import Groq from 'groq-sdk';
import { createClient } from '@deepgram/sdk';

// --- Groq client (lazy) ---
let _groq = null;
function getGroq() {
  if (_groq) return _groq;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY не задан в .env');
  _groq = new Groq({ apiKey });
  return _groq;
}

// --- Deepgram client (lazy) ---
let _dg = null;
function getDeepgram() {
  if (_dg) return _dg;
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY не задан в .env');
  _dg = createClient(apiKey);
  return _dg;
}

const getLlmModel = () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const getDgModel = () => process.env.DEEPGRAM_MODEL || 'nova-2';

/**
 * Транскрипция через Deepgram. Принимает Buffer.
 * Nova-2 хорошо работает с русским, latency ~200-400мс.
 */
export async function transcribe(audioBuffer /*, filename — не нужен Deepgram-у */) {
  const dg = getDeepgram();
  const { result, error } = await dg.listen.prerecorded.transcribeFile(audioBuffer, {
    model: getDgModel(),
    language: 'ru',
    smart_format: true,
    punctuate: true,
  });
  if (error) {
    throw new Error(`Deepgram: ${error.message || error}`);
  }
  return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
}

/**
 * Стриминг LLM через Groq.
 */
export async function* streamChat(messages) {
  const stream = await getGroq().chat.completions.create({
    model: getLlmModel(),
    messages,
    stream: true,
    temperature: 0.6,
    max_tokens: 400,
    top_p: 0.9,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}