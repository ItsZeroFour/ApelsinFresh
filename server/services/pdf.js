import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTEXT_FILE = path.join(__dirname, '../context/case-context.txt');
const MAX_CONTEXT_CHARS = 12000; // ~3000 токенов — оставляем место для диалога

// In-memory кэш контекста
let cachedContext = null;

// Загружаем сохранённый контекст при старте
export function initContext() {
  if (fs.existsSync(CONTEXT_FILE)) {
    cachedContext = fs.readFileSync(CONTEXT_FILE, 'utf-8');
    console.log(`📄 Контекст кейса загружен: ${cachedContext.length} символов`);
  } else {
    console.log('⚠️  Контекст кейса не найден. Загрузи PDF через /api/upload');
  }
}

export function getCaseContext() {
  return cachedContext;
}

export async function parsePdfAndStore(buffer) {
  // Динамический импорт pdf-parse (ESM quirk)
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  
  const data = await pdfParse(buffer);
  let text = data.text;

  // Очищаем мусор — лишние пробелы, спецсимволы
  text = text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?;:()%—–\-«»"'а-яёА-ЯЁ]/g, ' ')
    .trim();

  // Обрезаем до лимита
  if (text.length > MAX_CONTEXT_CHARS) {
    text = text.slice(0, MAX_CONTEXT_CHARS) + '\n[...контекст обрезан для производительности]';
  }

  // Сохраняем на диск и в кэш
  const dir = path.dirname(CONTEXT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  fs.writeFileSync(CONTEXT_FILE, text, 'utf-8');
  cachedContext = text;

  return {
    pages: data.numpages,
    chars: text.length,
    preview: text.slice(0, 200) + '...',
  };
}
