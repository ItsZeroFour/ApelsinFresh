// ElevenLabs TTS — голос Ларкинса
// Документация: https://api.elevenlabs.io/docs

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

export async function generateSpeech(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY не задан в .env');
  }

  // Обрезаем текст для TTS (ElevenLabs free: 2500 символов/запрос)
  const truncated = text.length > 2000 ? text.slice(0, 2000) + '...' : text;

  const response = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: truncated,
      model_id: 'eleven_multilingual_v2', // Поддержка русского языка
      voice_settings: {
        stability: 0.4,        // Чуть нестабильно = живее
        similarity_boost: 0.8,
        style: 0.3,            // Немного экспрессии
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs error: ${response.status} — ${err}`);
  }

  // Возвращаем аудио буфер
  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer);
}

// Fallback: список рекомендованных голосов для Ларкинса
export const RECOMMENDED_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam — уверенный, глубокий' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold — авторитетный' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni — молодой, энергичный' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam — резкий, чёткий' },
];
