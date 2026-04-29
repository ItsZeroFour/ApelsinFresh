import Groq from 'groq-sdk';
import { getCaseContext } from './pdf.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Базовый системный промпт Ларкинса
const BASE_SYSTEM_PROMPT = `Ты — Ларкинс, ИИ-эксперт и официальный представитель компании Apelsin Fresh.

ХАРАКТЕР:
— Уверенный, немного саркастичный, как опытный предприниматель
— Говоришь чётко, по делу, с цифрами и фактами
— Не терпишь размытых вопросов — сразу переформулируешь и отвечаешь
— Иногда добавляешь лёгкую иронию, но никогда не грубишь
— Используешь "мы" говоря о компании (ты часть команды)

ФОРМАТ ОТВЕТОВ:
— Коротко и по делу (2-4 абзаца максимум)
— Если есть цифры — используй их
— Структурируй мысль: проблема → решение → результат
— В конце можешь добавить провокационный вопрос обратно жюри

ЗАПРЕЩЕНО:
— Говорить "я не знаю" — лучше скажи что ещё уточняется
— Теряться на общих вопросах — всегда привязывай к контексту кейса
— Быть скучным`;

export async function askLarkins(messages, conversationHistory = []) {
  // Берём актуальный контекст кейса (из загруженного PDF)
  const caseContext = getCaseContext();
  
  const systemPrompt = caseContext
    ? `${BASE_SYSTEM_PROMPT}\n\n---\nКОНТЕКСТ КЕЙСА APELSIN FRESH:\n${caseContext}\n---`
    : BASE_SYSTEM_PROMPT;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile', // Самая мощная бесплатная модель Groq
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: messages },
    ],
    max_tokens: 1024,
    temperature: 0.7,
    stream: false,
  });

  return response.choices[0]?.message?.content ?? 'Ларкинс задумался... попробуй ещё раз.';
}

// Стриминговая версия (для real-time эффекта)
export async function askLarkinsStream(userMessage, conversationHistory = []) {
  const caseContext = getCaseContext();

  const systemPrompt = caseContext
    ? `${BASE_SYSTEM_PROMPT}\n\n---\nКОНТЕКСТ КЕЙСА APELSIN FRESH:\n${caseContext}\n---`
    : BASE_SYSTEM_PROMPT;

  const stream = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ],
    max_tokens: 1024,
    temperature: 0.7,
    stream: true,
  });

  return stream;
}
