// Rule-based "мозг" Ларкинса — без LLM.
// Логика: токенизируем вопрос, считаем для каждой записи в knowledge.json
// score по количеству совпадающих токенов (с учётом importance), берём лучшую.
// Если ни одна запись не набрала минимальный score — выдаём fallback.
//
// Это намеренно простой подход. Зато:
//   • работает без внешних API
//   • детерминированно — никаких галлюцинаций
//   • latency почти нулевая
//   • для питч-Q&A полностью достаточно

import { getContext } from './knowledge.js';

// Стоп-слова — служебные части речи, которые не несут смысла для матчинга
const STOPWORDS = new Set([
  'и','а','но','или','что','как','где','когда','почему','зачем',
  'это','этот','эта','это','эти','тот','та','то','те','такой','такая',
  'вы','ты','я','мы','он','она','они','оно','свой','своя','своё','свои',
  'на','в','во','с','со','к','ко','от','до','из','за','для','по','при','о','об','у',
  'не','ни','же','ли','бы','б','ведь','вот','уж',
  'есть','быть','был','была','было','были','будет','будут',
  'мне','мной','тебе','тобой','нас','наш','наша','наше','наши',
  'ваш','ваша','ваше','ваши','их','его','её','ему','ей',
  'там','тут','здесь','туда','сюда','оттуда','отсюда','куда','откуда',
  'очень','просто','только','ещё','уже','также','тоже','даже',
  'один','одна','одно','два','три',
  'делать','сделать','говорить','сказать','видеть','знать',
]);

/**
 * Токенизация: lowercase, только буквы/цифры, длиной >= 3, не стоп-слово.
 */
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^a-zа-я0-9]+/i)
    .filter((t) => t && t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Простая основа русского слова — отрезаем типичные окончания.
 * Это не настоящий стеммер (как Porter/Snowball), но для Q&A хватает.
 * Например: "клиенты" / "клиентов" / "клиентами" → все становятся "клиент".
 */
function stem(token) {
  if (token.length <= 4) return token;
  // самые частые окончания русского, в порядке от длинных к коротким
  const endings = [
    'иями','ями','ами','ыми','ого','его','ому','ему','ыми','ими',
    'ой','ей','ом','ем','ах','ях','ов','ев','ий','ый','ая','яя','ое','ее',
    'и','ы','а','я','е','о','у','ю',
  ];
  for (const e of endings) {
    if (token.endsWith(e) && token.length - e.length >= 4) {
      return token.slice(0, -e.length);
    }
  }
  return token;
}

const FALLBACKS = [
  'Точных данных по этому вопросу у меня под рукой нет. Передам команде, ответят после питча.',
  'По этой части лучше уточнить у CEO. Я отвечаю по продукту и продажам.',
  'Хороший вопрос — но конкретику дам после, чтобы не путать цифры.',
];

/**
 * Главная функция: вопрос → ответ.
 * Возвращает строку. Если матч слабый — возвращает fallback.
 */
export function answer(question) {
  const qTokens = tokenize(question).map(stem);
  if (qTokens.length === 0) {
    return FALLBACKS[0];
  }

  const entries = getContext('', 100); // все записи

  let bestScore = 0;
  let bestEntry = null;

  for (const entry of entries) {
    const haystackTokens = tokenize(`${entry.title} ${entry.content}`).map(stem);
    const haystackSet = new Set(haystackTokens);

    let matches = 0;
    for (const qt of qTokens) {
      if (haystackSet.has(qt)) matches++;
    }

    if (matches === 0) continue;

    // Скор: совпадения × importance + бонус за совпадение в title
    const titleTokens = tokenize(entry.title).map(stem);
    const titleMatches = qTokens.filter((qt) => titleTokens.includes(qt)).length;
    const score = matches * (entry.importance || 1) + titleMatches * 3;

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  // Минимальный порог: должно быть хотя бы 1 совпадение со взвешиванием
  if (!bestEntry || bestScore < 2) {
    return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
  }

  // Из content вырезаем плейсхолдеры [ЗАМЕНИ] на случай, если их забыли заполнить
  return bestEntry.content.replace(/\[ЗАМЕНИ\]\s*/g, '').trim();
}
