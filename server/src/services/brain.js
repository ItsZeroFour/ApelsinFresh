// ============================================================
// Larkins v8.0 "Cognitive Engine Ultra"
// Максимально интеллектуальная модель для питчинга (Vanilla JS)
// ============================================================

// ------------------------
// 1. ЛИНГВИСТИЧЕСКОЕ ЯДРО
// ------------------------
const STOP_WORDS = new Set([
  "и","в","во","не","что","он","на","я","с","со","как","а","то","все","она","так","его","но","да","ты","к","у","же","вы","за","бы","по","только","ее","мне","было","вот","от","меня","еще","нет","о","из","ему","теперь","когда","даже","ну","вдруг","ли","если","уже","или","ни","быть","был","него","до","вас","нибудь","опять","уж","вам","ведь","там","потом","себя","ничего","ей","может","они","тут","где","есть","надо","ней","для","мы","тебя","их","чем","была","сам","чтоб","без","будто","чего","раз","тоже","себе","под","будет","ж","тогда","кто","этот","того","потому","этого","какой","совсем","ним","здесь","этом","один","почти","мой","тем","чтобы","нее","сейчас","были","куда","зачем","сказать","всех","никогда","можно","при","наконец","два","об","другой","хоть","после","над","больше","тот","через","эти","нас","про","всего","них","какая","много","разве","три","эту","моя","впрочем","хорошо","свою","этой","перед","иногда","лучше","чуть","том","нельзя","такой","им","более","всегда","конечно","всю","между"
]);

const SYNONYM_MAP = {
  "вложили": ["инвестиции", "капитал", "бюджет", "траты", "capex", "расходы", "финансирование"],
  "окупаемость": ["прибыль", "возврат", "roi", "срок", "выход", "доход", "маржа"],
  "безопасность": ["защита", "данные", "утечки", "риски", "шифрование", "токен", "конфиденциальность"],
  "аудитория": ["пользователи", "клиенты", "сегмент", "таргет", "рынок", "кто", "цА"],
  "технологии": ["стек", "api", "архитектура", "инфраструктура", "бэкенд", "фронтенд", "платформа"]
};

const NEGATION_PREFIXES = ["не", "ни", "без", "исключая", "кроме"];

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[?!.,;:(){}[\]"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text).split(' ').filter(Boolean);
}

function removeStopWords(tokens) {
  return tokens.filter(t => !STOP_WORDS.has(t));
}

function stem(word) {
  if (word.length < 4) return word;
  const suffixes = [
    "ия","ии","ые","ий","ой","ый","ая","ое","ие",
    "ать","ять","еть","ить","овать","евать","иваться",
    "ский","ческий","ный","ной","ний","тие","ция",
    "ство","ание","ение","ость","изация","фикация","ирование","ся","сь"
  ];
  for (const s of suffixes) {
    if (word.endsWith(s) && word.length - s.length > 3) {
      return word.slice(0, -s.length);
    }
  }
  return word;
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

function vectorize(text, useStemming = true) {
  const raw = tokenize(text);
  const cleaned = removeStopWords(raw);
  const processed = useStemming ? cleaned.map(stem) : cleaned;
  const expanded = expandWithSynonyms(processed);
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

function getNgrams(text, n = 2) {
  const tokens = tokenize(text);
  const ngrams = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join('_'));
  }
  return ngrams;
}

// ------------------------
// 3. ИЗВЛЕЧЕНИЕ СУЩНОСТЕЙ
// ------------------------
function extractEntities(text) {
  const entities = {};
  
  // Суммы и валюты
  const moneyMatch = text.match(/(\d[\d\s.,]*)\s*(млрд|млн|тыс|тысяч|руб|₽|долл|доллар|евро)/gi);
  if (moneyMatch) entities.amounts = moneyMatch.map(s => s.trim());
  
  // Проценты
  const percentMatch = text.match(/(\d+\.?\d*)\s*%/g);
  if (percentMatch) entities.percentages = percentMatch;
  
  // Технологии
  const techMatch = text.match(/\b(go|node|java|python|postgres|redis|kafka|aws|k8s|api|rpc|grpc|docker|kubernetes)\b/gi);
  if (techMatch) entities.tech = [...new Set(techMatch.map(s => s.toLowerCase()))];
  
  // Время
  const timeMatch = text.match(/\b(старт|запуск|месяц|год|квартал|срок|горизонт|сейчас|потом|неделя|день)\b/gi);
  if (timeMatch) entities.timeframe = [...new Set(timeMatch.map(s => s.toLowerCase()))];
  
  // Сущности "что/кто/как"
  const questionType = text.match(/^\s*(что|кто|как|почему|когда|где|зачем|если|а\ если)/i);
  if (questionType) entities.questionType = questionType[1].toLowerCase();
  
  // Отрицания
  const hasNegation = NEGATION_PREFIXES.some(prefix => 
    tokenize(text).some((t, i) => t === prefix && i < tokenize(text).length - 1)
  );
  if (hasNegation) entities.negation = true;
  
  return entities;
}

