// Лёгкий RAG-поиск в локальной базе знаний.
// Логика взята из оригинального Flask-эндпоинта /api/v1/get-context:
// substring-match по title и content, сортировка по importance (desc), затем по id.
//
// Для маленькой базы (до ~50 записей) этого хватает с головой и работает мгновенно.
// Если база разрастётся — заменить на векторный поиск (например, через @xenova/transformers + cosine).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB_PATH = path.resolve(__dirname, '../../knowledge.json');

let cache = null;

function loadKb() {
  if (cache) return cache;
  const raw = readFileSync(KB_PATH, 'utf-8');
  cache = JSON.parse(raw);
  return cache;
}

/**
 * Возвращает релевантный контекст для запроса.
 * Если query пустой — возвращает все записи (полный контекст для system prompt).
 *
 * @param {string} query    запрос пользователя (строка после Whisper)
 * @param {number} maxItems предохранитель — сколько записей максимум вернуть
 */
export function getContext(query = '', maxItems = 20) {
  const kb = loadKb();
  const q = (query || '').trim().toLowerCase();

  let entries = kb;
  if (q) {
    // 1) сначала пробуем substring-match
    const matched = kb.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q),
    );
    // 2) если что-то нашли — возвращаем только это
    //    если ничего не нашли — отдаём ВСЕ записи (бот сам разберётся, что важно)
    entries = matched.length > 0 ? matched : kb;
  }

  // Сортировка как в оригинальном Flask: importance desc, потом id (как прокси для created_at)
  entries = [...entries].sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return b.id - a.id;
  });

  return entries.slice(0, maxItems);
}

/**
 * Форматирует записи для system prompt в формате исходного проекта:
 *   [Категория] Заголовок: содержимое
 */
export function formatContext(entries) {
  return entries
    .map((e) => `[${e.category}] ${e.title}: ${e.content}`)
    .join('\n\n');
}
