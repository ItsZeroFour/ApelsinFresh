import { useEffect, useRef, useState } from 'react';
import VoiceOrb from './components/VoiceOrb.jsx';

export default function App() {
  // 'idle' | 'listening' | 'thinking' | 'speaking'
  const [state, setState] = useState('idle');
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef(null);
  const fakeLevelRafRef = useRef(null);
  // ru-RU голос для speechSynthesis выбираем один раз
  const voiceRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const synthAvailable = 'speechSynthesis' in window;

    if (!SpeechRecognition || !synthAvailable) {
      setSupported(false);
      setError('Голосовой режим работает в Chrome, Edge или Yandex Browser.');
      return;
    }

    // Голоса грузятся асинхронно. Подписываемся на загрузку и выбираем русский.
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Ищем лучший русский: сначала Microsoft / Google neural, потом любой ru
      const ranked = voices
        .filter((v) => /ru[-_]?RU|russian/i.test(`${v.lang} ${v.name}`))
        .sort((a, b) => {
          const score = (v) =>
            (/Microsoft.*Pavel|Microsoft.*Dmitry/i.test(v.name) ? 100 : 0) +
            (/Microsoft.*Irina|Microsoft.*Svetlana/i.test(v.name) ? 90 : 0) +
            (/Google/i.test(v.name) ? 80 : 0) +
            (/neural|natural/i.test(v.name) ? 50 : 0);
          return score(b) - score(a);
        });
      voiceRef.current = ranked[0] || null;
      if (voiceRef.current) {
        console.log('TTS voice:', voiceRef.current.name, voiceRef.current.lang);
      }
    };
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;

    return () => {
      try { recognitionRef.current?.abort(); } catch {}
      try { window.speechSynthesis.cancel(); } catch {}
      stopFakeLevel();
    };
  }, []);

  const startFakeLevel = (mode) => {
    stopFakeLevel();
    let phase = 0;
    const tick = () => {
      phase += mode === 'listening' ? 0.05 : 0.09;
      const base = mode === 'listening' ? 0.3 : 0.45;
      const wave = Math.sin(phase) * 0.18 + Math.sin(phase * 2.1) * 0.1;
      const noise = Math.random() * 0.15;
      setLevel(Math.min(1, base + wave + noise));
      fakeLevelRafRef.current = requestAnimationFrame(tick);
    };
    fakeLevelRafRef.current = requestAnimationFrame(tick);
  };
  const stopFakeLevel = () => {
    if (fakeLevelRafRef.current) cancelAnimationFrame(fakeLevelRafRef.current);
    fakeLevelRafRef.current = null;
    setLevel(0);
  };

  const startRecording = () => {
    if (state === 'listening' || state === 'thinking' || !supported) return;

    // Прерываем озвучку если сейчас говорит
    try { window.speechSynthesis.cancel(); } catch {}
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
      startFakeLevel('listening');
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
      if (e.error === 'no-speech') setError('Не услышал. Попробуй ещё раз.');
      else if (e.error === 'not-allowed') setError('Разреши микрофон в настройках браузера.');
      else if (e.error !== 'aborted') setError(`Ошибка распознавания: ${e.error}`);
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

  const stopRecording = () => {
    const r = recognitionRef.current;
    if (!r) return;
    try { r.stop(); } catch {}
  };

  /** Отправка распознанного текста на бэк → ответ → озвучка через speechSynthesis */
  const submitToBackend = async (userText) => {
    setState('thinking');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });
      if (!res.ok) throw new Error(`server ${res.status}`);
      const { text } = await res.json();
      setResponse(text);
      speak(text);
    } catch (err) {
      console.error(err);
      setError('Что-то пошло не так. Попробуй ещё раз.');
      setState('idle');
    }
  };

  /** Озвучка через нативный browser TTS */
  const speak = (text) => {
    if (!('speechSynthesis' in window)) {
      setState('idle');
      return;
    }
    try { window.speechSynthesis.cancel(); } catch {}

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ru-RU';
    utter.rate = 1.05;   // чуть быстрее обычного — энергичный эксперт
    utter.pitch = 1.0;
    utter.volume = 1.0;
    if (voiceRef.current) utter.voice = voiceRef.current;

    utter.onstart = () => {
      setState('speaking');
      startFakeLevel('speaking');
    };
    utter.onend = () => {
      stopFakeLevel();
      setState('idle');
    };
    utter.onerror = (e) => {
      console.error('TTS error:', e);
      stopFakeLevel();
      setState('idle');
    };

    window.speechSynthesis.speak(utter);
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