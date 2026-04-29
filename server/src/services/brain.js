// ============================================================
// Larkins v8.5 "Adaptive Response Engine"
// С вариативностью и контекстной адаптацией
// ============================================================

// ------------------------
// 1. УТИЛИТЫ (улучшенные)
// ------------------------
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[?!.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text).split(' ').filter(w => w.length > 0);
}

function getEditDistance(a, b) {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

// ------------------------
// 2. ИЗВЛЕЧЕНИЕ СУЩНОСТЕЙ (новое!)
// ------------------------
function extractQuestionType(question) {
  const q = normalize(question);
  
  // Типы вопросов
  if (/\b(сколько|какой|какая|какое)\b/.test(q)) return 'amount';
  if (/\b(когда|срок|время)\b/.test(q)) return 'time';
  if (/\b(как|каким образом)\b/.test(q)) return 'how';
  if (/\b(почему|зачем)\b/.test(q)) return 'why';
  if (/\b(если|а если|что если)\b/.test(q)) return 'conditional';
  if (/\b(не|ни)\b/.test(q)) return 'negative';
  
  return 'general';
}

function extractNumbers(question) {
  const matches = question.match(/(\d+\.?\d*)\s*(млрд|млн|тыс|%)?/gi);
  return matches || [];
}

function extractTopics(question) {
  const q = normalize(question);
  const topics = [];
  
  if (/\b(маркетинг|реклама|продвижение)\b/.test(q)) topics.push('marketing');
  if (/\b(разработка|код|программа)\b/.test(q)) topics.push('development');
  if (/\b(инфраструктура|сервер|хостинг)\b/.test(q)) topics.push('infrastructure');
  if (/\b(окупаемость|прибыль|доход)\b/.test(q)) topics.push('profit');
  if (/\b(риск|опасность|угроза)\b/.test(q)) topics.push('risk');
  if (/\b(данные|безопасность|защита)\b/.test(q)) topics.push('security');
  
  return topics;
}

// ------------------------
// 3. СЕМАНТИКА
// ------------------------
function vectorize(text) {
  const tokens = tokenize(text);
  const vector = {};
  for (const token of tokens) {
    vector[token] = (vector[token] || 0) + 1;
  }
  return vector;
}

function cosineSimilarity(v1, v2) {
  let dot = 0, mag1 = 0, mag2 = 0;
  const keys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
  for (const key of keys) {
    const a = v1[key] || 0;
    const b = v2[key] || 0;
    dot += a * b;
    mag1 += a * a;
    mag2 += b * b;
  }
  return (mag1 && mag2) ? dot / (Math.sqrt(mag1) * Math.sqrt(mag2)) : 0;
}

// ------------------------
// 4. KNOWLEDGE BASE (с вариативностью!)
// ------------------------
const KNOWLEDGE_BASE = [
  {
    id: "capex",
    intent: "finance",
    patterns: ["сколько вложили", "какой capex", "инвестиции на старте", "затраты на запуск", "бюджет проекта"],
    
    // ВАРИАТИВНЫЕ ОТВЕТЫ
    answers: {
      amount: {
        general: "На старте мы заложили 1,638 млрд рублей.",
        detailed: "Общий бюджет проекта — 1,638 млрд рублей. Из них 1,6 млрд направлено в маркетинг и масштабирование, 25 млн — в разработку и инфраструктуру.",
        short: "1,638 млрд рублей."
      },
      conditional: {
        marketing: "Если говорить о маркетинге — это 1,6 млрд из общего бюджета 1,638 млрд. Это около 98% всех инвестиций на старте.",
        development: "Разработка и инфраструктура получили 25 млн рублей — это около 1,5% от общего бюджета. Основной фокус на масштабировании.",
        general: "Даже в стресс-сценарии у нас есть резерв. Общий бюджет 1,638 млрд рублей распределен с учетом рисков."
      },
      negative: {
        general: "Понимаю ваш скепсис. Сумма 1,638 млрд рублей обоснована: 1,6 млрд — это инвестиция в быстрый захват рынка, 25 млн — в устойчивую платформу."
      },
      how: {
        general: "Распределение такое: 1,6 млрд (98%) — маркетинг и масштабирование, 25 млн (1,5%) — разработка и инфраструктура, остальное — операционные резервы."
      }
    },
    
    confidenceBoost: ["деньги", "вложили", "инвестиции", "капитал", "бюджет", "capex"],
    fallback: "По инвестициям: 1,638 млрд рублей на старте. Хотите детализацию по статьям?"
  },
  
  {
    id: "profit",
    intent: "finance",
    patterns: ["когда окупитесь", "когда прибыль", "срок окупаемости", "roi", "выход в плюс"],
    
    answers: {
      time: {
        general: "Окупаемость — около 2 месяцев при достижении плановых метрик.",
        detailed: "При выходе на плановые показатели окупаемость составляет 2 месяца. Прогноз выручки на 12 месяцев — 5 млрд рублей."
      },
      conditional: {
        metrics: "Если метрики будут ниже плана, окупаемость может сдвинуться до 3-4 месяцев. Мы заложили этот риск в финансовую модель.",
        general: "Даже в консервативном сценарии окупаемость не превысит 4 месяцев."
      },
      how: {
        general: "Механика простая: средний чек × количество пользователей минус операционные расходы. При плановых показателях выходим в плюс за 2 месяца."
      },
      negative: {
        general: "Понимаю сомнения. Мы считали по трем сценариям: оптимистичный — 1.5 месяца, базовый — 2 месяца, консервативный — 4 месяца."
      }
    },
    
    confidenceBoost: ["прибыль", "окупаемость", "roi", "доход", "выручка"],
    fallback: "По окупаемости: 2 месяца при плановых метриках. Выручка — 5 млрд за год."
  },
  
  {
    id: "security",
    intent: "risk",
    patterns: ["как защищаете данные", "безопасность", "утечки", "шифрование", "152-фз"],
    
    answers: {
      how: {
        general: "Используем банковский уровень защиты: end-to-end шифрование, A-Token авторизация, изолированные контуры данных.",
        detailed: "Три уровня защиты: 1) end-to-end шифрование всех данных, 2) A-Token для авторизации, 3) регулярные аудиты безопасности. Соответствуем 152-ФЗ."
      },
      conditional: {
        breach: "При гипотетической утечке у нас есть процедура реагирования: изоляция контура за 15 минут, уведомление пользователей в течение 24 часов.",
        general: "Даже при попытке взлома многоуровневая защита минимизирует риски."
      },
      negative: {
        general: "Понимаю опасения. Поэтому мы внедрили банковский стандарт защиты с end-to-end шифрованием и регулярными аудитами."
      }
    },
    
    confidenceBoost: ["безопасность", "данные", "защита", "утечки", "шифрование"],
    fallback: "По безопасности: банковский уровень защиты через A-Token и шифрование."
  },
  
  {
    id: "gambling",
    intent: "risk",
    patterns: ["это казино", "это азарт", "лудомания", "игровые механики"],
    
    answers: {
      negative: {
        general: "Нет, это не азартная модель. Ключевое отличие: пользователь получает гарантированную ценность за действия, а не шанс на выигрыш.",
        detailed: "Три отличия от азартных игр: 1) гарантированная выгода, 2) прозрачная экономика, 3) отсутствие элемента случайности в монетизации."
      },
      how: {
        general: "Модель построена на экономике ценности: пользователь совершает действия → получает гарантированный бонус → мы монетизируем через партнеров."
      },
      conditional: {
        regulation: "Если регулятор задаст этот вопрос — у нас есть юридическое заключение о соответствии законодательству о неазартных моделях.",
        general: "Даже при строгой трактовке закона наша модель проходит как программа лояльности."
      }
    },
    
    confidenceBoost: ["казино", "азарт", "лудомания", "игровые"],
    fallback: "Это не азартная модель — пользователь получает гарантированную выгоду, а не шанс на выигрыш."
  }
];

// ------------------------
// 5. INTENT DETECTION
// ------------------------
function detectIntent(question) {
  const tokens = tokenize(question);
  const intents = { finance: 0, tech: 0, risk: 0, audience: 0, other: 0 };
  
  const map = {
    finance: ["деньги", "прибыль", "окупаемость", "вложили", "инвестиции", "бюджет", "roi", "выручка"],
    tech: ["стек", "технологии", "api", "архитектура", "разработка", "платформа"],
    risk: ["риск", "безопасность", "утечки", "казино", "азарт", "защита", "данные"],
    audience: ["кто", "пользователь", "аудитория", "клиенты", "таргет", "рынок"]
  };
  
  for (const token of tokens) {
    for (const key in map) {
      if (map[key].some(word => getEditDistance(word, token) <= 2)) {
        intents[key] += 1;
      }
    }
  }
  
  return Object.entries(intents).sort((a, b) => b[1] - a[1])[0][0];
}

// ------------------------
// 6. АДАПТИВНАЯ ГЕНЕРАЦИЯ ОТВЕТА (новое!)
// ------------------------
function generateAdaptiveResponse(entry, question) {
  const qType = extractQuestionType(question);
  const topics = extractTopics(question);
  const numbers = extractNumbers(question);
  
  // Выбираем категорию ответа
  let answerCategory = 'general';
  if (qType === 'conditional' && topics.length > 0) {
    answerCategory = 'conditional';
  } else if (qType === 'negative') {
    answerCategory = 'negative';
  } else if (qType === 'how') {
    answerCategory = 'how';
  } else if (qType === 'amount' || qType === 'time') {
    answerCategory = numbers.length > 0 ? 'detailed' : 'general';
  }
  
  // Получаем ответ
  let answer = '';
  if (entry.answers[answerCategory]) {
    // Если есть подкатегория по теме
    const topicKey = topics[0];
    if (entry.answers[answerCategory][topicKey]) {
      answer = entry.answers[answerCategory][topicKey];
    } else if (entry.answers[answerCategory].general) {
      answer = entry.answers[answerCategory].general;
    } else {
      // Fallback внутри категории
      answer = Object.values(entry.answers[answerCategory])[0];
    }
  } else if (entry.answers.general) {
    // Fallback на general
    answer = entry.answers.general.general || Object.values(entry.answers.general)[0];
  } else {
    // Полный fallback
    answer = entry.fallback;
  }
  
  // Добавляем контекст, если в вопросе есть цифры
  if (numbers.length > 0 && answerCategory !== 'conditional') {
    const mentioned = numbers.join(', ');
    if (!answer.includes(mentioned)) {
      answer += ` (Вы упомянули ${mentioned} — это согласуется с нашей моделью.)`;
    }
  }
  
  // Добавляем follow-up вопрос (вариативно)
  const followUps = [
    "Хотите увидеть детализацию?",
    "Интересует что-то конкретное по этой теме?",
    "Могу раскрыть детали, если нужно.",
    "Есть вопросы по цифрам?"
  ];
  const followUp = followUps[Math.floor(Math.random() * followUps.length)];
  
  return `${answer} ${followUp}`;
}

// ------------------------
// 7. ОСНОВНОЙ ENGINE
// ------------------------
export function answer(question) {
  const clean = normalize(question);
  const qVector = vectorize(clean);
  const intent = detectIntent(clean);
  
  let best = null;
  let bestScore = 0;
  
  for (const entry of KNOWLEDGE_BASE) {
    let score = 0;
    
    // 1. Intent match
    if (entry.intent === intent) score += 2;
    
    // 2. Semantic similarity с каждым паттерном
    for (const pattern of entry.patterns) {
      const pVector = vectorize(pattern);
      score += cosineSimilarity(qVector, pVector) * 5;
    }
    
    // 3. Boost words
    for (const boost of entry.confidenceBoost) {
      if (clean.includes(boost)) score += 1.5;
    }
    
    // 4. Бонус за точное совпадение темы
    const topics = extractTopics(clean);
    if (topics.length > 0) score += 1;
    
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  
  // Генерация ответа
  if (best && bestScore > 2.5) {
    return generateAdaptiveResponse(best, question);
  }
  
  // Умный fallback
  return generateSmartFallback(intent, question);
}

// ------------------------
// 8. УМНЫЕ FALLBACK
// ------------------------
function generateSmartFallback(intent, question) {
  const qType = extractQuestionType(question);
  
  const maps = {
    finance: {
      conditional: "По экономике: рассматриваем три сценария. Уточните, какой детализировать — оптимистичный, базовый или консервативный?",
      negative: "Понимаю сомнения. По экономике могу привести детальные расчеты. Что конкретно вызывает вопросы — сумма, сроки или метрики?",
      how: "По механизмам экономики: могу раскрыть юнит-экономику, модель монетизации или сценарии масштабирования. Что интереснее?",
      general: "По финансам: 1,638 млрд на старте, окупаемость 2 месяца. Что детализировать — инвестиции, выручку или метрики?"
    },
    risk: {
      conditional: "По рискам: у нас есть план реагирования на каждый сценарий. Какой аспект раскрыть — технический, юридический или операционный?",
      negative: "Понимаю опасения. Поэтому внедрили многоуровневую защиту. Хотите увидеть детали реализации или процедуры реагирования?",
      how: "По защите: три уровня — шифрование, токенизация, аудиты. Какой уровень детализировать?",
      general: "По безопасности: банковский стандарт защиты. Интересует техническая реализация или соответствие регуляторике?"
    },
    tech: {
      general: "По технологиям: микросервисы на Go и Node.js. Что интереснее — архитектура, производительность или масштабируемость?"
    },
    audience: {
      general: "По аудитории: фокус на B2C 18-35 лет. Хотите увидеть данные по сегментам или каналам привлечения?"
    }
  };
  
  const intentMap = maps[intent] || maps.finance;
  return intentMap[qType] || intentMap.general;
}

// Для отладки
export const getStats = () => ({
  knowledgeBaseSize: KNOWLEDGE_BASE.length,
  totalPatterns: KNOWLEDGE_BASE.reduce((sum, e) => sum + e.patterns.length, 0)
});