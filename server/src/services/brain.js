// ============================================================
// 🧠 МОЗГ "АПЕЛЬСИН" v4 — гибридный (rule + pseudo-AI)
// ============================================================

import { getContext } from './knowledge.js';

// ============================================================
// 🧠 ПАМЯТЬ (контекст диалога)
// ============================================================

let memory = {
  lastTopic: null,
  lastIntent: null,
};

// ============================================================
// 🎤 ОЧИСТКА ДЛЯ ОЗВУЧКИ
// ============================================================

function clean(text) {
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}

// ============================================================
// ⚡️ СТИЛЬ "АПЕЛЬСИН"
// ============================================================

function stylize(text, type = 'default') {
  const endings = {
    product: 'Ключ — формирование привычки.',
    economics: 'Это напрямую растит LTV.',
    growth: 'Это масштабируется через удержание.',
    default: ''
  };

  return clean(text + ' ' + (endings[type]  ''));
}

// ============================================================
// 💬 SMALLTALK
// ============================================================

const SMALLTALK = [
  {
    keys: ['привет','хай','hello'],
    answers: ['Я Апельсин. Задавайте вопрос.', 'На связи. Что интересно?']
  },
  {
    keys: ['кто ты','ты кто'],
    answers: ['Я Апельсин. Голосовой эксперт Apelsin Fresh.']
  },
  {
    keys: ['спасибо'],
    answers: ['Пожалуйста.']
  }
];

function trySmalltalk(q) {
  const text = q.toLowerCase();

  for (const rule of SMALLTALK) {
    for (const k of rule.keys) {
      if (text.includes(k)) {
        return rule.answers[Math.floor(Math.random() * rule.answers.length)];
      }
    }
  }
  return null;
}

// ============================================================
// 🎯 INTENTS (можно несколько)
// ============================================================

const INTENTS = [
  { id: 'product', keys: ['что это','что такое','продукт','сервис','как работает'] },
  { id: 'economics', keys: ['деньги','зарабатываете','выручка','ltv','cac','чек'] },
  { id: 'market', keys: ['рынок','tam','объем'] },
  { id: 'audience', keys: ['клиент','аудитория','для кого'] },
  { id: 'growth', keys: ['рост','масштаб','привлечение','маркетинг'] },
  { id: 'team', keys: ['команда','кто делает'] },
  { id: 'roadmap', keys: ['планы','дальше','roadmap'] },
];

// ============================================================
// 🔍 ПОИСК ИНТЕНТОВ (multi)
// ============================================================

function detectIntents(q) {
  const text = q.toLowerCase();
  const found = [];

  for (const intent of INTENTS) {
    for (const key of intent.keys) {
      if (text.includes(key)) {
        found.push(intent.id);
        break;
      }
    }
  }

  return found.length ? found : ['fallback'];
}

// ============================================================
// 📚 ДОСТАЕМ ЗНАНИЯ
// ============================================================

function getRelevantKnowledge(question) {
  const kb = getContext('', 100);

  // простой скоринг
  const scored = kb.map(entry => {
    let score = 0;
    const q = question.toLowerCase();

    if (q.includes(entry.title.toLowerCase())) score += 5;
    if (q.includes(entry.category?.toLowerCase())) score += 3;

    return { entry, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(x => x.entry.content)
    .join(' ');
}

// ============================================================
// 🧠 ГЕНЕРАЦИЯ ОТВЕТА (без LLM)
// ============================================================

function generateAnswer(intents, context) {

  let base = context;

  if (!base) {
    return fallback();
  }

  // усиливаем по типу
  if (intents.includes('economics')) {
    return stylize(base, 'economics');
  }

  if (intents.includes('growth')) {
    return stylize(base, 'growth');
  }

  if (intents.includes('product')) {
    return stylize(base, 'product');
  }

  return stylize(base);
}

// ============================================================
// 🤖 LLM (опционально — включи когда хочешь)
// ============================================================

async function generateWithLLM(question, context) {
  if (!process.env.OPENAI_API_KEY) return null;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
Ты Апельсин.
Отвечай как эксперт стартапа.
Коротко: 1-3 предложения.
Всегда усиливай бизнес-смыслом.
Используй цифры если есть.
`
        },
        {
          role: 'user',
          content: question + "\n\nКонтекст:\n" + context
        }
      ]
    })
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content  null;
}

// ============================================================
// 🧯 FALLBACK
// ============================================================

function fallback() {
  const answers = [
    'Точные детали лучше уточнить у команды после питча.',
    'Конкретику дам после — важно не искажать цифры.',
    'Хороший вопрос, но отвечу точно позже.'
  ];
  return answers[Math.floor(Math.random() * answers.length)];
}

// ============================================================
// 🚀 ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

export async function answer(question) {

  if (!question) return fallback();

  // 1. smalltalk
  const small = trySmalltalk(question);
  if (small) return small;

  // 2. intents
  const intents = detectIntents(question);

  // 3. контекст
  const context = getRelevantKnowledge(question);

  // 4. пробуем LLM
  const llm = await generateWithLLM(question, context);
  if (llm) return clean(llm);

  // 5. fallback генерация
  const result = generateAnswer(intents, context);

  // 6. сохраняем память
  memory.lastIntent = intents[0];

  return result;
}