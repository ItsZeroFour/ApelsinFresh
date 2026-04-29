import { useEffect, useRef } from 'react';
import './VoiceOrb.css';

/**
 * Морфирующий оранжевый блоб.
 *
 * @param {string} state    'idle' | 'listening' | 'thinking' | 'speaking'
 * @param {number} level    громкость 0..1 (от микрофона или вывода)
 */
export default function VoiceOrb({ state = 'idle', level = 0 }) {
  const displaceRef = useRef(null);
  const wrapRef = useRef(null);
  const tRef = useRef(0);
  const rafRef = useRef(null);
  const levelRef = useRef(0);

  // плавное сглаживание уровня (чтобы не было дёрганий между rAF тиками)
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    let smoothed = 0;
    const animate = () => {
      tRef.current += 0.016;

      // Плавно подтягиваем сглаженный уровень к актуальному
      smoothed += (levelRef.current - smoothed) * 0.18;

      // Параметры для разных состояний
      let baseDisp, scale, breath;
      switch (state) {
        case 'listening':
          // широкий "зов" — даже без голоса орб живёт, при голосе расширяется
          baseDisp = 12 + Math.sin(tRef.current * 1.4) * 4;
          scale = 1 + smoothed * 0.18;
          breath = 1;
          break;
        case 'thinking':
          // быстрая внутренняя пульсация — "ИИ думает"
          baseDisp = 14 + Math.sin(tRef.current * 4.5) * 6;
          scale = 1 + Math.sin(tRef.current * 3) * 0.04;
          breath = 1;
          break;
        case 'speaking':
          // самый динамичный режим — морфинг + реакция на громкость голоса
          baseDisp = 10 + smoothed * 22 + Math.sin(tRef.current * 2.2) * 3;
          scale = 1 + smoothed * 0.16;
          breath = 1;
          break;
        case 'idle':
        default:
          // спокойное дыхание
          baseDisp = 6 + Math.sin(tRef.current * 0.9) * 2;
          scale = 1 + Math.sin(tRef.current * 0.9) * 0.025;
          breath = 1;
      }

      if (displaceRef.current) {
        displaceRef.current.setAttribute('scale', String(baseDisp));
      }
      if (wrapRef.current) {
        wrapRef.current.style.transform = `scale(${scale * breath})`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state]);

  return (
    <div className={`orb-root orb-state-${state}`}>
      <div className="orb-wrap" ref={wrapRef}>
        <svg viewBox="0 0 400 400" className="orb-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Главный градиент — горячий оранжевый с тёплым светом сверху-слева */}
            <radialGradient id="orbGrad" cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#FFD89E" />
              <stop offset="22%" stopColor="#FFA94D" />
              <stop offset="60%" stopColor="#FF6B1A" />
              <stop offset="100%" stopColor="#E54A0E" />
            </radialGradient>

            {/* Glow слой — мягкая оранжевая аура за орбом */}
            <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF8A3D" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FF8A3D" stopOpacity="0" />
            </radialGradient>

            {/*
              Морфинг края: turbulence генерит шум, displacementMap им искажает контур круга.
              scale задаёт силу искажения и анимируется из JS (см. useEffect).
            */}
            <filter id="orbBlob" x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.011"
                numOctaves="2"
                seed="7"
                result="noise"
              />
              <feDisplacementMap
                ref={displaceRef}
                in="SourceGraphic"
                in2="noise"
                scale="10"
              />
            </filter>

            {/* Лёгкий блик сверху для объёма */}
            <radialGradient id="orbHighlight" cx="35%" cy="28%" r="25%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Внешняя аура */}
          <circle cx="200" cy="200" r="180" fill="url(#orbGlow)" />

          {/* Основной блоб с морфингом */}
          <g filter="url(#orbBlob)">
            <circle cx="200" cy="200" r="135" fill="url(#orbGrad)" />
          </g>

          {/* Блик сверху-слева — даёт ощущение объёма */}
          <ellipse
            cx="170"
            cy="155"
            rx="55"
            ry="28"
            fill="url(#orbHighlight)"
            opacity="0.85"
          />
        </svg>
      </div>
    </div>
  );
}
