// Очередь воспроизведения mp3-кусков.
// Каждое предложение приходит как base64-mp3 из SSE стрима и попадает сюда.
// Играем строго последовательно. Параллельно с воспроизведением измеряем
// уровень громкости вывода и пробрасываем его наружу через onLevel — это
// нужно для анимации орба.
//
// Используем HTMLAudioElement (а не AudioBufferSourceNode), потому что:
//  - MP3 декодируется браузером "лениво", старт быстрее
//  - проще обрабатывать ошибки
//  - на iOS работает стабильнее

export class AudioQueue {
  constructor({ onLevel, onPlayingChange } = {}) {
    this.queue = [];
    this.playing = false;
    this.onLevel = onLevel || (() => {});
    this.onPlayingChange = onPlayingChange || (() => {});
    this.audioContext = null;
    this.analyser = null;
    this.rafId = null;
    this.currentAudio = null;
    this.currentSourceNode = null;
  }

  _ensureContext() {
    if (this.audioContext) return;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.55;
    this.analyser.connect(this.audioContext.destination);
  }

  _startLevelLoop() {
    if (this.rafId) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      this.analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length / 255;
      this.onLevel(Math.min(1, avg * 2.4));
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  _stopLevelLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.onLevel(0);
  }

  /** Добавить mp3 (base64) в очередь */
  push(base64Mp3) {
    this.queue.push(base64Mp3);
    if (!this.playing) this._playNext();
  }

  async _playNext() {
    if (this.queue.length === 0) {
      this.playing = false;
      this.onPlayingChange(false);
      this._stopLevelLoop();
      return;
    }

    if (!this.playing) {
      this.playing = true;
      this.onPlayingChange(true);
    }

    this._ensureContext();
    // На iOS контекст просыпается только после user gesture — на всякий случай
    if (this.audioContext.state === 'suspended') {
      try { await this.audioContext.resume(); } catch {}
    }

    const base64 = this.queue.shift();
    const audio = new Audio('data:audio/mpeg;base64,' + base64);
    audio.crossOrigin = 'anonymous';
    this.currentAudio = audio;

    // Подключаем audio к analyser
    let sourceNode;
    try {
      sourceNode = this.audioContext.createMediaElementSource(audio);
      sourceNode.connect(this.analyser);
      this.currentSourceNode = sourceNode;
    } catch (e) {
      // У некоторых HTMLAudioElement createMediaElementSource падает повторно — не критично
      console.warn('createMediaElementSource:', e?.message);
    }

    this._startLevelLoop();

    audio.onended = () => {
      try { sourceNode?.disconnect(); } catch {}
      this.currentAudio = null;
      this.currentSourceNode = null;
      this._playNext();
    };
    audio.onerror = (e) => {
      console.error('audio play error', e);
      try { sourceNode?.disconnect(); } catch {}
      this.currentAudio = null;
      this._playNext();
    };

    try {
      await audio.play();
    } catch (err) {
      console.error('audio.play() rejected:', err);
      this._playNext();
    }
  }

  stop() {
    this.queue = [];
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
    }
    if (this.currentSourceNode) {
      try { this.currentSourceNode.disconnect(); } catch {}
    }
    this.currentAudio = null;
    this.currentSourceNode = null;
    this.playing = false;
    this.onPlayingChange(false);
    this._stopLevelLoop();
  }
}