// ------------------------
// 4. КОНТЕКСТ И ПАМЯТЬ
// ------------------------
const STATE = {
  history: [],           // {role, text, intent, entities, score, timestamp}
  activeIntent: null,
  lastEntities: {},
  turnCount: 0,
  pendingClarification: null,
  confidenceHistory: []
};

function getContextWindow(size = 4) {
  return STATE.history.slice(-size);
}

function getRecencyWeight(index, total) {
  // Более свежие сообщения имеют больший вес
  return 0.5 + (index / total) * 0.5;
}

function getContinuityBonus(intent) {
  if (STATE.activeIntent === intent) return 2.5;
  const recent = getContextWindow(2);
  if (recent.some(h => h.intent === intent)) return 1.5;
  return 0.5;
}

function detectContextShift() {
  const recent = getContextWindow(3);
  if (recent.length < 2) return false;
  const intents = recent.map(h => h.intent);
  return new Set(intents).size === intents.length; // Все разные = сдвиг
}

// ------------------------
// 5. ЗНАНИЯ (Расширенная структура)
// ------------------------
const KNOWLEDGE_BASE = [
  {
    id: "capex",
    intent: "finance",
    patterns: [
      "сколько вложили", "какой capex", "инвестиции на старте", 
      "затраты на запуск", "бюджет проекта", "куда ушли деньги",
      "финансирование", "капитал на старте"
    ],
    answer: "На старте мы заложили 1,638 млрд рублей. Основной объём (1,6 млрд) направлен в маркетинг и масштабирование, 25 млн — в разработку и инфраструктуру.",
    confidenceBoost: ["деньги", "вложили", "инвестиции", "капитал", "capex", "бюджет", "финансирование"],
    entities: { amount: ["млрд", "млн", "руб", "₽"], timeframe: ["старт", "запуск"] },
    followUps: ["Хотите увидеть детализацию по статьям расходов?", "Интересует прогноз по дополнительным инвестициям?"]
  },
  {
    id: "profit",
    intent: "finance",
    patterns: [
      "когда окупитесь", "когда прибыль", "срок окупаемости", 
      "roi", "выход в плюс", "маржинальность", "рентабельность"
    ],
    answer: "При достижении плановых метрик окупаемость составляет около 2 месяцев. Прогнозируемая выручка на горизонте 12 месяцев — 5 млрд рублей.",
    confidenceBoost: ["прибыль", "окупаемость", "roi", "доход", "маржа", "рентабельность"],
    entities: { timeframe: ["месяц", "год", "срок", "горизонт"] },
    followUps: ["Хотите увидеть сценарный анализ окупаемости?", "Интересует чувствительность модели к изменениям метрик?"]
  },
  {
    id: "security",
    intent: "risk",
    patterns: [
      "как защищаете данные", "безопасность", "утечки", 
      "шифрование", "соответствие 152-фз", "риски взлома",
      "конфиденциальность", "защита информации"
    ],
    answer: "Используем банковский стандарт защиты: end-to-end шифрование, изолированные контуры, A-Token авторизация и регулярные аудиты. Риски утечки сведены к минимальному уровню.",
    confidenceBoost: ["безопасность", "данные", "защита", "риски", "токен", "шифрование", "152-фз"],
    entities: { tech: ["шифрование", "токен", "аудит", "152-фз"] },
    followUps: ["Хотите подробнее о технической реализации защиты?", "Интересует процедура реагирования на инциденты?"]
  },
  {
    id: "gambling",
    intent: "risk",
    patterns: [
      "это казино", "это азарт", "лудомания", 
      "игровые механики", "зависимость пользователей", "азартная модель"
    ],
    answer: "Модель не является азартной. Пользователь получает гарантированную ценность за действия, а монетизация строится на прозрачной экономике, а не на вероятности выигрыша.",
    confidenceBoost: ["казино", "азарт", "лудомания", "игровые", "зависимость"],
    entities: { concept: ["гарантия", "прозрачность", "экономика"] },
    followUps: ["Хотите увидеть сравнение с регуляторными требованиями?", "Интересует механизм верификации не-азартности?"]
  },
  {
    id: "tech_stack",
    intent: "tech",
    patterns: [
      "на чём написано", "стек", "архитектура", 
      "api", "инфраструктура", "высокая нагрузка",
      "масштабируемость", "производительность"
    ],
    answer: "Микросервисная архитектура: Go для ядра, Node.js для API-шлюза, PostgreSQL и Redis для данных. Масштабируется горизонтально, выдерживает более 50 тысяч запросов в секунду без деградации.",
    confidenceBoost: ["стек", "технологии", "api", "архитектура", "нагрузка", "масштабирование"],
    entities: { tech: ["go", "node", "postgres", "redis", "rps", "k8s"] },
    followUps: ["Хотите увидеть схему архитектуры?", "Интересует стратегия отказоустойчивости?"]
  },
  {
    id: "audience",
    intent: "audience",
    patterns: [
      "кто ваш пользователь", "целевая аудитория", "таргет", 
      "рынок", "для кого продукт", "сегментация",
      "портрет клиента", "цА"
    ],
    answer: "Фокус на B2C-аудиторию 18-35 лет с активным цифровым профилем. Дополнительно развиваем B2B-направление для интеграции в программы лояльности ритейла и финтеха.",
    confidenceBoost: ["пользователь", "аудитория", "таргет", "рынок", "клиенты", "сегмент"],
    entities: { demographic: ["возраст", "b2c", "b2b", "сегмент"] },
    followUps: ["Хотите увидеть данные по вовлечённости сегментов?", "Интересует стратегия расширения аудитории?"]
  }
];

