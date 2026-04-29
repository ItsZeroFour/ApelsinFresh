import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.js';
import { uploadRouter } from './routes/upload.js';
import { ttsRouter } from './routes/tts.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ——— Маршруты ———
app.use('/api/chat', chatRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/tts', ttsRouter);

// Статус
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Ларкинс API', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`🍊 Ларкинс запущен на http://localhost:${PORT}`);
});
