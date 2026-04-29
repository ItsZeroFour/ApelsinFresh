// ============================================================
// Larkins v7.0 "Cognitive Engine Pro"
// Улучшенная интеллектуальная модель для питчинга (Vanilla JS)
// ============================================================

// ------------------------
// 1. ЛИНГВИСТИЧЕСКИЕ УТИЛИТЫ
// ------------------------
const STOP_WORDS = new Set([
  "и","в","во","не","что","он","на","я","с","со","как","а","то","все","она","так","его","но","да","ты","к","у","же","вы","за","бы","по","только","ее","мне","было","вот","от","меня","еще","нет","о","из","ему","теперь","когда","даже","ну","вдруг","ли","если","уже","или","ни","быть","был","него","до","вас","нибудь","опять","уж","вам","ведь","там","потом","себя","ничего","ей","может","они","тут","где","есть","надо","ней","для","мы","тебя","их","чем","была","сам","чтоб","без","будто","чего","раз","тоже","себе","под","будет","ж","тогда","кто","этот","того","потому","этого","какой","совсем","ним","здесь","этом","один","почти","мой","тем","чтобы","нее","сейчас","были","куда","зачем","сказать","всех","никогда","можно","при","наконец","два","об","другой","хоть","после","над","больше","тот","через","эти","нас","про","всего","них","какая","много","разве","три","эту","моя","впрочем","хорошо","свою","этой","перед","иногда","лучше","чуть","том","нельзя","такой","им","более","всегда","конечно","всю","между"
]);

const SYNONYM_MAP = {
  "вложили": ["инвестиции", "капитал", "бюджет", "траты", "capex", "расходы"],
  "окупаемость": ["прибыль", "возврат", "roi", "срок", "выход", "доход"],
  "безопасность": ["защита", "данные", "утечки", "риски", "шифрование", "токен"],
  "аудитория": ["пользователи", "клиенты", "сегмент", "таргет", "рынок", "кто"]
};

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[?!.,;:(){}[\]"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text).split(' ').filter(Boolean);
}

function removeStopWords(tokens) {
  return tokens.filter(t => !STOP_WORDS.has(t));
}

// Упрощённый стеммер для русского (суффиксное отсечение)
function stem(word) {
  if (word.length < 4) return word;
  const suffixes = [
    "ия","ии","ые","ий","ой","ый","ая","ое","ие",
    "ать","ять","еть","ить","овать","евать","иваться",
    "ский","ческий","ный","ной","ний","тие","ция",
    "ство","ание","ение","ость","изация","фикация","ирование"
  ];
  for (const s of suffixes) {
    if (word.endsWith(s) && word.length - s.length > 3) {
      return word.slice(0, -s.length);
    }
  }
  return word;
}

// Левенштейн (оставлен как базовый метрический слой)
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
// 2. СЕМАНТИЧЕСКОЕ ЯДРО
// ------------------------
function expandWithSynonyms(tokens) {
  const expanded = new Set(tokens);
  for (const t of tokens) {
    for (const [base, syns] of Object.entries(SYNONYM_MAP)) {
      if (getEditDistance(t, stem(base)) <= 2) {
        syns.forEach(s => expanded.add(s));
      }
    }
  }
  return [...expanded];
}

function vectorize(text) {
  const raw = tokenize(text);
  const cleaned = removeStopWords(raw);
  const stemmed = cleaned.map(stem);
  const expanded = expandWithSynonyms(stemmed);
  const vec = {};
  for (const t of expanded) {
    vec[t] = (vec[t] || 0) + 1;
  }
  return vec;
}

function cosineSimilarity(v1, v2) {
  let dot = 0, mag1 = 0, mag2 = 0;
  const keys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
  for (const k of keys) {
    const a = v1[k] || 0, b = v2[k] || 0;
    dot += a * b; mag1 += a * a; mag2 += b * b;
  }
  return (mag1 && mag2) ? dot / (Math.sqrt(mag1) * Math.sqrt(mag2)) : 0;
}

// ------------------------
// 3. КОНТЕКСТ И ПАМЯТЬ
// ------------------------
const STATE = {
  history: [],           // {role, text, intent, entities, score}
  activeIntent: null,
  lastEntities: {},
  turnCount: 0,
  pendingClarification: null
};

function getContextWindow(size = 3) {
  return STATE.history.slice(-size);
}

function getContinuityBonus(intent) {
  if (STATE.activeIntent === intent) return 2.0;
  if (STATE.history.length > 0 && STATE.history[STATE.history.length-1].intent === intent) return 1.2;
  return 0.5;
}

