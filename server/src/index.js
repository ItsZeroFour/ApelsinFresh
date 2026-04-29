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

// Sanity-check — теперь нужен только ElevenLabs (STT в браузере, "мозг" локальный)
const missing = [];
if (!process.env.ELEVENLABS_API_KEY) missing.push('ELEVENLABS_API_KEY');
if (!process.env.ELEVENLABS_VOICE_ID) missing.push('ELEVENLABS_VOICE_ID');
if (missing.length) {
  console.error(`[!] Не заданы переменные в .env: ${missing.join(', ')}`);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`🍊  Larkins server слушает на http://localhost:${PORT}`);
  console.log(`    STT:  Web Speech API (в браузере)`);
  console.log(`    Brain: rule-based (knowledge.json)`);
  console.log(`    TTS:  ElevenLabs · ${process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5'}`);
});
