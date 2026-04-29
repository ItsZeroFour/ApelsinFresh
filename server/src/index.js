import 'dotenv/config';
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

// Sanity-check на ключи — лучше упасть на старте, чем в рантайме во время питча
const missing = [];
if (!process.env.GROQ_API_KEY) missing.push('GROQ_API_KEY');
if (!process.env.ELEVENLABS_API_KEY) missing.push('ELEVENLABS_API_KEY');
if (!process.env.ELEVENLABS_VOICE_ID) missing.push('ELEVENLABS_VOICE_ID');
if (missing.length) {
  console.error(`[!] Не заданы переменные в .env: ${missing.join(', ')}`);
  console.error('    Скопируй .env.example в .env и заполни.');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`🍊  Larkins server слушает на http://localhost:${PORT}`);
  console.log(`    LLM:  ${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'}`);
  console.log(`    STT:  ${process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo'}`);
  console.log(`    TTS:  ${process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5'}`);
});