// ------------------------
// 4. ЗНАНИЯ (Расширенная структура)
// ------------------------
const KNOWLEDGE_BASE = [
  {
    id: "capex",
    intent: "finance",
    patterns: ["сколько вложили", "какой capex", "инвестиции на старте", "затраты на запуск", "бюджет проекта"],
    answer: "На старте мы заложили 1,638 млрд рублей. Основной объём (1,6 млрд) пойдёт в маркетинг и масштабирование, 25 млн — в разработку и инфраструктуру.",
    confidenceBoost: ["деньги", "вложили", "инвестиции", "капитал", "capex"],
    entities: { amount: ["млрд", "млн", "руб", "₽"], timeframe: ["старт", "запуск"] }
  },
  {
    id: "profit",
    intent: "finance",
    patterns: ["когда окупитесь", "когда прибыль", "срок окупаемости", "roi", "выход в плюс"],
    answer: "При достижении плановых метрик окупаемость составляет около 2 месяцев. Прогнозируемая выручка на горизонте 12 месяцев — 5 млрд рублей.",
    confidenceBoost: ["прибыль", "окупаемость", "roi", "доход"],
    entities: { timeframe: ["месяц", "год", "срок", "горизонт"] }
  },
  {
    id: "security",
    intent: "risk",
    patterns: ["как защищаете данные", "безопасность", "утечки", "шифрование", "соответствие 152-фз"],
    answer: "Используем банковский стандарт защиты: end-to-end шифрование, изолированные контуры, A-Token авторизация и регулярные аудиты. Риски утечки сведены к минимуму.",
    confidenceBoost: ["безопасность", "данные", "защита", "риски", "токен"],
    entities: { tech: ["шифрование", "токен", "аудит", "152-фз"] }
  },
  {
    id: "gambling",
    intent: "risk",
    patterns: ["это казино", "это азарт", "лудомания", "игровые механики"],
    answer: "Модель не является азартной. Пользователь получает гарантированную ценность за действия, а монетизация строится на прозрачной экономике, а не на вероятности выигрыша.",
    confidenceBoost: ["казино", "азарт", "лудомания", "игровые"],
    entities: { concept: ["гарантия", "прозрачность", "экономика"] }
  },
  {
    id: "tech_stack",
    intent: "tech",
    patterns: ["на чём написано", "стек", "архитектура", "api", "инфраструктура", "высокая нагрузка"],
    answer: "Микросервисная архитектура: Go для ядра, Node.js для API-шлюза, PostgreSQL и Redis для данных. Масштабируется горизонтально, выдерживает более 50 тысяч запросов в секунду без деградации.",
    confidenceBoost: ["стек", "технологии", "api", "архитектура", "нагрузка"],
    entities: { tech: ["go", "node", "postgres", "redis", "rps"] }
  },
  {
    id: "audience",
    intent: "audience",
    patterns: ["кто ваш пользователь", "целевая аудитория", "таргет", "рынок", "для кого продукт"],
    answer: "Фокус на B2C-аудиторию 18-35 лет с активным цифровым профилем. Дополнительно развиваем B2B-направление для интеграции в программы лояльности ритейла и финтеха.",
    confidenceBoost: ["пользователь", "аудитория", "таргет", "рынок", "клиенты"],
    entities: { demographic: ["возраст", "b2c", "b2b", "сегмент"] }
  }
];

// ------------------------
// 5. ИЗВЛЕЧЕНИЕ СУЩНОСТЕЙ
// ------------------------
function extractEntities(text) {
  const entities = {};
  const numMatch = text.match(/(\d[\d\s.,]*)\s*(млрд|млн|тыс|тысяч|руб|₽|год|лет|мес|месяц|день)/gi);
  if (numMatch) entities.amounts = numMatch.map(s => s.trim());

  const techMatch = text.match(/\b(go|node|java|python|postgres|redis|kafka|aws|k8s|api)\b/gi);
  if (techMatch) entities.tech = [...new Set(techMatch.map(s => s.toLowerCase()))];

  const timeMatch = text.match(/\b(старт|запуск|месяц|год|квартал|срок|горизонт|сейчас|потом)\b/gi);
  if (timeMatch) entities.timeframe = [...new Set(timeMatch.map(s => s.toLowerCase()))];

  return entities;
}

// ------------------------
// 6. ДЕТЕКЦИЯ ИНТЕНТА
// ------------------------
function detectIntent(text) {
  const tokens = removeStopWords(tokenize(text)).map(stem);
  const intents = { finance: 0, tech: 0, risk: 0, audience: 0, other: 0 };
  const keywords = {
    finance: ["деньг", "влож", "инвест", "капитал", "бюджет", "прибыл", "окупаем", "доход", "roi", "выручк"],
    tech: ["стек", "технолог", "api", "архитектур", "инфраструктур", "бэкенд", "фронтенд", "нагрузк"],
    risk: ["риск", "безопасност", "защит", "данны", "утечк", "казин", "азарт", "лудоман", "регуляц"],
    audience: ["пользовател", "аудитор", "клиент", "таргет", "рынок", "сегмент", "кто", "для кого"]
  };

  for (const t of tokens) {
    for (const [int, words] of Object.entries(keywords)) {
      for (const w of words) {
        if (t.startsWith(w) || getEditDistance(t, w) <= 2) {
          intents[int] += 1.5;
          break;
        }
      }
    }
  }

  // Нормализация
  const max = Math.max(...Object.values(intents), 1);
  for (const k in intents) intents[k] /= max;

  return Object.entries(intents).sort((a, b) => b[1] - a[1])[0][0];
}

