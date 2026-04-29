import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// .env ищем относительно расположения этого файла (server/.env), а НЕ относительно cwd процесса.
// Иначе при запуске через pm2 / systemd / из другой папки .env может не найтись.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import transcribeRoute from './routes/transcribe.js';
import chatRoute from './routes/chat.js';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: false,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'Larkins · Apelsin Fresh' }));

app.use('/api/transcribe', transcribeRoute);
app.use('/api/chat', chatRoute);

const PORT = process.env.PORT || 3001;

// Sanity-check — теперь вообще никаких внешних API не нужно.
// STT в браузере, TTS в браузере, "мозг" локальный.
// Оставляю только проверку что .env загрузился (на всякий случай).

app.listen(PORT, () => {
  console.log(`🍊  Larkins server слушает на http://localhost:${PORT}`);
  console.log(`    STT:   Web Speech API (в браузере)`);
  console.log(`    Brain: rule-based (knowledge.json)`);
  console.log(`    TTS:   Web Speech Synthesis (в браузере)`);
});