// Запись с микрофона + измерение громкости в реальном времени.
// onLevel(0..1) колбэк вызывается ~30 раз в секунду — этим уровнем мы кормим
// VoiceOrb для анимации.

export class Recorder {
  constructor({ onLevel } = {}) {
    this.onLevel = onLevel || (() => {});
    this.mediaRecorder = null;
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.rafId = null;
    this.chunks = [];
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Анализ громкости
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.6;
    source.connect(this.analyser);

    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      this.analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length / 255; // нормализуем 0..1
      this.onLevel(Math.min(1, avg * 2.2)); // лёгкое усиление для отзывчивости
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);

    // MediaRecorder. Браузер сам выберет формат: webm на Chrome/Firefox, mp4 на Safari.
    const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
    this.mediaRecorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  /** Останавливает запись и возвращает Promise<Blob>. */
  async stop() {
    return new Promise((resolve) => {
      const finish = () => {
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });
        this._cleanup();
        resolve(blob);
      };
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        return finish();
      }
      this.mediaRecorder.onstop = finish;
      this.mediaRecorder.stop();
    });
  }

  _cleanup() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    this.stream = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.analyser = null;
    this.onLevel(0);
  }
}
