// ============================================================
// Larkins v6.0 "Cognitive Engine"
// Реальная интеллектуальная модель для питчинга
// ============================================================

// ------------------------
// 1. УТИЛИТЫ
// ------------------------

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[?!.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text).split(' ');
}

// Левенштейн (оставляем — это твоя фишка)
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
// 2. СЕМАНТИЧЕСКОЕ СХОДСТВО (упрощённый embedding)
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
  let dot = 0;
  let mag1 = 0;
  let mag2 = 0;

  const keys = new Set([...Object.keys(v1), ...Object.keys(v2)]);

  for (const key of keys) {
    const a = v1[key] || 0;
    const b = v2[key] || 0;

    dot += a * b;
    mag1 += a * a;
    mag2 += b * b;
  }

  if (mag1 === 0 || mag2 === 0) return 0;

  return dot / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

// ------------------------
// 3. KNOWLEDGE BASE (расширенная)
// ------------------------

const KNOWLEDGE_BASE = [
  {
    id: "capex",
    intent: "finance",
    patterns: [
      "сколько вложили",
      "какой capex",
      "инвестиции на старте",
      "затраты на запуск"
    ],
    answer: "Мы заложили 1.638 млрд рублей. 1.6 млрд — маркетинг, 25 млн — разработка.",
    confidenceBoost: ["деньги", "вложили", "инвестиции"]
  },

  {
    id: "profit",
    intent: "finance",
    patterns: [
      "когда окупитесь",
      "когда прибыль",
      "срок окупаемости"
    ],
    answer: "Окупаемость — 2 месяца при достижении целевых метрик. Выручка — 5 млрд.",
    confidenceBoost: ["прибыль", "окупаемость"]
  },

  {
    id: "security",
    intent: "risk",
    patterns: [
      "как защищаете данные",
      "безопасность",
      "утечки"
    ],
    answer: "Используется банковский уровень защиты через A-Token. Риски утечки минимизированы.",
    confidenceBoost: ["безопасность", "данные"]
  },

  {
    id: "gambling",
    intent: "risk",
    patterns: [
      "это казино",
      "это азарт",
      "лудомания"
    ],
    answer: "Нет, это не азартная модель. Пользователь получает гарантированную выгоду.",
    confidenceBoost: ["казино", "азарт"]
  }
];

// ------------------------
// 4. INTENT DETECTION
// ------------------------

function detectIntent(question) {
  const tokens = tokenize(question);

  const intents = {
    finance: 0,
    tech: 0,
    risk: 0,
    audience: 0
  };

  const map = {
    finance: ["деньги", "прибыль", "окупаемость", "вложили"],
    tech: ["стек", "технологии", "api"],
    risk: ["риск", "безопасность", "утечки", "казино"],
    audience: ["кто", "пользователь", "аудитория"]
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
// 5. КОНТЕКСТ (диалог)
// ------------------------

const CONTEXT = {
  lastIntent: null,
  history: []
};

// ------------------------
// 6. ОСНОВНОЙ ENGINE
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

    // 2. Semantic similarity
    for (const pattern of entry.patterns) {
      const pVector = vectorize(pattern);
      score += cosineSimilarity(qVector, pVector) * 5;
    }

    // 3. Boost words
    for (const boost of entry.confidenceBoost) {
      if (clean.includes(boost)) score += 1.5;
    }

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  CONTEXT.lastIntent = intent;
  CONTEXT.history.push(question);

  // ------------------------
  // 7. CONFIDENCE CONTROL
  // ------------------------

  if (best && bestScore > 2.5) {
    return best.answer;
  }

  return generateSmartFallback(intent);
}

// ------------------------
// 8. УМНЫЕ FALLBACK
// ------------------------

function generateSmartFallback(intent) {
  const map = {
    finance: "Вопрос про экономику — уточню точные цифры у команды, чтобы не ошибиться.",
    tech: "Технический вопрос — могу раскрыть глубже, если уточним архитектурный уровень.",
    risk: "Это важный риск-блок. Могу раскрыть детали после уточнения сценария.",
    audience: "По аудитории можем углубиться — уточните сегмент."
  };

  return map[intent] || "Интересный вопрос. Давайте чуть уточним, чтобы ответить максимально точно.";
}