// ------------------------
// 6. ДЕТЕКЦИЯ ИНТЕНТА (МНОГОУРОВНЕВАЯ)
// ------------------------
function detectIntent(text) {
  const tokens = removeStopWords(tokenize(text)).map(stem);
  const ngrams2 = getNgrams(text, 2).map(stem);
  const intents = { finance: 0, tech: 0, risk: 0, audience: 0, other: 0 };
  
  const keywords = {
    finance: ["деньг", "влож", "инвест", "капитал", "бюджет", "прибыл", "окупаем", "доход", "roi", "выручк", "марж", "рентаб"],
    tech: ["стек", "технолог", "api", "архитектур", "инфраструктур", "бэкенд", "фронтенд", "нагрузк", "масштаб", "производит"],
    risk: ["риск", "безопасност", "защит", "данны", "утечк", "казин", "азарт", "лудоман", "регуляц", "соответств"],
    audience: ["пользовател", "аудитор", "клиент", "таргет", "рынок", "сегмент", "кто", "для кого", "цА", "портрет"]
  };

  // Уровень 1: токены
  for (const t of tokens) {
    for (const [int, words] of Object.entries(keywords)) {
      for (const w of words) {
        if (t.startsWith(w) || getEditDistance(t, w) <= 2) {
          intents[int] += 2.0;
          break;
        }
      }
    }
  }
  
  // Уровень 2: биграммы
  for (const ng of ngrams2) {
    for (const [int, words] of Object.entries(keywords)) {
      if (words.some(w => ng.includes(w))) {
        intents[int] += 1.0;
      }
    }
  }
  
  // Уровень 3: контекстный бонус
  if (STATE.activeIntent && intents[STATE.activeIntent] > 0) {
    intents[STATE.activeIntent] += 1.5;
  }
  
  // Нормализация
  const max = Math.max(...Object.values(intents), 1);
  for (const k in intents) intents[k] /= max;
  
  return Object.entries(intents).sort((a, b) => b[1] - a[1])[0][0];
}

