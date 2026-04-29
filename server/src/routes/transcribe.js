// Этот эндпоинт больше не нужен — STT теперь делает браузер через Web Speech API.
// Оставляем заглушку, чтобы старый фронт получал понятную ошибку, а не 404.

import { Router } from 'express';
const router = Router();

router.post('/', (_req, res) => {
  res.status(410).json({
    error: 'transcribe больше не используется. Распознавание речи теперь в браузере.',
  });
});

export default router;
