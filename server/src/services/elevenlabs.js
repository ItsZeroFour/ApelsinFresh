// ElevenLabs TTS через нативный fetch — без SDK, чтобы не тащить лишнее.
// Используем endpoint /v1/text-to-speech/{voice_id} с output_format=mp3_44100_64
// (44.1кГц, 64kbps — оптимум по скорости/качеству для речи).

const TTS_API_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';

export async function textToSpeech(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const model = process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5';

  if (!apiKey || !voiceId) {
    throw new Error('ELEVENLABS_API_KEY или ELEVENLABS_VOICE_ID не заданы в .env');
  }

  const url = `${TTS_API_BASE}/${voiceId}?output_format=mp3_44100_64`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.4, // чуть больше энергии в голосе — характер "энергичного эксперта"
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