// ------------------------
// 7. СКОРИНГ (МНОГОФАКТОРНЫЙ)
// ------------------------
function scoreMatch(question, entry) {
  let score = 0;
  const qVec = vectorize(question);
  const intent = detectIntent(question);
  const qEntities = extractEntities(question);
  
  // Фактор 1: Intent match (вес 3.0)
  if (entry.intent === intent) score += 3.0;
  
  // Фактор 2: Семантическое сходство с паттернами (вес 5.0)
  let maxPatternSim = 0;
  for (const p of entry.patterns) {
    const sim = cosineSimilarity(qVec, vectorize(p));
    if (sim > maxPatternSim) maxPatternSim = sim;
  }
  score += maxPatternSim * 5.0;
  
  // Фактор 3: Boost-слова (вес 1.2 каждое)
  const cleanQ = normalize(question);
  for (const b of entry.confidenceBoost) {
    if (cleanQ.includes(b) || cleanQ.includes(stem(b))) {
      score += 1.2;
    }
  }
  
  // Фактор 4: Контекстная непрерывность (вес до 2.5)
  score += getContinuityBonus(intent) * 0.8;
  
  // Фактор 5: Перекрытие сущностей (вес 1.5 за совпадение)
  for (const cat in qEntities) {
    if (entry.entities && entry.entities[cat]) {
      const overlap = Array.isArray(qEntities[cat]) 
        ? qEntities[cat].filter(e => entry.entities[cat].includes(e))
        : [];
      score += overlap.length * 1.5;
    }
  }
  
  // Фактор 6: Бонус за точные совпадения паттернов
  for (const p of entry.patterns) {
    if (cleanQ.includes(normalize(p))) {
      score += 2.0;
      break;
    }
  }
  
  // Фактор 7: Штраф за сдвиг контекста (если вопрос резко меняет тему)
  if (detectContextShift() && entry.intent !== intent) {
    score *= 0.85;
  }
  
  return Math.min(score, 12.0); // Cap для стабильности
}

// ------------------------
// 8. ГЕНЕРАЦИЯ ОТВЕТА (АДАПТИВНАЯ)
// ------------------------
function generateResponse(bestEntry, score, question) {
  const ctx = getContextWindow(3);
  const isFollowUp = ctx.some(h => h.intent === bestEntry.intent);
  const qEntities = extractEntities(question);
  
  // Адаптивный префикс по уровню уверенности
  let prefix = "";
  if (score >= 9.0) {
    prefix = "";
  } else if (score >= 7.0) {
    prefix = "";
  } else if (score >= 5.5) {
    prefix = "Если я правильно понял контекст, ";
  } else {
    prefix = "Уточню по этому направлению: ";
  }
  
  // Базовый ответ
  let answer = bestEntry.answer;
  
  // Инъекция сущностей из вопроса (если релевантно)
  if (qEntities.amounts && qEntities.amounts.length && bestEntry.entities?.amount) {
    answer += ` (Вы указали: ${qEntities.amounts.join(", ")}. Это согласуется с нашей моделью.)`;
  }
  
  // Контекстный мост (если это продолжение темы)
  if (isFollowUp && ctx.length > 1) {
    answer += " Учитывая предыдущий вопрос по этой теме, могу добавить: метрики подтверждают устойчивость сценария.";
  }
  
  // Обработка отрицаний (если вопрос содержит "не")
  if (qEntities.negation) {
    answer = "Важный нюанс: " + answer;
  }
  
  // Структурированное завершение с вариантами развития
  const followUpOptions = bestEntry.followUps?.[Math.floor(Math.random() * bestEntry.followUps.length)];
  const ending = followUpOptions 
    ? `\n\n${followUpOptions}`
    : "\n\nХотите углубиться в цифры, техническую реализацию или юридические аспекты?";
  
  return `${prefix}${answer.trim()}${ending}`;
}

