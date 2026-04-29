import { Router } from 'express';
import multer from 'multer';
import { parsePdfAndStore } from '../services/pdf.js';

export const uploadRouter = Router();

// Multer — только в памяти, не пишем сырой файл на диск
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Только PDF файлы'), false);
    }
  },
});

// POST /api/upload/pdf — загрузка и парсинг кейса
uploadRouter.post('/pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF файл не найден' });
    }

    console.log(`📥 Получен PDF: ${req.file.originalname} (${req.file.size} байт)`);

    const result = await parsePdfAndStore(req.file.buffer);

    res.json({
      success: true,
      message: 'Ларкинс погрузился в кейс! 🍊',
      stats: result,
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/upload/status — есть ли загруженный контекст
uploadRouter.get('/status', (req, res) => {
  const { getCaseContext } = require('../services/pdf.js');
  const ctx = getCaseContext();
  res.json({
    hasContext: !!ctx,
    chars: ctx?.length ?? 0,
  });
});