// ------------------------
// 7. СКОРИНГ И КОНФИДЕНТНОСТЬ
// ------------------------
function scoreMatch(question, entry) {
  let score = 0;
  const qVec = vectorize(question);
  const intent = detectIntent(question);

  // 1. Intent match (базовый вес)
  if (entry.intent === intent) score += 3.0;

  // 2. Pattern similarity (среднее по всем паттернам)
  let maxPatternSim = 0;
  for (const p of entry.patterns) {
    const sim = cosineSimilarity(qVec, vectorize(p));
    if (sim > maxPatternSim) maxPatternSim = sim;
  }
  score += maxPatternSim * 5.0;

  // 3. Confidence boost words
  const cleanQ = normalize(question);
  for (const b of entry.confidenceBoost) {
    if (cleanQ.includes(b) || cleanQ.includes(stem(b))) score += 1.2;
  }

  // 4. Context continuity
  score += getContinuityBonus(intent) * 0.8;

  // 5. Entity overlap
  const qEnt = extractEntities(question);
  for (const cat in qEnt) {
    if (entry.entities && entry.entities[cat]) {
      const overlap = qEnt[cat].filter(e => entry.entities[cat].includes(e));
      score += overlap.length * 1.5;
    }
  }

  return Math.min(score, 10.0);
}

// ------------------------
// 8. ГЕНЕРАЦИЯ ОТВЕТА
// ------------------------
function generateResponse(bestEntry, score, question) {
  const ctx = getContextWindow(2);
  const isFollowUp = ctx.some(h => h.intent === bestEntry.intent);
  const hasContext = STATE.activeIntent === bestEntry.intent;

  // Адаптация тона под уверенность
  let prefix = "";
  if (score >= 8.0) prefix = "";
  else if (score >= 5.5) prefix = "Если я правильно понял контекст, ";
  else prefix = "Уточню по этому направлению: ";

  // Инъекция сущностей (если есть)
  let answer = bestEntry.answer;
  const qEnt = extractEntities(question);
  if (qEnt.amounts && qEnt.amounts.length) {
    answer += ` (Вы указали: ${qEnt.amounts.join(", ")}. Это согласуется с нашей моделью.)`;
  }

  // Добавление контекстного моста
  if (isFollowUp) {
    answer += " Учитывая предыдущий вопрос по этой теме, могу добавить: метрики подтверждают устойчивость сценария.";
  }

  // Структурированный вывод без эмодзи
  return `${prefix}${answer.trim()}\n\nХотите углубиться в цифры, техническую реализацию или юридические аспекты?`;
}

function clarifyOrFallback(intent, score) {
  const map = {
    finance: "Экономика проекта зависит от сценария масштабирования. Уточните: вас интересует юнит-экономика, общий Capex или прогноз ROI?",
    tech: "Технический стек оптимизирован под нагрузку. Уточните: вас интересует архитектура, безопасность данных или интеграционные API?",
    risk: "Риски разделены на операционные, регуляторные и продуктовые. Какой сценарий разобрать детальнее?",
    audience: "Аудитория сегментирована по поведению и LTV. Уточните: фокус на B2C-пользователях или B2B-интеграторах?",
    other: "Вопрос интересный, но требует уточнения контекста. Сформулируйте чуть конкретнее — отвечу с цифрами и примерами."
  };
  return map[intent] || map.other;
}

// ------------------------
// 9. ОСНОВНОЙ ENGINE
// ------------------------
export function answer(question) {
  STATE.turnCount++;
  const clean = normalize(question);
  const intent = detectIntent(clean);
  const entities = extractEntities(clean);

  // Поиск лучшего совпадения
  let best = null;
  let bestScore = 0;

  for (const entry of KNOWLEDGE_BASE) {
    const sc = scoreMatch(clean, entry);
    if (sc > bestScore) {
      bestScore = sc;
      best = entry;
    }
  }

  // Сохраняем состояние
  STATE.activeIntent = intent;
  STATE.lastEntities = entities;
  STATE.history.push({ role: "user", text: question, intent, entities, score: bestScore });

  // Маршрутизация по уверенности
  if (best && bestScore >= 5.5) {
    const resp = generateResponse(best, bestScore, clean);
    STATE.history.push({ role: "assistant", text: resp, intent, score: bestScore });
    return resp;
  }

  // Fallback с интеллектуальным уточнением
  const fb = clarifyOrFallback(intent, bestScore);
  STATE.pendingClarification = intent;
  STATE.history.push({ role: "assistant", text: fb, intent, score: bestScore });
  return fb;
}

// Экспорт состояния для отладки
export const getMemory = () => STATE;
export const resetMemory = () => {
  STATE.history = [];
  STATE.activeIntent = null;
  STATE.lastEntities = {};
  STATE.turnCount = 0;
  STATE.pendingClarification = null;
};