function clarifyOrFallback(intent, score, question) {
  // Адаптивное уточнение на основе типа вопроса
  const qEntities = extractEntities(question);
  const questionType = qEntities.questionType;
  
  const clarifications = {
    finance: {
      what: "По экономике: уточните, вас интересуют стартовые инвестиции, операционные расходы или прогноз выручки?",
      how: "По механизмам экономики: хотите разобрать юнит-экономику, модель монетизации или сценарии масштабирования?",
      if: "По сценариям: рассматриваем базовый, оптимистичный и стресс-сценарий. Какой детализировать?",
      default: "Экономика проекта зависит от сценария масштабирования. Уточните: вас интересует юнит-экономика, общий Capex или прогноз ROI?"
    },
    tech: {
      what: "По технологиям: интересует стек, архитектура или интеграционные возможности?",
      how: "По реализации: хотите увидеть схему взаимодействия сервисов или метрики производительности?",
      if: "По сценариям: рассматриваем нагрузку в 10к, 50к или 100к RPS. Какой уровень детализировать?",
      default: "Технический стек оптимизирован под нагрузку. Уточните: вас интересует архитектура, безопасность данных или интеграционные API?"
    },
    risk: {
      what: "По рискам: интересуют операционные, регуляторные или продуктовые аспекты?",
      how: "По защите: хотите увидеть техническую реализацию или процедуры реагирования?",
      if: "По сценариям: рассматриваем профилактику, детектирование или восстановление. Что детализировать?",
      default: "Риски разделены на операционные, регуляторные и продуктовые. Какой сценарий разобрать детальнее?"
    },
    audience: {
      what: "По аудитории: интересует портрет пользователя, каналы привлечения или метрики удержания?",
      how: "По сегментации: хотите увидеть разбивку по демографии, поведению или LTV?",
      if: "По гипотезам: рассматриваем расширение в смежные сегменты или углубление в текущие. Что приоритетно?",
      default: "Аудитория сегментирована по поведению и LTV. Уточните: фокус на B2C-пользователях или B2B-интеграторах?"
    },
    other: {
      default: "Вопрос интересный, но требует уточнения контекста. Сформулируйте чуть конкретнее — отвечу с цифрами и примерами."
    }
  };
  
  const intentClar = clarifications[intent] || clarifications.other;
  return intentClar[questionType] || intentClar.default;
}

// ------------------------
// 9. ОСНОВНОЙ ENGINE
// ------------------------
export function answer(question) {
  STATE.turnCount++;
  const clean = normalize(question);
  const intent = detectIntent(clean);
  const entities = extractEntities(clean);
  
  // Поиск лучшего совпадения с многофакторным скорингом
  let best = null;
  let bestScore = 0;
  
  for (const entry of KNOWLEDGE_BASE) {
    const sc = scoreMatch(clean, entry);
    if (sc > bestScore) {
      bestScore = sc;
      best = entry;
    }
  }
  
  // Адаптация порога уверенности на основе истории
  const avgConfidence = STATE.confidenceHistory.length > 0
    ? STATE.confidenceHistory.reduce((a, b) => a + b, 0) / STATE.confidenceHistory.length
    : 6.0;
  const dynamicThreshold = Math.max(5.0, Math.min(7.5, avgConfidence - 1.0));
  
  // Сохраняем состояние
  STATE.activeIntent = intent;
  STATE.lastEntities = entities;
  STATE.confidenceHistory.push(bestScore);
  if (STATE.confidenceHistory.length > 10) STATE.confidenceHistory.shift();
  
  STATE.history.push({ 
    role: "user", 
    text: question, 
    intent, 
    entities, 
    score: bestScore,
    timestamp: Date.now()
  });
  
  // Маршрутизация по динамическому порогу уверенности
  if (best && bestScore >= dynamicThreshold) {
    const resp = generateResponse(best, bestScore, clean);
    STATE.history.push({ 
      role: "assistant", 
      text: resp, 
      intent, 
      score: bestScore,
      timestamp: Date.now()
    });
    return resp;
  }
  
  // Fallback с интеллектуальным уточнением
  const fb = clarifyOrFallback(intent, bestScore, clean);
  STATE.pendingClarification = intent;
  STATE.history.push({ 
    role: "assistant", 
    text: fb, 
    intent, 
    score: bestScore,
    timestamp: Date.now()
  });
  return fb;
}

// Экспорт состояния для отладки/мониторинга
export const getMemory = () => ({
  ...STATE,
  history: STATE.history.map(h => ({...h})) // Копия для безопасности
});

export const resetMemory = () => {
  STATE.history = [];
  STATE.activeIntent = null;
  STATE.lastEntities = {};
  STATE.turnCount = 0;
  STATE.pendingClarification = null;
  STATE.confidenceHistory = [];
};

// Утилита для симуляции "размышления" (опционально)
export function simulateThinking(minMs = 300, maxMs = 900) {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}