import { Router } from 'express';
import { askLarkins, askLarkinsStream } from '../services/groq.js';

export const chatRouter = Router();

// POST /api/chat — обычный запрос
chatRouter.post('/', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    const reply = await askLarkins(message, history);
    res.json({ reply, timestamp: new Date().toISOString() });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ 
      error: 'Ларкинс временно недоступен',
      detail: err.message 
    });
  }
});

// POST /api/chat/stream — Server-Sent Events для real-time стриминга
chatRouter.post('/stream', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    // Устанавливаем SSE заголовки
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = await askLarkinsStream(message, history);

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('Stream error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});
