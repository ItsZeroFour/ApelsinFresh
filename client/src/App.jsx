import { useEffect, useRef, useState } from 'react';
import VoiceOrb from './components/VoiceOrb.jsx';
import { AudioQueue } from './lib/audioQueue.js';
import { postSSE } from './lib/sse.js';

export default function App() {
  // 'idle' | 'listening' | 'thinking' | 'speaking'
  const [state, setState] = useState('idle');
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);

  const audioQueueRef = useRef(null);
  const recognitionRef = useRef(null);
  const abortRef = useRef(null);
  // Чтобы анимировать орб во время listening, симулируем уровень
  const fakeLevelRafRef = useRef(null);

  // Инициализация
  useEffect(() => {
    // 1. Проверяем поддержку Web Speech API
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      setError('Распознавание речи не поддерживается в этом браузере. Используй Chrome или Edge.');
      return;
    }

    // 2. Audio queue для воспроизведения mp3 от ElevenLabs
    audioQueueRef.current = new AudioQueue({
      onLevel: (l) => setLevel(l),
      onPlayingChange: (isPlaying) => {
        setState((prev) => {
          if (isPlaying) return 'speaking';
          return prev === 'speaking' ? 'idle' : prev;
        });
      },
    });

    return () => {
      audioQueueRef.current?.stop();
      abortRef.current?.abort();
      stopFakeLevel();
      try { recognitionRef.current?.abort(); } catch {}
    };
  }, []);

  /** Симуляция уровня для анимации орба во время прослушивания */
  const startFakeLevel = () => {
    let phase = 0;
    const tick = () => {
      phase += 0.05;
      // имитация дыхания + случайные пики (как будто пользователь говорит)
      const base = 0.3 + Math.sin(phase) * 0.2;
      const noise = Math.random() * 0.15;
      setLevel(Math.min(1, base + noise));
      fakeLevelRafRef.current = requestAnimationFrame(tick);
    };
    fakeLevelRafRef.current = requestAnimationFrame(tick);
  };
  const stopFakeLevel = () => {
    if (fakeLevelRafRef.current) cancelAnimationFrame(fakeLevelRafRef.current);
    fakeLevelRafRef.current = null;
    setLevel(0);
  };

  /** START — пользователь зажал кнопку */
  const startRecording = () => {
    if (state === 'listening' || state === 'thinking' || !supported) return;

    audioQueueRef.current?.stop();
    abortRef.current?.abort();
    setError('');
    setResponse('');
    setTranscript('');

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onstart = () => {
      setState('listening');
      startFakeLevel();
    };
    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += t;
        else interim += t;
      }
      setTranscript(finalTranscript || interim);
    };
    recognition.onerror = (e) => {
      stopFakeLevel();
      console.error('SpeechRecognition error:', e.error);
      if (e.error === 'no-speech') {
        setError('Не услышал. Попробуй ещё раз.');
      } else if (e.error === 'not-allowed') {
        setError('Доступ к микрофону запрещён. Разреши в настройках браузера.');
      } else if (e.error === 'aborted') {
        // юзер сам прервал — не ошибка
      } else {
        setError(`Ошибка распознавания: ${e.error}`);
      }
      setState('idle');
    };
    recognition.onend = () => {
      stopFakeLevel();
      const userText = finalTranscript.trim() || transcript.trim();
      if (!userText) {
        setState('idle');
        return;
      }
      setTranscript(userText);
      submitToBackend(userText);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.error(err);
      setError('Не удалось запустить распознавание');
      setState('idle');
    }
  };

  /** STOP — пользователь отпустил кнопку */
  const stopRecording = () => {
    const r = recognitionRef.current;
    if (!r) return;
    try {
      r.stop(); // отправит onend с накопленным результатом
    } catch {}
  };

  /** Отправка распознанного текста на бэк */
  const submitToBackend = async (userText) => {
    setState('thinking');
    try {
      const ac = new AbortController();
      abortRef.current = ac;

      let assistantText = '';
      await postSSE(
        '/api/chat',
        { message: userText },
        (event, data) => {
          if (event === 'text' && data?.delta) {
            assistantText += data.delta;
            setResponse(assistantText);
          } else if (event === 'audio' && data?.mp3) {
            audioQueueRef.current?.push(data.mp3);
          } else if (event === 'error') {
            setError(data?.message || 'Ошибка генерации');
          }
        },
        ac.signal,
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setError('Что-то пошло не так. Попробуй ещё раз.');
      }
      setState('idle');
    }
  };

  const buttonHandlers = {
    onPointerDown: (e) => { e.preventDefault(); startRecording(); },
    onPointerUp: () => stopRecording(),
    onPointerCancel: () => stopRecording(),
    onPointerLeave: () => { if (state === 'listening') stopRecording(); },
  };

  return (
    <div className="app">
      <header className="head">
        <h1 className="brand-name">Ларкинс</h1>
        <p className="brand-sub">Apelsin Fresh</p>
      </header>

      <div className="orb-stage">
        <VoiceOrb state={state} level={level} />
      </div>

      <div className="caption">
        {transcript && <p className="caption-q">«{transcript}»</p>}
        {response && <p className="caption-a">{response}</p>}
        {!transcript && !response && state === 'idle' && (
          <p className="caption-hint">Зажми кнопку и задай вопрос</p>
        )}
        {state === 'listening' && <p className="caption-hint">Слушаю…</p>}
        {state === 'thinking' && !response && <p className="caption-hint">Думаю…</p>}
        {error && <p className="caption-error">{error}</p>}
      </div>

      <div className="controls">
        <button
          className={`mic-btn mic-${state}`}
          {...buttonHandlers}
          disabled={!supported}
          aria-label="Удерживай чтобы говорить"
        >
          <MicIcon />
        </button>
        <p className="mic-hint">удерживай чтобы говорить</p>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
