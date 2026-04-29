import { useEffect, useRef, useState } from 'react';
import VoiceOrb from './components/VoiceOrb.jsx';
import { Recorder } from './lib/recorder.js';
import { AudioQueue } from './lib/audioQueue.js';
import { postSSE } from './lib/sse.js';

export default function App() {
  // 'idle' | 'listening' | 'thinking' | 'speaking'
  const [state, setState] = useState('idle');
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  const recorderRef = useRef(null);
  const audioQueueRef = useRef(null);
  const historyRef = useRef([]); // [{role, content}]
  const abortRef = useRef(null);

  // Инициализируем audio queue один раз
  useEffect(() => {
    audioQueueRef.current = new AudioQueue({
      onLevel: (l) => {
        // setLevel вызывается часто — оборачиваем для производительности
        setLevel(l);
      },
      onPlayingChange: (isPlaying) => {
        setState((prev) => {
          if (isPlaying) return 'speaking';
          // конец воспроизведения → idle (если только мы не пишем уже новый вопрос)
          return prev === 'speaking' ? 'idle' : prev;
        });
      },
    });
    return () => {
      audioQueueRef.current?.stop();
      abortRef.current?.abort();
    };
  }, []);

  /** START — пользователь зажал кнопку */
  const startRecording = async () => {
    if (state === 'listening' || state === 'thinking') return;

    // Если Ларкинс ещё говорит — прерываем и слушаем юзера
    audioQueueRef.current?.stop();
    abortRef.current?.abort();

    setError('');
    setResponse('');
    setTranscript('');

    try {
      const recorder = new Recorder({ onLevel: setLevel });
      recorderRef.current = recorder;
      await recorder.start();
      setState('listening');
    } catch (err) {
      setError('Не удалось получить доступ к микрофону. Проверь разрешения в браузере.');
      console.error(err);
      setState('idle');
    }
  };

  /** STOP — пользователь отпустил кнопку */
  const stopAndSubmit = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;

    setState('thinking');
    const blob = await recorder.stop();

    // Если запись слишком короткая (<300мс) — игнорим, скорее всего случайный тап
    if (blob.size < 4000) {
      setState('idle');
      return;
    }

    try {
      // 1. Транскрибируем
      const form = new FormData();
      form.append('audio', blob, 'voice.webm');
      const trRes = await fetch('/api/transcribe', { method: 'POST', body: form });
      if (!trRes.ok) throw new Error('Не удалось распознать речь');
      const { text } = await trRes.json();
      const userText = (text || '').trim();
      if (!userText) {
        setState('idle');
        return;
      }
      setTranscript(userText);

      // 2. Стримим ответ
      historyRef.current.push({ role: 'user', content: userText });

      const ac = new AbortController();
      abortRef.current = ac;

      let assistantText = '';
      await postSSE(
        '/api/chat',
        { message: userText, history: historyRef.current.slice(0, -1) },
        (event, data) => {
          if (event === 'text' && data?.delta) {
            assistantText += data.delta;
            setResponse(assistantText);
          } else if (event === 'audio' && data?.mp3) {
            audioQueueRef.current?.push(data.mp3);
          } else if (event === 'error') {
            setError(data?.message || 'Ошибка генерации');
          } else if (event === 'done') {
            // Сохраняем ответ в историю
            historyRef.current.push({ role: 'assistant', content: assistantText });
            // Обрезаем историю до 6 последних сообщений
            if (historyRef.current.length > 6) {
              historyRef.current = historyRef.current.slice(-6);
            }
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

  // PointerEvents — единый код для touch и mouse
  const buttonHandlers = {
    onPointerDown: (e) => {
      e.preventDefault();
      startRecording();
    },
    onPointerUp: () => stopAndSubmit(),
    onPointerCancel: () => stopAndSubmit(),
    onPointerLeave: () => {
      // если палец увели за кнопку — всё равно отправляем
      if (state === 'listening') stopAndSubmit();
    },
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
        {transcript && (
          <p className="caption-q">
            «{transcript}»
          </p>
        )}
        {response && (
          <p className="caption-a">
            {/* {response} */}
          </p>
        )}
        {!transcript && !response && state === 'idle' && (
          <p className="caption-hint">Зажми кнопку и задай вопрос</p>
        )}
        {state === 'listening' && (
          <p className="caption-hint">Слушаю…</p>
        )}
        {state === 'thinking' && !response && (
          <p className="caption-hint">Думаю…</p>
        )}
        {error && <p className="caption-error">{error}</p>}
      </div>

      <div className="controls">
        <button
          className={`mic-btn mic-${state}`}
          {...buttonHandlers}
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
