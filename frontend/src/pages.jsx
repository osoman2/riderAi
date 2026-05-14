import React, { useState, useEffect, useRef } from 'react';
import { SPORTS, READINESS, tl, StatusPill, CapChip, ScoreRing, MiniChart } from './core.jsx';
import { analyzeSession, listSessions, deleteSession, checkHealth } from './api.js';

// ── Hero Canvas animation ─────────────────────────────────────────────────────

function HeroCanvas({ colorHex }) {
  const ref = React.useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf, t = 0;
    const r = parseInt(colorHex.slice(1, 3), 16);
    const g = parseInt(colorHex.slice(3, 5), 16);
    const b = parseInt(colorHex.slice(5, 7), 16);

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    const nodes = Array.from({ length: 16 }, () => ({
      x: Math.random() * 1200, y: Math.random() * 320,
      vx: (Math.random() - 0.5) * 0.38, vy: (Math.random() - 0.5) * 0.38,
    }));

    function draw() {
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(34,34,34,0.55)';
      for (let x = 0; x < W; x += 52) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 52) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const cx = W * 0.74, cy = H * 0.44;
      for (let i = 0; i < 5; i++) {
        const phase = ((t * 0.42 + i * 0.2) % 1);
        const rad = phase * Math.max(W, H) * 0.65;
        const alpha = (1 - phase) * 0.18;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.lineWidth = 1.5; ctx.stroke();
      }
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220);
      grd.addColorStop(0, `rgba(${r},${g},${b},0.08)`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 190) {
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - d / 190) * 0.11})`;
            ctx.lineWidth = 0.7; ctx.stroke();
          }
        }
        ctx.beginPath(); ctx.arc(nodes[i].x, nodes[i].y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.32)`; ctx.fill();
      }
      t += 0.016;
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [colorHex]);

  return (
    <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.75 }} />
  );
}

function PulsingDot({ delay = 0, color = '#ef4444', size = 7 }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setOn(true);
      const id = setInterval(() => setOn(o => !o), 900);
      return () => clearInterval(id);
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: on ? color : color + '30',
      boxShadow: on ? `0 0 8px ${color}` : 'none',
      transition: 'all 0.4s ease', flexShrink: 0,
    }} />
  );
}

function LiveSignal({ sport, lang, colorHex }) {
  const [active, setActive] = useState(0);
  const PIPELINES = {
    downhill: [{ en: 'Upload', es: 'Subir' }, { en: 'Pose', es: 'Pose' }, { en: 'Terrain', es: 'Terreno' }, { en: 'Line', es: 'Línea' }, { en: 'Guidance', es: 'Guía' }],
    karting:  [{ en: 'Upload', es: 'Subir' }, { en: 'Perception', es: 'Percepción' }, { en: 'Segment', es: 'Segmentar' }, { en: 'Geometry', es: 'Geometría' }, { en: 'Score', es: 'Score' }, { en: 'Guidance', es: 'Guía' }],
    surf:     [{ en: 'Upload', es: 'Subir' }, { en: 'Wave', es: 'Ola' }, { en: 'Balance', es: 'Equilibrio' }, { en: 'Tags', es: 'Tags' }, { en: 'Guidance', es: 'Guía' }],
  };
  const nodes = PIPELINES[sport] || PIPELINES.downhill;

  useEffect(() => {
    setActive(0);
    const id = setInterval(() => setActive(a => (a + 1) % nodes.length), 780);
    return () => clearInterval(id);
  }, [sport, nodes.length]);

  const r = parseInt(colorHex.slice(1, 3), 16);
  const g = parseInt(colorHex.slice(3, 5), 16);
  const b = parseInt(colorHex.slice(5, 7), 16);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 28, flexWrap: 'wrap', rowGap: 8 }}>
      {nodes.map((node, i) => {
        const on = i === active;
        const done = i < active;
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: on ? `rgb(${r},${g},${b})` : done ? `rgba(${r},${g},${b},0.45)` : '#222',
                boxShadow: on ? `0 0 10px rgba(${r},${g},${b},0.8)` : 'none',
                transition: 'all 0.35s',
              }} />
              <span style={{
                fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.06em',
                color: on ? `rgb(${r},${g},${b})` : done ? `rgba(${r},${g},${b},0.55)` : '#3a3a3a',
                transition: 'color 0.35s',
              }}>{node[lang] || node.en}</span>
            </div>
            {i < nodes.length - 1 && (
              <div style={{ width: 18, height: 1, background: done ? `rgba(${r},${g},${b},0.5)` : '#222', margin: '0 2px', transition: 'background 0.35s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function SportCard({ sp, active, lang, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 10,
        border: `1px solid ${active ? sp.color + '80' : hov ? '#222222cc' : '#22222255'}`,
        background: active ? sp.color + '0c' : hov ? '#0f0f0f' : '#111111',
        padding: '24px 22px', cursor: 'pointer',
        transition: 'all 0.25s', position: 'relative', overflow: 'hidden',
      }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: active ? sp.color : 'transparent', transition: 'all 0.25s',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{
          fontFamily: 'Space Mono, monospace', fontSize: 20,
          color: active ? sp.color : '#3a3a3a',
          letterSpacing: '-0.01em', transition: 'color 0.25s',
        }}>
          {sp.abbr}
        </div>
        <StatusPill readiness={sp.readiness} lang={lang} />
      </div>
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, fontWeight: 600, color: '#EDEDE8', marginBottom: 4 }}>
        {tl(sp.label, lang)}
      </div>
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: '#6b6b6b', marginBottom: 18, lineHeight: 1.4 }}>
        {tl(sp.tagline, lang)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {sp.capabilities.map(cap => (
          <CapChip key={cap.id} cap={cap} sport={sp.id} lang={lang} compact />
        ))}
      </div>
    </div>
  );
}

export function OverviewPage({ state, setState }) {
  const { sport, lang } = state;

  return (
    <div style={{ padding: '52px 0 0', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px' }}>

        {/* Hero */}
        <div style={{
          position: 'relative', borderRadius: 12, overflow: 'hidden',
          padding: '44px 40px 38px', marginBottom: 48,
          marginLeft: -8, marginRight: -8,
          border: '1px solid #22222255', background: '#080808',
        }}>
          <HeroCanvas colorHex={SPORTS[sport].colorHex} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', letterSpacing: '0.14em', marginBottom: 20 }}>
              DRIVER FEEDBACK — VIDEO TO NEXT ACTION
            </div>
            <h1 style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 'clamp(36px, 5vw, 60px)',
              fontWeight: 700, color: '#EDEDE8',
              margin: '0 0 12px', lineHeight: 1.08, letterSpacing: '-0.02em',
            }}>
              {lang === 'es' ? 'Sube tu sesión.' : 'Upload your session.'}<br />
              <span style={{ color: '#3a3a3a' }}>
                {lang === 'es' ? 'Sal con 3 cosas que mejorar.' : 'Leave with 3 things to improve.'}
              </span>
            </h1>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, color: '#6b6b6b', maxWidth: 460, lineHeight: 1.65, margin: '0 0 28px' }}>
              {lang === 'es'
                ? 'Para riders y pilotos: revisa postura, línea, uso de pista/sendero y momentos clave sin perderte en métricas vacías.'
                : 'For riders and drivers: review posture, line choice, track/trail use and key moments without drowning in empty metrics.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setState(s => ({ ...s, page: 'analyze' }))}
                style={{
                  background: SPORTS[sport].color, border: 'none', borderRadius: 6,
                  padding: '11px 26px', cursor: 'pointer',
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 600,
                  color: '#080808', transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                {lang === 'es' ? 'Analizar sesión →' : 'Analyze session →'}
              </button>
              <button
                onClick={() => setState(s => ({ ...s, page: 'demos' }))}
                style={{
                  background: 'none', border: '1px solid #22222270', borderRadius: 6,
                  padding: '11px 22px', cursor: 'pointer',
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: 14,
                  color: '#6b6b6b', transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#EDEDE8'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#22222270'; e.currentTarget.style.color = '#6b6b6b'; }}>
                {lang === 'es' ? 'Ver demos' : 'View demos'}
              </button>
            </div>
            <LiveSignal sport={sport} lang={lang} colorHex={SPORTS[sport].colorHex} />
          </div>
        </div>

        {/* Live capture strip */}
        <div
          onClick={() => setState(s => ({ ...s, page: 'live' }))}
          style={{
            marginBottom: 24, padding: '16px 22px',
            border: '1px solid #ef444328', borderRadius: 8, background: '#ef44440a',
            display: 'flex', alignItems: 'center', gap: 16,
            cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef444455'; e.currentTarget.style.background = '#ef444412'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#ef444328'; e.currentTarget.style.background = '#ef44440a'; }}>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {[0, 1, 2].map(i => <PulsingDot key={i} delay={i * 180} color="#ef4444" />)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 600, color: '#EDEDE8', marginBottom: 2 }}>
              {lang === 'es' ? 'Captura en dispositivo edge' : 'Edge device capture'}
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b' }}>
              GoPro · Insta360 · Smartphone — {lang === 'es' ? 'resultados en ~30s' : 'results in ~30s'}
            </div>
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#ef6444', letterSpacing: '0.08em' }}>
            {lang === 'es' ? 'CONECTAR →' : 'CONNECT →'}
          </div>
        </div>

        {/* Sport cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 48 }}>
          {Object.values(SPORTS).map(s => (
            <SportCard key={s.id} sp={s} active={sport === s.id} lang={lang}
              onClick={() => setState(st => ({ ...st, sport: s.id }))} />
          ))}
        </div>

        {/* Athlete value strip */}
        <div style={{
          padding: '18px 22px', border: '1px solid #222', borderRadius: 8,
          background: '#0f0f0f', display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#9a9a9a', letterSpacing: '0.1em', flexShrink: 0 }}>
            {lang === 'es' ? 'LO QUE RECIBES' : 'WHAT YOU GET'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(lang === 'es'
              ? ['video anotado', 'momentos clave', 'scores simples', 'siguiente práctica']
              : ['annotated video', 'key moments', 'simple scores', 'next practice']).map(k => (
              <span key={k} style={{
                fontFamily: 'Space Mono, monospace', fontSize: 10,
                color: '#aaa', background: '#161616',
                border: '1px solid #222', borderRadius: 4, padding: '3px 9px',
              }}>{k}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Analyze ───────────────────────────────────────────────────────────────────

// ── Camera modes per sport ────────────────────────────────────────────────────
// Each entry: { id, label, icon, desc, outputs[], available, comingSoon?, color }
const CAMERA_MODES = {
  downhill: [
    {
      id: 'drone_follow',
      label: { en: 'FPV / Follow Drone', es: 'Drone FPV / Seguimiento' },
      icon: '🚁',
      desc: {
        en: 'Drone follows rider from above/behind. Best DH view for posture + trail line: body is visible and the riding corridor can be reviewed.',
        es: 'Drone sigue al rider desde arriba/atrás. Mejor vista DH para postura + línea: se ve el cuerpo y se puede revisar el corredor del sendero.',
      },
      outputs: ['POSTURA', 'SENDERO', 'LÍNEA'],
      available: true,
      color: '#f59e0b',
    },
    {
      id: 'helmet_cam',
      label: { en: 'Helmet / Body Cam', es: 'Cámara de Casco / Cuerpo' },
      icon: '⛑️',
      desc: {
        en: 'First-person GoPro view. Good for trail ahead, obstacles and line preview. Full-body posture is mostly not observable.',
        es: 'Vista GoPro en primera persona. Buena para sendero adelante, obstáculos y previsualización de línea. La pose completa casi no es observable.',
      },
      outputs: ['SENDERO', 'OBSTÁCULOS', 'LÍNEA'],
      available: true,
      color: '#f59e0b',
    },
    {
      id: 'drone_front_overhead',
      label: { en: 'Front / Overhead Drone', es: 'Drone Frontal / Cenital' },
      icon: '🛸',
      desc: {
        en: 'Front-facing or top-down drone. Keep separate from follow drone: stronger for trajectory/map geometry, weaker for posture detail.',
        es: 'Drone frontal o cenital. Mejor separado del seguimiento: fuerte para trayectoria/geometría de mapa, más débil para detalle postural.',
      },
      outputs: ['TRAYECTORIA', 'SENDERO', 'SECCIONES'],
      available: true,
      experimental: true,
      color: '#f59e0b',
    },
    {
      id: 'static_tripod',
      label: { en: 'Static Cam / Tripod', es: 'Cámara Fija / Trípode' },
      icon: '🎥',
      desc: {
        en: 'Fixed camera covering one feature or corner. Useful for repeated checkpoint analysis; not a full-run line model.',
        es: 'Cámara fija en un obstáculo o curva. Útil para análisis repetido de checkpoint; no modela toda la bajada.',
      },
      outputs: ['POSTURA', 'CHECKPOINT'],
      available: false,
      comingSoon: true,
      color: '#f59e0b',
    },
  ],
  karting: [
    {
      id: 'fpv_follow',
      label: { en: 'FPV / Follow Drone', es: 'Drone FPV / Seguimiento' },
      icon: '🚁',
      desc: {
        en: 'Drone follows kart from above/behind. Best for kart detection, track area, lateral position and line consistency. Human pose is not useful here.',
        es: 'Drone sigue al kart desde arriba/atrás. Mejor para detectar kart, zona de pista, posición lateral y consistencia. La pose humana no aporta mucho.',
      },
      outputs: ['LÍNEA', 'ANCHO', 'KARTS'],
      available: true,
      color: '#1fa84a',
    },
    {
      id: 'action_cam',
      label: { en: 'GoPro / Action Cam', es: 'GoPro / Cámara de Acción' },
      icon: '📷',
      desc: {
        en: 'Helmet/kart first-person view. Good for track ahead, kerbs and gap to visible karts. Own-kart position is inferred from view geometry.',
        es: 'Vista primera persona desde casco/kart. Buena para pista adelante, kerbs y gap a karts visibles. La posición propia se infiere por geometría de vista.',
      },
      outputs: ['PISTA', 'GAP', 'KERB L/R'],
      available: true,
      color: '#22d3ee',
    },
    {
      id: 'overhead_drone',
      label: { en: 'Overhead / Cenital Drone', es: 'Drone Cenital / Overhead' },
      icon: '🛸',
      desc: {
        en: 'Top-down drone view of a circuit/sector. Best for trajectory geometry, multi-kart detection and sector comparison; less useful for driver POV gap.',
        es: 'Vista cenital de circuito/sector. Mejor para geometría de trayectoria, detección multi-kart y comparación por sector; menos para gap subjetivo.',
      },
      outputs: ['TRAZADA', 'SECTORES', 'KARTS'],
      available: false,
      comingSoon: true,
      color: '#8b5cf6',
    },
  ],
  surf: [
    {
      id: 'beach_static',
      label: { en: 'Static Beach / Cliff Cam', es: 'Cámara de Playa / Acantilado' },
      icon: '🎥',
      desc: {
        en: 'Fixed camera on beach or cliff. Full wave view with rider trajectory — optimal for maneuver detection, wave phase tagging, and timing.',
        es: 'Cámara fija en playa o acantilado. Vista completa de la ola con trayectoria del rider — óptima para detección de maniobras y fase de ola.',
      },
      outputs: ['WAVE PHASE', 'TRAJECTORY', 'MANEUVERS'],
      available: false,
      comingSoon: true,
      color: '#14b8a6',
    },
    {
      id: 'aerial_drone',
      label: { en: 'Aerial Follow Drone', es: 'Drone Aéreo de Seguimiento' },
      icon: '🚁',
      desc: {
        en: 'Drone follows surfer from above. Best coverage for wave selection, paddling efficiency, peak positioning, and reading sets.',
        es: 'Drone sigue al surfer desde arriba. Mejor cobertura para selección de ola, eficiencia de palada y posicionamiento en el pico.',
      },
      outputs: ['WAVE SELECT', 'PADDLE EFF.', 'POSITIONING'],
      available: false,
      comingSoon: true,
      color: '#14b8a6',
    },
    {
      id: 'water_cam',
      label: { en: 'Water / GoPro (Board)', es: 'Cámara en el Agua / GoPro' },
      icon: '🤿',
      desc: {
        en: 'Camera mounted on board or in the water. Close-up view for stance analysis, tube riding detection. Limited wave context.',
        es: 'Cámara montada en la tabla o en el agua. Vista de cerca para análisis de postura, detección de tubo. Contexto de ola limitado.',
      },
      outputs: ['STANCE', 'TUBE TIME'],
      available: false,
      comingSoon: true,
      color: '#14b8a6',
    },
  ],
};

// Default SAM3/SAM2 segmentation prompts per sport + camera
const DEFAULT_PROMPTS = {
  downhill: {
    drone_follow: 'mountain bike dirt trail path downhill terrain surface',
    helmet_cam:   'mountain bike dirt trail path slope terrain ahead',
    drone_front_overhead: 'mountain bike downhill trail corridor top view dirt path',
    static_tripod:'mountain bike trail dirt path terrain',
  },
  karting: {
    fpv_follow:     'asphalt racing circuit karting track road surface',
    action_cam:     'asphalt road karting track surface ahead',
    overhead_drone: 'asphalt karting circuit track surface top view',
  },
  surf: {
    beach_static: 'ocean wave surf break water surface',
    aerial_drone: 'ocean wave surf water surface aerial',
    water_cam:    'ocean wave surfboard water close',
  },
};

const CAMERA_METHODOLOGY = {
  downhill: {
    drone_follow: {
      title: { en: 'Posture and line, in context', es: 'Postura y línea, con contexto' },
      current: {
        en: 'You get body-position cues, balance moments and where the rider drifts from the chosen line.',
        es: 'Recibes señales de posición corporal, momentos de balance y dónde el rider se sale de la línea elegida.',
      },
      next: {
        en: 'Premium also tries to isolate the rideable trail corridor, so the line review has terrain context.',
        es: 'Premium también intenta aislar el corredor transitable del sendero para que la revisión de línea tenga contexto real.',
      },
      athlete: { en: ['body position', 'line drift', 'commitment timing'], es: ['posición corporal', 'deriva de línea', 'momento de compromiso'] },
    },
    helmet_cam: {
      title: { en: 'GoPro: what is coming next', es: 'GoPro: lo que viene adelante' },
      current: {
        en: 'You get a rider-facing review of visible trail, risk moments and line choices from the cockpit view.',
        es: 'Recibes una revisión desde la vista del rider: sendero visible, momentos de riesgo y decisiones de línea.',
      },
      next: {
        en: 'Premium focuses on trail surface and obstacles. Full-body posture is not scored because the body is mostly off camera.',
        es: 'Premium se enfoca en superficie del sendero y obstáculos. No califica postura completa porque el cuerpo casi no aparece.',
      },
      athlete: { en: ['obstacles ahead', 'line preview', 'risk moments'], es: ['obstáculos adelante', 'línea próxima', 'momentos de riesgo'] },
    },
    drone_front_overhead: {
      title: { en: 'Trajectory through the section', es: 'Trayectoria por la sección' },
      current: {
        en: 'You get a section-level view: entry, exit and how direct or costly the chosen path looks.',
        es: 'Recibes una vista por sección: entrada, salida y qué tan directa o costosa se ve la trayectoria.',
      },
      next: {
        en: 'Premium uses trail isolation for map geometry: corridor, sections and entry/exit choices.',
        es: 'Premium usa aislamiento del sendero para geometría de mapa: corredor, secciones y decisiones de entrada/salida.',
      },
      athlete: { en: ['trajectory shape', 'section choice', 'entry/exit line'], es: ['forma de trayectoria', 'elección de sección', 'entrada/salida'] },
    },
    static_tripod: {
      title: { en: 'Fixed cam: checkpoint repetition', es: 'Cámara fija: repetición de checkpoint' },
      current: {
        en: 'Useful when you repeat the same feature and want to compare entry, body timing and exit quality.',
        es: 'Útil cuando repites el mismo obstáculo y quieres comparar entrada, timing corporal y calidad de salida.',
      },
      next: {
        en: 'Best for checkpoint feedback, not for judging the complete descent from one angle.',
        es: 'Mejor para feedback de checkpoint, no para juzgar toda la bajada desde un solo ángulo.',
      },
      athlete: { en: ['same feature repeat', 'body timing', 'exit quality'], es: ['repetición del obstáculo', 'timing corporal', 'calidad de salida'] },
    },
  },
  karting: {
    fpv_follow: {
      title: { en: 'Drone: kart + track geometry', es: 'Dron: kart + geometría de pista' },
      current: {
        en: 'You get line consistency, track-width use and how disciplined the kart stays near edges and exits.',
        es: 'Recibes consistencia de línea, uso del ancho de pista y qué tan disciplinado va el kart en bordes y salidas.',
      },
      next: {
        en: 'The focus is kart and track behavior, not driver body pose.',
        es: 'El foco es el comportamiento kart/pista, no la postura corporal del piloto.',
      },
      athlete: { en: ['line consistency', 'track width use', 'edge discipline'], es: ['consistencia de línea', 'uso del ancho', 'disciplina de borde'] },
    },
    action_cam: {
      title: { en: 'GoPro: visible karts + kerbs', es: 'GoPro: karts visibles + kerbs' },
      current: {
        en: 'You get gap to visible karts, kerb use and line decisions from the driver view.',
        es: 'Recibes gap a karts visibles, uso de kerb y decisiones de línea desde la vista del piloto.',
      },
      next: {
        en: 'SAM isolates the track ahead, but own-kart position is still inferred from view geometry. Overhead drone is better for full race geometry.',
        es: 'SAM aísla la pista adelante, pero la posición propia aún se infiere por geometría de vista. El dron cenital es mejor para geometría completa de carrera.',
      },
      athlete: { en: ['gap ahead', 'kerb use', 'driver POV decisions'], es: ['gap adelante', 'uso de kerb', 'decisiones POV'] },
    },
    overhead_drone: {
      title: { en: 'Overhead: race geometry', es: 'Cenital: geometría de carrera' },
      current: {
        en: 'Best for comparing trajectories, sectors and overtaking zones across multiple karts.',
        es: 'Mejor para comparar trayectorias, sectores y zonas de sobrepaso entre varios karts.',
      },
      next: {
        en: 'Less personal than GoPro, stronger for race structure and line comparison.',
        es: 'Menos personal que GoPro, más fuerte para estructura de carrera y comparación de trazadas.',
      },
      athlete: { en: ['sector comparison', 'overtake zones', 'race line'], es: ['comparación por sector', 'zonas de sobrepaso', 'línea de carrera'] },
    },
  },
};

function defaultReviewTier(sport, cameraMode) {
  if (sport === 'karting') return 'premium';
  if (sport === 'downhill' && cameraMode === 'helmet_cam') return 'premium';
  if (sport === 'downhill' && cameraMode === 'drone_front_overhead') return 'premium';
  return 'fast';
}

function reviewOptionsFor({ sport, cameraMode, sc, lang }) {
  if (sport === 'downhill' && cameraMode === 'helmet_cam') {
    return [
      {
        id: 'fast',
        label: { en: 'POV Line Review', es: 'Revision POV de Linea' },
        model: 'POV',
        estimate: '~30-60s',
        desc: {
          en: 'Quick rider-view review: visible trail, line decisions and risk moments. No body-pose score because the full rider is not visible.',
          es: 'Revision rapida desde la vista del rider: sendero visible, decisiones de linea y momentos de riesgo. Sin score de postura porque no se ve el cuerpo completo.',
        },
        tags: lang === 'es' ? ['linea', 'riesgo', 'sin pose'] : ['line', 'risk', 'no pose'],
        color: sc.color,
        available: true,
      },
      {
        id: 'premium',
        label: { en: 'Trail + Obstacles', es: 'Sendero + Obstaculos' },
        model: 'SAM',
        estimate: '~2-6 min',
        desc: {
          en: 'Uses SAM with a camera-specific preset prompt to isolate rideable trail, obstacles and the next line. This is the strongest GoPro DH mode.',
          es: 'Usa SAM con prompt predefinido para esta camara: aisla sendero transitable, obstaculos y linea proxima. Es el modo GoPro DH mas fuerte.',
        },
        tags: lang === 'es' ? ['SAM3/SAM2', 'prompt fijo', 'sendero'] : ['SAM3/SAM2', 'preset prompt', 'trail'],
        color: sc.color,
        available: true,
      },
    ];
  }

  if (sport === 'downhill' && cameraMode === 'drone_front_overhead') {
    return [
      {
        id: 'fast',
        label: { en: 'Trajectory Review', es: 'Revision de Trayectoria' },
        model: 'LINE',
        estimate: '~45-90s',
        desc: {
          en: 'Reviews path, section choice and line stability from a front or overhead drone. Posture detail is secondary from this angle.',
          es: 'Revisa trayectoria, eleccion de secciones y estabilidad de linea desde dron frontal o cenital. La postura es secundaria en este angulo.',
        },
        tags: lang === 'es' ? ['trayectoria', 'secciones', 'linea'] : ['trajectory', 'sections', 'line'],
        color: sc.color,
        available: true,
      },
      {
        id: 'premium',
        label: { en: 'Trail Geometry', es: 'Geometria del Sendero' },
        model: 'SAM',
        estimate: '~2-6 min',
        desc: {
          en: 'Adds SAM trail isolation to understand corridor width, obstacles and section geometry with more visual context.',
          es: 'Agrega SAM para aislar sendero y entender ancho del corredor, obstaculos y geometria de secciones con mas contexto visual.',
        },
        tags: lang === 'es' ? ['SAM3/SAM2', 'corredor', 'secciones'] : ['SAM3/SAM2', 'corridor', 'sections'],
        color: sc.color,
        available: true,
      },
    ];
  }

  if (sport === 'downhill') {
    return [
      {
        id: 'fast',
        label: { en: 'Posture + Line', es: 'Postura + Linea' },
        model: 'POSE',
        estimate: '~45-90s',
        desc: {
          en: 'Best when a drone follows from behind/above and the full rider is visible: posture, balance, line drift and commitment moments.',
          es: 'Ideal cuando el dron sigue desde atras/arriba y se ve el rider completo: postura, balance, deriva de linea y momentos de decision.',
        },
        tags: lang === 'es' ? ['postura', 'linea', 'rapido'] : ['posture', 'line', 'quick'],
        color: sc.color,
        available: true,
      },
      {
        id: 'basic',
        label: { en: 'Complete Review', es: 'Revision Completa' },
        model: 'FULL',
        estimate: '~1-2 min',
        desc: {
          en: 'Combines the pose pass with line efficiency, terrain context and a session summary. It does not add SAM trail masks.',
          es: 'Combina postura con eficiencia de linea, contexto de terreno y resumen de sesion. No agrega mascara SAM del sendero.',
        },
        tags: lang === 'es' ? ['resumen', 'tendencia', 'scores'] : ['summary', 'trend', 'scores'],
        color: '#6b7280',
        available: true,
      },
      {
        id: 'premium',
        label: { en: 'Trail + Obstacles', es: 'Sendero + Obstaculos' },
        model: 'SAM',
        estimate: '~2-6 min',
        desc: {
          en: 'Adds SAM trail isolation to the drone review: rideable corridor, obstacles and line choice with richer visual context.',
          es: 'Agrega aislamiento SAM a la revision con dron: corredor transitable, obstaculos y eleccion de linea con mas contexto visual.',
        },
        tags: lang === 'es' ? ['SAM3/SAM2', 'sendero', 'linea'] : ['SAM3/SAM2', 'trail', 'line'],
        color: sc.color,
        available: true,
      },
    ];
  }

  return [
    {
      id: 'fast',
      label: { en: 'Fast', es: 'Rapido' },
      model: 'HSV',
      estimate: '~10-30s',
      desc: { en: 'Pure color filter. No AI, no GPU needed. Instant results.', es: 'Filtro de color puro. Sin IA, sin GPU. Resultados instantaneos.' },
      tags: ['instant', 'no GPU', 'HSV'],
      color: '#22c55e',
      available: true,
    },
    {
      id: 'basic',
      label: { en: 'Basic', es: 'Basico' },
      model: 'SAM2',
      estimate: '~1-3 min',
      desc: { en: 'Coordinate-prompted. Calibrates HSV from AI mask. Any GPU.', es: 'Basado en coordenadas. Calibra HSV desde mascara IA. Cualquier GPU.' },
      tags: ['~5s calib', '6 GB VRAM', 'SAM2'],
      color: '#6b7280',
      available: true,
    },
    {
      id: 'premium',
      label: { en: 'Premium', es: 'Premium' },
      model: 'SAM3',
      estimate: '~2-6 min',
      desc: { en: 'Text-prompted, semantic and camera-aware. Best mask quality.', es: 'Basado en texto, semantico y adaptado a camara. Mejor calidad de mascara.' },
      tags: ['~10s calib', '12 GB VRAM', 'SAM3.1'],
      color: sc.color,
      available: true,
    },
  ];
}

function activeCapabilitiesFor(sc, sport, cameraMode, lang) {
  if (sport !== 'downhill') return sc.capabilities;
  const trailIsolation = {
    id: 'trail_isolation',
    label: { en: 'Trail Isolation', es: 'Aislamiento de Sendero' },
    live: true,
  };
  if (cameraMode === 'helmet_cam') {
    return [
      { id: 'line', label: { en: 'Line Review', es: 'Revision de Linea' }, live: true },
      trailIsolation,
      { id: 'obstacles', label: { en: 'Obstacle Cues', es: 'Senales de Obstaculos' }, live: true },
      { id: 'playback', label: { en: 'Session Playback', es: 'Reproduccion' }, live: true },
    ];
  }
  if (cameraMode === 'drone_front_overhead') {
    return [
      { id: 'trajectory', label: { en: 'Trajectory Review', es: 'Revision de Trayectoria' }, live: true },
      trailIsolation,
      { id: 'sections', label: { en: 'Section Review', es: 'Revision de Secciones' }, live: true },
      { id: 'playback', label: { en: 'Session Playback', es: 'Reproduccion' }, live: true },
    ];
  }
  return sc.capabilities;
}

export function AnalyzePage({ state, setState }) {
  const { sport, lang, demo, backendOnline } = state;
  const [step, setStep] = useState('upload');
  const [drag, setDrag] = useState(false);
  const [tick, setTick] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState('');
  const [cameraMode, setCameraMode] = useState(() => {
    // Default to first available camera for each sport
    const modes = CAMERA_MODES[sport] || [];
    const first = modes.find(m => m.available) || modes[0];
    return first ? first.id : 'fpv_follow';
  });
  const [segTier, setSegTier] = useState(() => defaultReviewTier(sport, cameraMode)); // 'fast' | 'basic' | 'premium'
  const [everyN, setEveryN] = useState(3);
  const [showPromptConfig, setShowPromptConfig] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  // Local flag: set synchronously when we confirm backend is live for THIS run.
  // Avoids relying on the async global backendOnline state during processing render.
  const [isRealRun, setIsRealRun] = useState(false);
  const sc = SPORTS[sport];

  // Derive kartingMode from cameraMode (backwards-compat for karting nav)
  const kartingMode = sport === 'karting' ? cameraMode : 'fpv_follow';

  // Default prompt = sport + camera combo default
  const defaultPrompt = (DEFAULT_PROMPTS[sport] || {})[cameraMode] || '';
  const activePrompt = customPrompt || defaultPrompt;

  // Reset on sport change — pick first available camera, clear prompt overrides
  useEffect(() => {
    const modes = CAMERA_MODES[sport] || [];
    const first = modes.find(m => m.available) || modes[0];
    setCameraMode(first ? first.id : 'fpv_follow');
    setSegTier(defaultReviewTier(sport, first ? first.id : 'fpv_follow'));
    setCustomPrompt('');
    setShowPromptConfig(false);
    setStep('upload');
    setUploadedFile(null);
    setError('');
    setIsRealRun(false);
  }, [sport]);

  useEffect(() => {
    const options = reviewOptionsFor({ sport, cameraMode, sc, lang });
    const availableIds = options.filter(o => o.available).map(o => o.id);
    const preferred = defaultReviewTier(sport, cameraMode);
    if (!availableIds.includes(segTier)) {
      setSegTier(availableIds.includes(preferred) ? preferred : availableIds[0] || 'fast');
    } else if (sport === 'downhill' && (cameraMode === 'helmet_cam' || cameraMode === 'drone_front_overhead') && segTier !== 'premium') {
      setSegTier('premium');
    }
  }, [sport, cameraMode, lang]);

  // Update default prompt display when camera changes
  useEffect(() => {
    setCustomPrompt(''); // clear override so new default shows
  }, [cameraMode]);

  useEffect(() => {
    if (step !== 'processing') return;
    const id = setInterval(() => setTick(t => t + 1), 90);
    return () => clearInterval(id);
  }, [step]);

  async function runAnalysis(file) {
    setError('');
    setIsRealRun(false);
    setStep('processing');
    setTick(0);

    // Re-check backend status right now (avoids race with 30s poll interval)
    const freshCheck = await checkHealth();
    const isOnline = freshCheck && freshCheck.status === 'ok';
    if (isOnline) {
      setIsRealRun(true);   // set synchronously before any await below
      if (!backendOnline) setState(s => ({ ...s, backendOnline: true, demo: false }));
    }

    if (!isOnline) {
      if (sport === 'karting') {
        // Navigate to the matching karting demo
        setTimeout(() => setState(s => ({
          ...s,
          page: 'karting-demo',
          kartingMode,
          kartingSessionId: null,
          kartingVideo: kartingMode === 'action_cam' ? 'gopro' : 'luciano',
        })), 1800);
      } else {
        setTimeout(() => setStep('done'), 1800);
      }
      return;
    }

    try {
      const result = await analyzeSession(file, sport, {
        mode: cameraMode,
        tier: segTier,
        everyN,
        prompt: segTier === 'premium' ? (activePrompt || undefined) : undefined,
      });
      if (sport === 'karting') {
        // Navigate to karting review page with real session data
        setState(s => ({
          ...s,
          page: 'karting-demo',
          kartingMode,
          kartingSessionId: result.session_id,
          kartingVideo: null, // real session, not static demo file
        }));
      } else {
        setState(s => ({ ...s, reviewSessionId: result.session_id }));
        setStep('done');
      }
    } catch (err) {
      setError(err.message || 'Analysis failed');
      setStep('upload');
    }
  }

  function handleFile(file) {
    if (!file) return;
    setUploadedFile(file);
    runAnalysis(file);
  }

  const downhillProcSteps = {
    drone_follow: ['Extracting frames', 'YOLO rider pose', segTier === 'premium' ? 'SAM trail isolation' : 'Trail/line proxy', 'Posture + line coaching', 'Building artifacts'],
    helmet_cam: ['Extracting frames', 'POV trail review', segTier === 'premium' ? 'SAM obstacle isolation' : 'Obstacle/terrain cues', 'Line preview coaching', 'Building artifacts'],
    drone_front_overhead: ['Extracting frames', 'Rider trajectory proxy', segTier === 'premium' ? 'SAM section geometry' : 'Section geometry review', 'Line choice coaching', 'Building artifacts'],
    static_tripod: ['Extracting frames', 'Checkpoint posture review', 'Entry/exit cues', 'Repeated feature scoring', 'Building artifacts'],
  };

  const PROC_STEPS = {
    downhill: downhillProcSteps[cameraMode] || downhillProcSteps.drone_follow,
    karting:  [
      'Extracting frames',
      segTier === 'premium' ? 'SAM3 calibration frame' : segTier === 'basic' ? 'SAM2 coordinate prompt' : 'HSV color filter',
      'HSV propagation (all frames)',
      'YOLO kart tracking',
      'Lateral pos · consistency',
      'LLM coaching',
    ],
    surf:     ['Extracting frames', 'Wave detection', 'Pose estimation', 'Phase analysis', 'Tagging maneuvers'],
  };
  const procSteps = PROC_STEPS[sport] || PROC_STEPS.downhill;
  const procLabel = procSteps[Math.min(Math.floor(tick / 14), procSteps.length - 1)];

  const STEPS = [
    { id: 'upload',     en: 'Upload',     es: 'Subir' },
    { id: 'processing', en: 'Processing', es: 'Procesando' },
    { id: 'done',       en: 'Ready',      es: 'Listo' },
  ];

  return (
    <div style={{ padding: '52px 0 0', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '34px 34px' }}>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#9a9a9a', letterSpacing: '0.12em' }}>
              {lang === 'es' ? 'ANALIZAR SESIÓN' : 'ANALYZE SESSION'}
            </div>
            <button
              onClick={() => setState(s => ({ ...s, page: 'method' }))}
              style={{
                background: 'none', border: '1px solid #2a2a2a', borderRadius: 5,
                padding: '7px 12px', cursor: 'pointer',
                color: '#9a9a9a', fontFamily: 'Space Mono, monospace', fontSize: 11,
                letterSpacing: '0.08em',
              }}>
              {lang === 'es' ? 'CÓMO SE HACE' : 'HOW IT WORKS'}
            </button>
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 34, fontWeight: 700, color: '#F4F1EA', margin: '0 0 8px' }}>
            {lang === 'es' ? `Adaptador: ${tl(sc.label, lang)}` : `Adapter: ${tl(sc.label, lang)}`}
          </h2>
          <p style={{ margin: 0, maxWidth: 760, fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, color: '#b7b7b0', lineHeight: 1.6 }}>
            {lang === 'es'
              ? 'Elige la cámara que tienes. La app te dirá qué puede medir con confianza y qué feedback esperar.'
              : 'Choose the camera you have. The app tells you what can be measured reliably and what feedback to expect.'}
          </p>
        </div>

        {/* Sport selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {Object.values(SPORTS).map(s => (
            <button key={s.id}
              onClick={() => setState(st => ({ ...st, sport: s.id }))}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 7, cursor: 'pointer',
                border: `1px solid ${sport === s.id ? s.color + '80' : '#222'}`,
                background: sport === s.id ? s.color + '18' : 'transparent',
                color: sport === s.id ? s.color : '#555',
                fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, fontWeight: 600,
                transition: 'all 0.2s',
              }}>
              {tl(s.label, lang)}
              <span style={{ display: 'block', fontFamily: 'Space Mono, monospace', fontSize: 10, marginTop: 3, opacity: 0.72 }}>
                {s.readiness.toUpperCase()}
              </span>
            </button>
          ))}
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          {STEPS.map((s, i) => {
            const stepIdx = STEPS.findIndex(x => x.id === step);
            const done = i < stepIdx;
            const active = s.id === step;
            return (
              <React.Fragment key={s.id}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: active ? sc.color : done ? sc.color + '40' : '#161616',
                    border: `2px solid ${active ? sc.color : done ? sc.color + '60' : '#222'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Space Mono, monospace', fontSize: 12,
                    color: active ? '#080808' : done ? sc.color : '#555',
                    fontWeight: 700, transition: 'all 0.3s', flexShrink: 0,
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: active ? sc.color : '#666', whiteSpace: 'nowrap' }}>
                    {s[lang] || s.en}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: '#222', margin: '0 10px', marginTop: -14 }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '10px 14px', border: '1px solid #ef444440', borderRadius: 6, background: '#ef444410', marginBottom: 18, fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#ef6464' }}>
            {error}
          </div>
        )}

        {/* Upload */}
        {step === 'upload' && (
          <div>

            {/* ── Camera type selector (all sports) ── */}
            {(() => {
              const modes = CAMERA_MODES[sport] || [];
              if (!modes.length) return null;
              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#a8a8a0', letterSpacing: '0.1em', marginBottom: 12 }}>
                    {lang === 'es' ? 'TIPO DE CÁMARA' : 'CAMERA TYPE'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 16 }}>
                    {modes.map(m => {
                      const active = cameraMode === m.id;
                      const locked = !m.available;
                      return (
                        <div key={m.id}
                          onClick={() => { if (!locked) setCameraMode(m.id); }}
                          style={{
                            border: `1px solid ${active ? m.color + '80' : locked ? '#1a1a1a' : '#222'}`,
                            borderRadius: 10, padding: '20px 20px',
                            background: active ? m.color + '10' : locked ? '#0c0c0c' : '#111',
                            cursor: locked ? 'default' : 'pointer',
                            transition: 'all 0.2s', position: 'relative', opacity: locked ? 0.72 : 1,
                          }}>
                          {/* Coming soon badge */}
                          {m.comingSoon && (
                            <div style={{
                              position: 'absolute', top: 8, right: 8,
                              fontFamily: 'Space Mono, monospace', fontSize: 9,
                              color: '#8a8a8a', background: '#161616',
                              border: '1px solid #2a2a2a', borderRadius: 3,
                              padding: '1px 5px', letterSpacing: '0.06em',
                            }}>
                              {lang === 'es' ? 'PRÓXIMO' : 'SOON'}
                            </div>
                          )}
                          {m.experimental && !locked && (
                            <div style={{
                              position: 'absolute', top: 8, right: 8,
                              fontFamily: 'Space Mono, monospace', fontSize: 9,
                              color: '#eab308', background: '#eab30812',
                              border: '1px solid #eab30835', borderRadius: 3,
                              padding: '2px 6px', letterSpacing: '0.06em',
                            }}>
                              {lang === 'es' ? 'EXP.' : 'EXP.'}
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <span style={{ fontSize: 22 }}>{m.icon}</span>
                            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, fontWeight: 700, color: active ? m.color : locked ? '#777' : '#eee9df' }}>
                              {tl(m.label, lang)}
                            </span>
                            {active && !locked && (
                              <span style={{
                                marginLeft: 'auto', fontFamily: 'Space Mono, monospace', fontSize: 9,
                                color: m.color, background: m.color + '18', border: `1px solid ${m.color}40`,
                                borderRadius: 3, padding: '1px 6px', letterSpacing: '0.06em',
                              }}>
                                {lang === 'es' ? 'ACTIVO' : 'ACTIVE'}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: '0 0 14px', fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, color: active ? '#eee9df' : locked ? '#777' : '#b8b8b0', lineHeight: 1.62 }}>
                            {tl(m.desc, lang)}
                          </p>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {m.outputs.map(o => (
                              <span key={o} style={{
                                fontFamily: 'Space Mono, monospace', fontSize: 10,
                                color: active ? m.color : locked ? '#666' : '#8a8a8a',
                                background: active ? m.color + '12' : '#141414',
                                border: `1px solid ${active ? m.color + '30' : '#222'}`,
                                borderRadius: 4, padding: '3px 8px',
                              }}>{o}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {(() => {
              const strategy = (CAMERA_METHODOLOGY[sport] || {})[cameraMode];
              if (!strategy) return null;
              return (
                <div style={{
                  marginBottom: 22,
                  border: `1px solid ${sc.color}35`,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${sc.color}14, #111 58%)`,
                  padding: '18px 20px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 18,
                  alignItems: 'stretch',
                }}>
                  <div>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: sc.color, letterSpacing: '0.1em', marginBottom: 8 }}>
                      {lang === 'es' ? 'QUÉ RECIBIRÁS CON ESTA CÁMARA' : 'WHAT THIS CAMERA GIVES YOU'}
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 700, color: '#F4F1EA', lineHeight: 1.2, marginBottom: 12 }}>
                      {tl(strategy.title, lang)}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {tl(strategy.athlete, lang).map(item => (
                        <span key={item} style={{
                          fontFamily: 'Space Mono, monospace', fontSize: 10,
                          color: sc.color, background: sc.color + '12',
                          border: `1px solid ${sc.color}35`, borderRadius: 999,
                          padding: '4px 9px',
                        }}>{item}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                    <div style={{ border: '1px solid #2a2a2a', borderRadius: 9, background: '#0d0d0d', padding: '14px 15px' }}>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#22c55e', letterSpacing: '0.09em', marginBottom: 7 }}>
                        {lang === 'es' ? 'RECIBES' : 'YOU GET'}
                      </div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, color: '#d8d8d2', lineHeight: 1.58 }}>
                        {tl(strategy.current, lang)}
                      </div>
                    </div>
                    <div style={{ border: '1px solid #2a2a2a', borderRadius: 9, background: '#0d0d0d', padding: '14px 15px' }}>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#eab308', letterSpacing: '0.09em', marginBottom: 7 }}>
                        {lang === 'es' ? 'TEN EN CUENTA' : 'KEEP IN MIND'}
                      </div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, color: '#d8d8d2', lineHeight: 1.58 }}>
                        {tl(strategy.next, lang)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Segmentation engine tier ── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#a8a8a0', letterSpacing: '0.1em', marginBottom: 12 }}>
                {sport === 'downhill'
                  ? (lang === 'es' ? 'QUÉ QUIERES REVISAR' : 'WHAT DO YOU WANT REVIEWED')
                  : (lang === 'es' ? 'CALIDAD DE ANÁLISIS' : 'ANALYSIS QUALITY')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {reviewOptionsFor({ sport, cameraMode, sc, lang })/*
                  {
                    id: 'fast',
                    label: sport === 'downhill' ? { en: 'Posture + Line', es: 'Postura + Línea' } : { en: 'Fast', es: 'Rápido' },
                    model: sport === 'downhill' ? 'FEEDBACK' : 'HSV',
                    desc: {
                      en: sport === 'downhill'
                        ? 'Best for a quick coaching pass: posture, balance, line drift and the moments where you should stay lower or commit earlier.'
                        : 'Pure color filter. No AI, no GPU needed. Instant results.',
                      es: sport === 'downhill'
                        ? 'Ideal para un pase rápido de coaching: postura, balance, deriva de línea y momentos donde conviene ir más bajo o comprometer antes.'
                        : 'Filtro de color puro. Sin IA, sin GPU. Resultados instantáneos.',
                    },
                    tags: sport === 'downhill'
                      ? (lang === 'es' ? ['rápido', 'postura', 'línea'] : ['quick', 'posture', 'line'])
                      : ['instant', 'no GPU', 'HSV'],
                    color: sport === 'downhill' ? sc.color : '#22c55e',
                    available: true,
                  },
                  {
                    id: 'basic',
                    label: sport === 'downhill' ? { en: 'Full Review', es: 'Revisión Completa' } : { en: 'Basic', es: 'Básico' },
                    model: sport === 'downhill' ? 'FULL' : 'SAM2',
                    desc: {
                      en: sport === 'downhill'
                        ? 'A fuller review of the same ride: posture trend, line efficiency, terrain context and session summary in one result.'
                        : 'Coordinate-prompted. Calibrates HSV from AI mask. Any GPU.',
                      es: sport === 'downhill'
                        ? 'Una revisión más completa de la misma bajada: tendencia postural, eficiencia de línea, contexto de terreno y resumen de sesión.'
                        : 'Basado en coordenadas. Calibra HSV desde máscara IA. Cualquier GPU.',
                    },
                    tags: sport === 'downhill'
                      ? (lang === 'es' ? ['resumen', 'tendencia', 'scores'] : ['summary', 'trend', 'scores'])
                      : ['~5s calib', '6 GB VRAM', 'SAM2'],
                    color: '#6b7280',
                    available: true,
                  },
                  {
                    id: 'premium',
                    label: sport === 'downhill' ? { en: 'Trail + Obstacles', es: 'Sendero + Obstáculos' } : { en: 'Premium', es: 'Premium' },
                    model: sport === 'downhill' ? 'SAM' : 'SAM3',
                    desc: {
                      en: sport === 'downhill'
                        ? 'Adds visual trail isolation to review the rideable corridor, obstacles and line choice with more context.'
                        : 'Text-prompted — semantic, camera-agnostic. Best mask quality.',
                      es: sport === 'downhill'
                        ? 'Agrega aislamiento visual del sendero para revisar corredor transitable, obstáculos y elección de línea con más contexto.'
                        : 'Basado en texto — semántico, agnóstico a cámara. Mejor calidad de máscara.',
                    },
                    tags: sport === 'downhill'
                      ? (lang === 'es' ? ['sendero', 'obstáculos', 'línea'] : ['trail', 'obstacles', 'line'])
                      : ['~10s calib', '12 GB VRAM', 'SAM3.1'],
                    color: sc.color,
                    available: true,
                  },
                */.map(t => {
                  const active = segTier === t.id;
                  const locked = !t.available;
                  return (
                    <div key={t.id}
                      onClick={() => { if (!locked) { setSegTier(t.id); setEveryN(t.id === 'premium' ? 3 : 2); } }}
                      style={{
                        border: `1px solid ${active ? t.color + '80' : locked ? '#1a1a1a' : '#222'}`,
                        borderRadius: 10, padding: '20px 20px',
                        background: active ? t.color + '10' : locked ? '#0c0c0c' : '#111',
                        cursor: locked ? 'default' : 'pointer',
                        transition: 'all 0.2s', position: 'relative', opacity: locked ? 0.72 : 1,
                      }}>
                      {t.comingSoon && (
                        <div style={{
                          position: 'absolute', top: 8, right: 8,
                          fontFamily: 'Space Mono, monospace', fontSize: 9,
                          color: '#8a8a8a', background: '#161616',
                          border: '1px solid #2a2a2a', borderRadius: 3,
                          padding: '1px 5px', letterSpacing: '0.06em',
                        }}>
                          {lang === 'es' ? 'PRÓXIMO' : 'SOON'}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{
                          fontFamily: 'Space Mono, monospace', fontSize: 10,
                          color: active ? t.color : locked ? '#555' : '#777',
                          background: active ? t.color + '18' : '#1a1a1a',
                          border: `1px solid ${active ? t.color + '40' : '#303030'}`,
                          borderRadius: 3, padding: '2px 7px', letterSpacing: '0.06em',
                        }}>{t.model}</span>
                        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, fontWeight: 700, color: active ? t.color : locked ? '#777' : '#eee9df' }}>
                          {tl(t.label, lang)}
                        </span>
                        {active && !locked && (
                          <span style={{
                            marginLeft: 'auto', fontFamily: 'Space Mono, monospace', fontSize: 9,
                            color: t.color, background: t.color + '18', border: `1px solid ${t.color}40`,
                            borderRadius: 3, padding: '1px 6px', letterSpacing: '0.06em',
                          }}>
                            {lang === 'es' ? 'ACTIVO' : 'ACTIVE'}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0 0 14px', fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, color: active ? '#eee9df' : locked ? '#777' : '#b8b8b0', lineHeight: 1.62 }}>
                        {tl(t.desc, lang)}
                      </p>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {t.tags.map(tag => (
                          <span key={tag} style={{
                            fontFamily: 'Space Mono, monospace', fontSize: 10,
                            color: active ? t.color : locked ? '#444' : '#777',
                            background: active ? t.color + '12' : '#181818',
                            border: `1px solid ${active ? t.color + '30' : '#2a2a2a'}`,
                            borderRadius: 4, padding: '3px 8px',
                          }}>{tag}</span>
                        ))}
                        <span style={{
                          fontFamily: 'Space Mono, monospace', fontSize: 10,
                          color: active ? '#eee9df' : locked ? '#444' : '#aaa',
                          background: active ? '#ffffff10' : '#181818',
                          border: `1px solid ${active ? '#ffffff24' : '#2a2a2a'}`,
                          borderRadius: 4, padding: '3px 8px',
                        }}>
                          {lang === 'es' ? `tiempo ${t.estimate}` : `time ${t.estimate}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Frame sampling rate ── */}
            {sport === 'karting' && <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#777', letterSpacing: '0.1em', marginBottom: 10 }}>
                {lang === 'es' ? 'MUESTREO DE FRAMES' : 'FRAME SAMPLING'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* stepper */}
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #2a2a2a', borderRadius: 7, overflow: 'hidden', background: '#111' }}>
                  <button onClick={() => setEveryN(v => Math.max(1, v - 1))} style={{
                    width: 34, height: 36, background: 'none', border: 'none',
                    borderRight: '1px solid #222', cursor: 'pointer',
                    color: '#777', fontSize: 16, lineHeight: 1,
                    transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#aaa'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none';    e.currentTarget.style.color = '#555'; }}>
                    −
                  </button>
                  <input
                    type="number" min={1} max={60} value={everyN}
                    onChange={e => setEveryN(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                    style={{
                      width: 44, background: 'none', border: 'none', outline: 'none',
                      fontFamily: 'Space Mono, monospace', fontSize: 15, fontWeight: 700,
                      color: '#EDEDE8', textAlign: 'center', padding: '0 4px',
                      MozAppearance: 'textfield',
                    }}
                  />
                  <button onClick={() => setEveryN(v => Math.min(60, v + 1))} style={{
                    width: 34, height: 36, background: 'none', border: 'none',
                    borderLeft: '1px solid #222', cursor: 'pointer',
                    color: '#777', fontSize: 16, lineHeight: 1,
                    transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#aaa'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none';    e.currentTarget.style.color = '#555'; }}>
                    +
                  </button>
                </div>
                {/* label */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#888' }}>
                    {lang === 'es' ? `1 de cada ${everyN} frame${everyN > 1 ? 's' : ''}` : `every ${everyN} frame${everyN > 1 ? 's' : ''}`}
                  </span>
                  {segTier === 'premium' && (
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#444' }}>
                      {everyN <= 2  ? (lang === 'es' ? 'máxima calidad · más lento' : 'max quality · slower') :
                       everyN <= 5  ? (lang === 'es' ? 'balance calidad / velocidad' : 'quality / speed balance') :
                                      (lang === 'es' ? 'rápido · calidad reducida' : 'fast · reduced quality')}
                    </span>
                  )}
                </div>
              </div>
              <style>{`input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}`}</style>
            </div>}

            {/* ── Segmentation prompt config (collapsible, premium only) ── */}
            {segTier === 'premium' && sport === 'karting' && <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => setShowPromptConfig(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  background: showPromptConfig ? '#0f0f0f' : 'none',
                  border: `1px solid ${showPromptConfig ? '#2a2a2a' : '#252525'}`,
                  borderRadius: showPromptConfig ? '6px 6px 0 0' : 6,
                  padding: '10px 14px', cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = '#0f0f0f'; }}
                onMouseLeave={e => { if (!showPromptConfig) { e.currentTarget.style.borderColor = '#252525'; e.currentTarget.style.background = 'none'; } }}>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.1em', flex: 1, textAlign: 'left', color: customPrompt ? sc.color : '#6b6b6b' }}>
                  SAM3 · {lang === 'es' ? 'PROMPT DE SEGMENTACIÓN' : 'SEGMENTATION PROMPT'}
                  {customPrompt && <span style={{ marginLeft: 8 }}>● {lang === 'es' ? 'PERSONALIZADO' : 'CUSTOM'}</span>}
                  {!customPrompt && <span style={{ color: '#3a3a3a', marginLeft: 8, fontWeight: 400 }}>{defaultPrompt}</span>}
                </span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#444' }}>
                  {showPromptConfig ? '?' : '?'}
                </span>
              </button>

              {showPromptConfig && (
                <div style={{
                  border: '1px solid #1e1e1e', borderTop: 'none',
                  borderRadius: '0 0 6px 6px', padding: '14px',
                  background: '#0d0d0d',
                }}>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: '#555', marginBottom: 10, lineHeight: 1.5 }}>
                    {lang === 'es'
                      ? 'Texto que guía al modelo de segmentación (SAM3) para identificar la superficie de interés. Edita si el default no funciona para tu grabación.'
                      : 'Text guiding the segmentation model (SAM3) to identify the surface of interest. Edit if the default doesn\'t work for your footage.'}
                  </div>
                  <textarea
                    value={customPrompt || defaultPrompt}
                    onChange={e => {
                      const val = e.target.value;
                      setCustomPrompt(val === defaultPrompt ? '' : val);
                    }}
                    rows={2}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#111', border: `1px solid ${customPrompt ? sc.color + '50' : '#2a2a2a'}`,
                      borderRadius: 5, padding: '9px 12px', resize: 'vertical',
                      fontFamily: 'Space Mono, monospace', fontSize: 11,
                      color: '#EDEDE8', lineHeight: 1.5, outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => { if (!customPrompt) e.target.select(); }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#444' }}>
                      {lang === 'es' ? 'DEFAULT:' : 'DEFAULT:'} <span style={{ color: '#555' }}>{defaultPrompt}</span>
                    </div>
                    {customPrompt && (
                      <button
                        onClick={() => setCustomPrompt('')}
                        style={{
                          background: 'none', border: '1px solid #2a2a2a', borderRadius: 4,
                          padding: '3px 10px', cursor: 'pointer',
                          fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#555',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#888'}
                        onMouseLeave={e => e.currentTarget.style.color = '#555'}>
                        {lang === 'es' ? 'RESTAURAR DEFAULT' : 'RESET TO DEFAULT'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>}

            <div
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('dc-file-in').click()}
              style={{
                border: `2px dashed ${drag ? sc.color : '#222'}`,
                borderRadius: 14, padding: '68px 36px',
                textAlign: 'center', cursor: 'pointer',
                background: drag ? sc.color + '08' : '#111111',
                transition: 'all 0.2s', marginBottom: 12,
              }}>
              <input id="dc-file-in" type="file" accept="video/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
              <svg width="44" height="44" viewBox="0 0 44 44" style={{ opacity: 0.25, marginBottom: 16 }}>
                <rect x="2" y="8" width="28" height="28" rx="4" fill="none" stroke="#EDEDE8" strokeWidth="2" />
                <polygon points="14,16 30,22 14,28" fill="#EDEDE8" />
                <rect x="32" y="13" width="10" height="5" rx="2" fill="none" stroke="#EDEDE8" strokeWidth="1.5" />
                <rect x="32" y="26" width="10" height="5" rx="2" fill="none" stroke="#EDEDE8" strokeWidth="1.5" />
              </svg>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, color: '#F4F1EA', marginBottom: 8, fontWeight: 700 }}>
                {lang === 'es' ? 'Arrastra tu video aquí' : 'Drop session video here'}
              </div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#8a8a8a' }}>
                MP4 · MOV · AVI — {lang === 'es' ? 'o haz clic para seleccionar' : 'or click to browse'}
              </div>
            </div>

            {/* Offline notice — only when backend is actually down */}
            {!backendOnline && (
              <div style={{
                border: '1px solid #ef444430', borderRadius: 8,
                background: '#ef444408', marginBottom: 16, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 16px', background: '#ef444412',
                  borderBottom: '1px solid #ef444420',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ color: '#ef6444', fontSize: 14 }}>?</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#ef6464', letterSpacing: '0.08em' }}>
                    {lang === 'es' ? 'BACKEND OFFLINE — EL VIDEO NO SERÁ PROCESADO' : 'BACKEND OFFLINE — VIDEO WILL NOT BE PROCESSED'}
                  </span>
                </div>
                <div style={{ padding: '12px 16px', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#888', lineHeight: 1.6 }}>
                  {lang === 'es'
                    ? 'El servidor de análisis no está disponible. Si cargas un video, se mostrará una sesión de demo pre-grabada, no los resultados reales de tu video. Para procesar un video real, inicia el backend con '
                    : 'The analysis server is not running. If you upload a video, a pre-recorded demo session will be shown — not your real video results. To process a real video, start the backend with '}
                  <code style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#22c55e', background: '#22c55e10', borderRadius: 3, padding: '1px 6px' }}>
                    uvicorn backend.main:app --port 8000
                  </code>
                </div>
                <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
                  <button onClick={() => runAnalysis(null)} style={{
                    padding: '8px 18px', borderRadius: 6,
                    border: '1px solid #eab30845', background: '#eab30810', color: '#eab308',
                    fontFamily: 'Space Mono, monospace', fontSize: 10, cursor: 'pointer',
                    letterSpacing: '0.08em',
                  }}>
                    ● {lang === 'es' ? 'VER DEMO DE TODAS FORMAS' : 'SHOW DEMO ANYWAY'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ padding: '16px 18px', border: '1px solid #222', borderRadius: 8, background: '#111111' }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', letterSpacing: '0.1em', marginBottom: 10 }}>
                {lang === 'es' ? 'CAPACIDADES ACTIVAS' : 'ACTIVE CAPABILITIES'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {activeCapabilitiesFor(sc, sport, cameraMode, lang).map(cap => <CapChip key={cap.id} cap={cap} sport={sport} lang={lang} compact />)}
              </div>
            </div>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 28 }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: i === tick % 5 ? sc.color : sc.color + '25',
                  boxShadow: i === tick % 5 ? `0 0 8px ${sc.color}` : 'none',
                  transition: 'all 0.12s',
                }} />
              ))}
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: sc.color, letterSpacing: '0.1em', marginBottom: 8 }}>
              {procLabel ? procLabel.toUpperCase() : ''}
            </div>
            {/* isSimulation: no real file OR backend confirmed offline when this run started */}
            {(() => {
              const isSimulation = !isRealRun || !uploadedFile;
              return (<>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#6b6b6b', marginBottom: 6 }}>
                  {isSimulation
                    ? (lang === 'es' ? 'Cargando datos de demo...' : 'Loading demo data...')
                    : (lang === 'es' ? 'Ejecutando pipeline de análisis...' : 'Running analysis pipeline...')}
                </div>
                {isSimulation && (
                  <div style={{
                    marginTop: 12, padding: '8px 16px',
                    border: '1px solid #eab30830', borderRadius: 6, background: '#eab30808',
                    fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#eab308',
                  }}>
                    {lang === 'es' ? '⚠ SIMULACIÓN — tu video original no fue procesado' : '⚠ SIMULATION — your video was not processed'}
                  </div>
                )}
              </>);
            })()}
            {isRealRun && (
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#555', marginTop: 8 }}>
                {lang === 'es' ? '~1-3 min dependiendo del video' : '~1-3 min depending on video length'}
              </div>
            )}
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: '#22c55e18', border: '2px solid #22c55e60',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 24, color: '#22c55e',
            }}>✓</div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, color: '#EDEDE8', marginBottom: 6 }}>
              {lang === 'es' ? 'Sesión procesada' : 'Session processed'}
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', marginBottom: 28, letterSpacing: '0.08em' }}>
              {lang === 'es' ? 'ARTEFACTOS LISTOS' : 'ARTIFACTS READY'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setState(s => ({ ...s, page: 'review' }))} style={{
                background: sc.color, border: 'none', borderRadius: 6,
                padding: '11px 26px', cursor: 'pointer',
                fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 600,
                color: '#080808',
              }}>
                {lang === 'es' ? 'Ver análisis →' : 'View analysis →'}
              </button>
              <button onClick={() => { setStep('upload'); setUploadedFile(null); }} style={{
                background: 'none', border: '1px solid #222', borderRadius: 6,
                padding: '11px 20px', cursor: 'pointer',
                fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: '#6b6b6b',
              }}>
                {lang === 'es' ? 'Nueva sesión' : 'New session'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sessions ──────────────────────────────────────────────────────────────────

function formatDate(session_id) {
  if (!session_id || session_id.startsWith('demo')) return '—';
  if (session_id.length >= 8) {
    return `${session_id.slice(0, 4)}-${session_id.slice(4, 6)}-${session_id.slice(6, 8)}`;
  }
  return session_id;
}

function SessionRow({ sess, lang, onClick, onDelete }) {
  const sc = SPORTS[sess.sport] || SPORTS.downhill;
  const [hov, setHov] = useState(false);
  const [delHov, setDelHov] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isReal = !sess._kartingDemo && !sess.session_id?.startsWith('demo');

  const scores = [];
  if (sess.sport === 'karting') {
    if (sess.frames_analyzed != null) scores.push({ k: 'frames', v: sess.frames_analyzed });
    if (sess.mode === 'action_cam' && sess.kerb_events != null) scores.push({ k: 'kerb', v: sess.kerb_events });
    else if (sess.karts_detected != null) scores.push({ k: 'karts', v: sess.karts_detected });
  } else {
    if (sess.avg_balance_score != null) scores.push({ k: lang === 'es' ? 'pos' : 'pos', v: Math.round(sess.avg_balance_score) });
    if (sess.avg_line_efficiency_score != null) scores.push({ k: 'line', v: Math.round(sess.avg_line_efficiency_score) });
  }

  function handleDelete(e) {
    e.stopPropagation();
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    deleteSession(sess.session_id)
      .then(() => onDelete(sess.session_id))
      .catch(() => { setDeleting(false); setConfirming(false); });
  }

  function cancelDelete(e) {
    e.stopPropagation();
    setConfirming(false);
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setConfirming(false); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px', borderRadius: 8,
        border: `1px solid ${confirming ? '#ef444450' : hov ? sc.color + '50' : '#222'}`,
        background: confirming ? '#ef444408' : hov ? sc.color + '07' : '#111111',
        cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
      }}>
      {/* Clickable main area */}
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
        <div style={{ width: 3, height: 36, borderRadius: 2, background: sc.color, flexShrink: 0, boxShadow: `0 0 8px ${sc.color}50` }} />
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: sc.color, width: 22, flexShrink: 0 }}>
          {sc.abbr}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: '#EDEDE8', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sess.original_filename || sess.session_id}
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b' }}>
            {formatDate(sess.session_id)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, flexShrink: 0 }}>
          {sess._kartingDemo ? (
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: sc.color, background: sc.color + '15', border: `1px solid ${sc.color}40`, borderRadius: 3, padding: '3px 8px' }}>DEMO ?</span>
          ) : scores.length > 0 ? scores.map(s => (
            <div key={s.k} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 17, color: sc.color, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#777', textTransform: 'uppercase', marginTop: 2 }}>{s.k}</div>
            </div>
          )) : (
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', border: '1px solid #222', borderRadius: 3, padding: '3px 8px' }}>
              {sess.sport === 'karting' ? 'KARTING' : 'READY'}
            </span>
          )}
        </div>
        <div style={{ color: '#3a3a3a', fontSize: 14, paddingLeft: 4, flexShrink: 0 }}>→</div>
      </div>

      {/* Delete controls — only for real sessions */}
      {isReal && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 6 }}>
          {confirming && (
            <button onClick={cancelDelete} style={{
              padding: '4px 10px', borderRadius: 4, border: '1px solid #333',
              fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', cursor: 'pointer',
              background: '#0d0d0d',
            }}>
              {lang === 'es' ? 'cancelar' : 'cancel'}
            </button>
          )}
          <button
            onClick={handleDelete}
            onMouseEnter={() => setDelHov(true)}
            onMouseLeave={() => setDelHov(false)}
            disabled={deleting}
            title={confirming ? (lang === 'es' ? 'Confirmar eliminación' : 'Confirm delete') : (lang === 'es' ? 'Eliminar sesión' : 'Delete session')}
            style={{
              width: 28, height: 28, borderRadius: 5, border: `1px solid ${confirming ? '#ef4444' : delHov ? '#ef444460' : '#2a2a2a'}`,
              background: confirming ? '#ef444418' : delHov ? '#ef444410' : 'transparent',
              color: confirming ? '#ef4444' : delHov ? '#ef4444' : '#3a3a3a',
              cursor: deleting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', flexShrink: 0,
            }}>
            {deleting
              ? <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8 }}>…</span>
              : confirming
                ? <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M2 3h8M2 9h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/></svg>
                : <svg width="11" height="12" viewBox="0 0 11 12" fill="none"><path d="M1 3h9M4 3V2h3v1M2 3l.7 7.3a.7.7 0 00.7.7h4.2a.7.7 0 00.7-.7L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </button>
        </div>
      )}
    </div>
  );
}

export function SessionsPage({ state, setState }) {
  const { lang, backendOnline } = state;
  const [filter, setFilter] = useState('all');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh() { setRefreshKey(k => k + 1); }

  useEffect(() => {
    if (!backendOnline) {
      setSessions([]);
      return;
    }
    setLoading(true);
    listSessions()
      .then(data => setSessions(data || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  // refreshKey forces re-fetch when user navigates back or clicks refresh
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendOnline, refreshKey]);

  // Always re-fetch on mount (handles navigating back after a new session was created)
  useEffect(() => { if (backendOnline) refresh(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const list = filter === 'all' ? sessions : sessions.filter(s => s.sport === filter);

  const filters = [
    { id: 'all', label: { en: 'All', es: 'Todas' } },
    ...Object.values(SPORTS).map(s => ({ id: s.id, label: s.label })),
  ];

  return (
    <div style={{ padding: '52px 0 0', minHeight: '100vh' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 32px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', letterSpacing: '0.12em', marginBottom: 8 }}>
              {lang === 'es' ? 'HISTORIAL' : 'SESSION HISTORY'}
            </div>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 700, color: '#EDEDE8', margin: 0 }}>
              {lang === 'es' ? 'Sesiones' : 'Sessions'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {backendOnline && (
              <button onClick={refresh} disabled={loading} title={lang === 'es' ? 'Actualizar' : 'Refresh'} style={{
                padding: '5px 10px', borderRadius: 5, cursor: loading ? 'wait' : 'pointer',
                border: '1px solid #222', background: 'transparent', color: loading ? '#333' : '#555',
                fontFamily: 'Space Mono, monospace', fontSize: 11, transition: 'color 0.15s',
              }}>
                {loading ? '…' : '↺'}
              </button>
            )}
            {filters.map(f => {
              const col = f.id === 'all' ? '#EDEDE8' : SPORTS[f.id]?.color;
              const on = filter === f.id;
              return (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{
                  padding: '5px 13px', borderRadius: 5, cursor: 'pointer',
                  border: `1px solid ${on ? col + '70' : '#222'}`,
                  background: on ? col + '14' : 'transparent',
                  color: on ? col : '#555',
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: 12,
                  transition: 'all 0.2s',
                }}>{tl(f.label, lang)}</button>
              );
            })}
          </div>
        </div>

        {loading && (
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#6b6b6b', padding: '20px 0', textAlign: 'center' }}>
            {lang === 'es' ? 'Cargando sesiones...' : 'Loading sessions...'}
          </div>
        )}

        {!backendOnline && (
          <div style={{ padding: '8px 14px', border: '1px solid #eab30828', borderRadius: 6, background: '#eab30808', marginBottom: 16 }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#eab308' }}>
              {lang === 'es' ? '● DEMO — mostrando sesiones de ejemplo' : '● DEMO — showing sample sessions'}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {list.map(sess => (
            <SessionRow key={sess.session_id} sess={sess} lang={lang}
              onDelete={id => setSessions(prev => prev.filter(s => s.session_id !== id))}
              onClick={() => {
                if (sess._kartingDemo) {
                  setState(s => ({ ...s, sport: 'karting', page: 'karting-demo', kartingSessionId: null, kartingVideo: sess._kartingVideo, kartingMode: sess._kartingMode }));
                } else if (sess.sport === 'karting') {
                  setState(s => ({ ...s, sport: 'karting', page: 'karting-demo', kartingSessionId: sess.session_id, kartingVideo: null, kartingMode: sess.mode || 'fpv_follow' }));
                } else {
                  setState(s => ({ ...s, reviewSessionId: sess.session_id, sport: sess.sport || s.sport, page: 'review' }));
                }
              }} />
          ))}
          {list.length === 0 && !loading && (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: '#555', marginBottom: 12 }}>
                {lang === 'es' ? 'Aún no hay sesiones procesadas.' : 'No processed sessions yet.'}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setState(s => ({ ...s, page: 'analyze' }))}
                  style={{
                    background: 'none', border: '1px solid #333', borderRadius: 5,
                    padding: '8px 18px', cursor: 'pointer',
                    fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#888',
                    letterSpacing: '0.08em', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#EDEDE8'; e.currentTarget.style.borderColor = '#555'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#333'; }}>
                  {lang === 'es' ? 'ANALIZAR VIDEO →' : 'ANALYZE VIDEO →'}
                </button>
                <button
                  onClick={() => setState(s => ({ ...s, page: 'demos' }))}
                  style={{
                    background: 'none', border: '1px solid #222', borderRadius: 5,
                    padding: '8px 18px', cursor: 'pointer',
                    fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#555',
                    letterSpacing: '0.08em', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#333'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#222'; }}>
                  {lang === 'es' ? 'VER DEMOS' : 'VIEW DEMOS'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Demos ─────────────────────────────────────────────────────────────────────

const CURATED_DEMOS = [
  {
    id: 'kt-fpv',
    sport: 'karting',
    mode: 'fpv_follow',
    modeLabel: { en: 'FPV Drone', es: 'Drone FPV' },
    tier: 'premium',
    title: { en: 'FPV Follow — Circuit', es: 'Drone FPV — Circuito' },
    desc: {
      en: 'Single kart chased by FPV drone. SAM3 text-prompt track segmentation, YOLO11n detection, ByteTrack IDs, lateral position + line consistency.',
      es: 'Un kart seguido por drone FPV. Segmentación SAM3 text-prompt, YOLO11n, ByteTrack IDs, posición lateral + consistencia de línea.',
    },
    videoSrc: '/karting-demo/luciano_annotated.mp4',
    summaryUrl: '/karting-demo/luciano_summary.json',
    available: true,
    nav: s => ({ ...s, page: 'karting-demo', sport: 'karting', kartingMode: 'fpv_follow', kartingVideo: 'luciano', kartingSessionId: null }),
  },
  {
    id: 'kt-gopro',
    sport: 'karting',
    mode: 'action_cam',
    modeLabel: { en: 'GoPro Helmet', es: 'GoPro Casco' },
    tier: 'basic',
    title: { en: 'GoPro Helmet Cam', es: 'GoPro — Cámara de Casco' },
    desc: {
      en: '21 karts tracked simultaneously. Gap-to-ahead bar, kerb contact detection L/R, persistent ByteTrack IDs across the full session.',
      es: '21 karts seguidos simultáneamente. Barra de distancia al kart de adelante, detección de contacto con kerb izq/der e IDs ByteTrack persistentes.',
    },
    videoSrc: '/karting-demo/gopro_annotated.mp4',
    summaryUrl: '/karting-demo/gopro_summary.json',
    available: true,
    nav: s => ({ ...s, page: 'karting-demo', sport: 'karting', kartingMode: 'action_cam', kartingVideo: 'gopro', kartingSessionId: null }),
  },
  {
    id: 'dh-action',
    sport: 'downhill',
    mode: 'action_cam',
    modeLabel: { en: 'Helmet Cam', es: 'Cámara de Casco' },
    tier: 'premium',
    title: { en: 'DH Helmet Cam', es: 'Descenso — Cámara de Casco' },
    desc: {
      en: 'First-person helmet camera on trail. Pose estimation, terrain classification, line efficiency scoring.',
      es: 'Cámara de casco en primera persona en sendero. Estimación de pose, clasificación de terreno, scoring de eficiencia de línea.',
    },
    videoSrc: '/dh-demo/dh_annotated.mp4',
    summaryUrl: '/dh-demo/dh_summary.json',
    available: false,
    nav: null,
  },
];

function DemoCard({ demo, lang, onView }) {
  const sc = SPORTS[demo.sport];
  const [summary, setSummary] = useState(null);
  const [hov, setHov] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!demo.available) return;
    fetch(demo.summaryUrl)
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {});
  }, [demo.summaryUrl, demo.available]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (hov) videoRef.current.play().catch(() => {});
    else { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  }, [hov]);

  const tierColor = demo.tier === 'premium' ? sc.color : '#6b7280';

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        border: `1px solid ${hov && demo.available ? sc.color + '60' : '#1e1e1e'}`,
        borderRadius: 12, overflow: 'hidden',
        background: '#0f0f0f',
        transition: 'border-color 0.25s',
        cursor: demo.available ? 'pointer' : 'default',
        opacity: demo.available ? 1 : 0.55,
        display: 'flex', flexDirection: 'column',
      }}
      onClick={() => { if (demo.available && onView) onView(); }}
    >
      {/* Video preview */}
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#080808', overflow: 'hidden', flexShrink: 0 }}>
        {demo.available ? (
          <video
            ref={videoRef}
            src={demo.videoSrc}
            muted playsInline loop preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 14, opacity: 0.3 }}>+</span>
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#2a2a2a', letterSpacing: '0.1em' }}>
              {lang === 'es' ? 'VIDEO NO DISPONIBLE' : 'VIDEO NOT YET AVAILABLE'}
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#1e1e1e' }}>
              {demo.videoSrc}
            </div>
          </div>
        )}
        {demo.available && hov && (
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            fontFamily: 'Space Mono, monospace', fontSize: 8,
            color: '#080808', background: sc.color,
            borderRadius: 3, padding: '2px 7px', letterSpacing: '0.06em',
            pointerEvents: 'none',
          }}>? PREVIEW</div>
        )}
        {/* Top-left sport badge */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.08em',
          color: sc.color, background: '#080808cc',
          border: `1px solid ${sc.color}40`, borderRadius: 3, padding: '2px 7px',
        }}>{sc.abbr}</div>
      </div>

      {/* Card body */}
      <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Mode + tier badges */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.06em',
            color: '#888', background: '#161616', border: '1px solid #2a2a2a',
            borderRadius: 3, padding: '2px 7px',
          }}>{tl(demo.modeLabel, lang)}</span>
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.06em',
            color: tierColor, background: tierColor + '15', border: `1px solid ${tierColor}40`,
            borderRadius: 3, padding: '2px 7px',
          }}>{demo.tier === 'premium' ? 'SAM3' : 'SAM2'}</span>
        </div>

        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 600, color: '#EDEDE8', marginBottom: 6 }}>
          {tl(demo.title, lang)}
        </div>
        <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, color: '#555', lineHeight: 1.6, margin: '0 0 14px', flex: 1 }}>
          {tl(demo.desc, lang)}
        </p>

        {/* Stats row — handles both karting and DH summary shapes */}
        {summary && (() => {
          const topKart = Object.values(summary.driver_scores || {})[0];
          const stats = [
            summary.frames_analyzed != null && { v: summary.frames_analyzed, k: 'FRAMES' },
            summary.karts_detected  != null && { v: summary.karts_detected,  k: 'KARTS'  },
            topKart?.score       != null && { v: topKart.score.toFixed(0),       k: 'SCORE'   },
            topKart?.consistency > 0     && { v: topKart.consistency.toFixed(0) + '%', k: 'CONSIST.' },
            // DH fields
            summary.avg_balance_score         != null && { v: Math.round(summary.avg_balance_score),        k: 'BALANCE'  },
            summary.avg_line_efficiency_score != null && { v: Math.round(summary.avg_line_efficiency_score), k: 'LINE EFF.' },
          ].filter(Boolean);
          if (!stats.length) return null;
          return (
            <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
              {stats.map(({ v, k }) => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 15, color: sc.color, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color: '#555', marginTop: 3, letterSpacing: '0.06em' }}>{k}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {demo.available ? (
          <button
            onClick={e => { e.stopPropagation(); if (onView) onView(); }}
            style={{
              background: sc.color + '18', border: `1px solid ${sc.color}40`,
              borderRadius: 5, padding: '8px 16px', cursor: 'pointer',
              fontFamily: 'Space Mono, monospace', fontSize: 9,
              color: sc.color, letterSpacing: '0.08em',
              transition: 'background 0.2s', width: '100%',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = sc.color + '28'; }}
            onMouseLeave={e => { e.currentTarget.style.background = sc.color + '18'; }}>
            {lang === 'es' ? 'VER ANÁLISIS →' : 'VIEW ANALYSIS →'}
          </button>
        ) : (
          <div style={{
            border: '1px solid #1a1a1a', borderRadius: 5, padding: '8px 16px',
            fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#2a2a2a',
            letterSpacing: '0.08em', textAlign: 'center',
          }}>
            {lang === 'es' ? 'PRÓXIMAMENTE' : 'COMING SOON'}
          </div>
        )}
      </div>
    </div>
  );
}

export function DemosPage({ state, setState }) {
  const { lang } = state;

  return (
    <div style={{ padding: '52px 0 0', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1020, margin: '0 auto', padding: '48px 32px' }}>

        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', letterSpacing: '0.12em', marginBottom: 10 }}>
            {lang === 'es' ? 'ANÁLISIS DE REFERENCIA' : 'REFERENCE ANALYSES'}
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 700, color: '#EDEDE8', margin: '0 0 8px' }}>
            {lang === 'es' ? 'Demos precargadas' : 'Curated demos'}
          </h2>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#6b6b6b', margin: 0, lineHeight: 1.6, maxWidth: 520 }}>
            {lang === 'es'
              ? 'Videos reales procesados con el pipeline completo. Explora resultados sin necesidad de subir tu propio material.'
              : 'Real footage processed through the full pipeline. Explore results without uploading your own material.'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16, marginBottom: 40 }}>
          {CURATED_DEMOS.map(demo => (
            <DemoCard
              key={demo.id}
              demo={demo}
              lang={lang}
              onView={demo.nav ? () => setState(demo.nav) : undefined}
            />
          ))}
        </div>

        {/* How to add a demo */}
        <div style={{
          padding: '18px 22px', border: '1px solid #1a1a1a', borderRadius: 8, background: '#0d0d0d',
        }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#3a3a3a', letterSpacing: '0.1em', marginBottom: 8 }}>
            {lang === 'es' ? 'AÑADIR DEMO' : 'ADD DEMO'}
          </div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: '#3a3a3a', lineHeight: 1.6, marginBottom: 10 }}>
            {lang === 'es'
              ? 'Coloca el video anotado y el JSON de resumen en la carpeta correcta y reinicia el dev server.'
              : 'Place the annotated video and summary JSON in the right folder and restart the dev server.'}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { folder: 'frontend/public/karting-demo/', files: ['*_annotated.mp4', '*_summary.json'], color: '#1fa84a' },
              { folder: 'frontend/public/dh-demo/',     files: ['dh_annotated.mp4', 'dh_summary.json'], color: '#c97a28' },
            ].map(slot => (
              <div key={slot.folder} style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, lineHeight: 1.8 }}>
                <span style={{ color: slot.color + '80' }}>{slot.folder}</span>
                {slot.files.map(f => (
                  <div key={f} style={{ color: '#2a2a2a', paddingLeft: 14 }}>? {f}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Method ────────────────────────────────────────────────────────────────────

// Camera input matrix per sport
const CAMERA_DATA = {
  karting: {
    sources: [
      { id: 'fpv',      label: { en: 'FPV Drone',        es: 'Drone FPV' },        tier: 0, recommended: true  },
      { id: 'gopro',    label: { en: 'GoPro / Helmet',   es: 'GoPro / Casco' },    tier: 0, recommended: true  },
      { id: 'overhead', label: { en: 'Fixed Overhead',   es: 'Cámara Fija Cenital'},tier: 1, recommended: false },
      { id: 'gps',      label: { en: 'GPS / OBD',        es: 'GPS / OBD' },        tier: 2, recommended: false },
    ],
    rows: [
      { label: { en: 'Driver body pose', es: 'Pose corporal del piloto' },                fpv: 0, gopro: 0, overhead: 0, gps: 0 },
      { label: { en: 'Kart detection (YOLO11)', es: 'Detección de kart (YOLO11)' },       fpv: 2, gopro: 1, overhead: 2, gps: 0 },
      { label: { en: 'Lateral position on track', es: 'Posición lateral en pista' },      fpv: 2, gopro: 1, overhead: 2, gps: 0 },
      { label: { en: 'Track segmentation (SAM2 / SAM3)', es: 'Segmentación de pista (SAM2 / SAM3)' }, fpv: 2, gopro: 2, overhead: 2, gps: 0 },
      { label: { en: 'Multi-kart tracking', es: 'Tracking multi-kart' },                  fpv: 2, gopro: 1, overhead: 2, gps: 0 },
      { label: { en: 'Gap to kart ahead', es: 'Brecha al kart adelante' },                fpv: 0, gopro: 2, overhead: 2, gps: 0 },
      { label: { en: 'Kerb contact detection', es: 'Detección de contacto kerb' },        fpv: 0, gopro: 2, overhead: 1, gps: 0 },
      { label: { en: 'Lap timing', es: 'Tiempo por vuelta' },                             fpv: 0, gopro: 0, overhead: 2, gps: 2 },
      { label: { en: 'Corner phase breakdown', es: 'Desglose por fase de curva' },        fpv: 0, gopro: 0, overhead: 2, gps: 1 },
      { label: { en: 'Speed & telemetry', es: 'Velocidad y telemetría' },                 fpv: 0, gopro: 0, overhead: 0, gps: 2 },
      { label: { en: 'AI coaching (VLM)', es: 'Coaching IA (VLM)' },                     fpv: 2, gopro: 2, overhead: 2, gps: 0 },
    ],
    pipelines: {
      fpv: [
        { step: 'YOLO11n', color: '#1fa84a', desc: { en: 'Detect karts every frame', es: 'Detecta karts cada frame' } },
        { step: 'ByteTrack', color: '#a78bfa', desc: { en: 'Assign persistent IDs', es: 'Asigna IDs persistentes' } },
        { step: 'SAM3 + HSV', color: '#22c55e', desc: { en: 'Text-prompt mask → HSV all frames', es: 'Máscara text-prompt → HSV todos los frames' } },
        { step: 'Scores', color: '#1fa84a', desc: { en: 'LAT POS · CONSIST · EDGE USE', es: 'LAT POS · CONSIST · USO PISTA' } },
        { step: 'Groq LLM', color: '#a78bfa', desc: { en: 'metrics-only summary', es: 'resumen solo métricas' } },
      ],
      gopro: [
        { step: 'YOLO11n', color: '#1fa84a', desc: { en: 'Detect karts every frame', es: 'Detecta karts cada frame' } },
        { step: 'ByteTrack', color: '#a78bfa', desc: { en: 'Track IDs + gap bbox area', es: 'IDs + área bbox para gap' } },
        { step: 'SAM3 + HSV', color: '#22d3ee', desc: { en: 'Text-prompt road mask + L/R kerb', es: 'Máscara text-prompt + kerb izq/der' } },
        { step: 'GAP BAR', color: '#1fa84a', desc: { en: 'Closest kart proximity', es: 'Proximidad al kart más cercano' } },
        { step: 'Groq LLM', color: '#a78bfa', desc: { en: 'metrics-only summary', es: 'resumen solo métricas' } },
      ],
    },
  },
  downhill: {
    sources: [
      { id: 'trail',    label: { en: 'Trail / Helmet Cam', es: 'Cámara de Sendero / Casco' }, tier: 0, recommended: true  },
      { id: 'follow_drone', label: { en: 'Follow Drone',    es: 'Drone de Seguimiento' },      tier: 1, recommended: true },
      { id: 'front_overhead', label:{ en: 'Front / Overhead', es: 'Frontal / Cenital' },       tier: 1, recommended: false },
      { id: 'checkpoint',label:{ en: 'Fixed Checkpoint',    es: 'Checkpoint Fijo' },            tier: 1, recommended: false },
      { id: 'imu',      label: { en: 'IMU / GPS',           es: 'IMU / GPS' },                 tier: 2, recommended: false },
    ],
    rows: [
      { label: { en: 'Full-body posture detection', es: 'Detección de postura cuerpo completo' }, trail: 0, follow_drone: 2, front_overhead: 1, checkpoint: 2, imu: 0 },
      { label: { en: 'POV / cockpit cues', es: 'Señales POV / cockpit' }, trail: 2, follow_drone: 0, front_overhead: 0, checkpoint: 0, imu: 0 },
      { label: { en: 'Visual trail segmentation (SAM2 / SAM3)', es: 'Segmentación visual de sendero (SAM2 / SAM3)' }, trail: 2, follow_drone: 1, front_overhead: 2, checkpoint: 1, imu: 0 },
      { label: { en: 'Line / trajectory geometry', es: 'Geometría de línea / trayectoria' }, trail: 1, follow_drone: 2, front_overhead: 2, checkpoint: 0, imu: 1 },
      { label: { en: 'Obstacle / terrain preview', es: 'Previsualización obstáculos / terreno' }, trail: 2, follow_drone: 1, front_overhead: 1, checkpoint: 1, imu: 0 },
      { label: { en: 'Section breakdown', es: 'Desglose por sección' }, trail: 0, follow_drone: 1, front_overhead: 2, checkpoint: 2, imu: 1 },
      { label: { en: 'Speed / G-force', es: 'Velocidad / G' }, trail: 0, follow_drone: 0, front_overhead: 0, checkpoint: 0, imu: 2 },
      { label: { en: 'AI coaching (VLM)', es: 'Coaching IA (VLM)' }, trail: 2, follow_drone: 2, front_overhead: 2, checkpoint: 2, imu: 0 },
    ],
    pipelines: {
      trail: [
        { step: 'SAM Trail', color: '#eab308', desc: { en: 'Trail surface and obstacle mask from POV footage', es: 'Máscara de sendero y obstáculos desde POV' } },
        { step: 'POV cues', color: '#c97a28', desc: { en: 'Line preview and risk moments from rider view', es: 'Línea próxima y momentos de riesgo desde la vista del rider' } },
        { step: 'Line proxy', color: '#c97a28', desc: { en: 'Trajectory estimate from visible trail geometry', es: 'Estimación de trayectoria desde geometría visible' } },
        { step: 'Groq VLM', color: '#a78bfa', desc: { en: 'one visual coaching pass per video', es: 'un pase visual de coaching por video' } },
      ],
      follow_drone: [
        { step: 'YOLO Pose', color: '#c97a28', desc: { en: 'Full rider body keypoints when visible', es: 'Keypoints de cuerpo completo cuando se ve el rider' } },
        { step: 'Trajectory', color: '#c97a28', desc: { en: 'Rider path relative to the visible corridor', es: 'Trayectoria del rider relativa al corredor visible' } },
        { step: 'Posture + line', color: '#c97a28', desc: { en: 'Combine body position with chosen line', es: 'Combina postura corporal con línea elegida' } },
        { step: 'Groq VLM', color: '#a78bfa', desc: { en: 'frame-specific coaching', es: 'coaching específico de frame' } },
      ],
      front_overhead: [
        { step: 'SAM Trail', color: '#eab308', desc: { en: 'Top/front trail geometry', es: 'Geometría de sendero cenital/frontal' } },
        { step: 'Rider detect', color: '#c97a28', desc: { en: 'Rider centroid more than full pose', es: 'Centroide del rider más que pose completa' } },
        { step: 'Sections', color: '#c97a28', desc: { en: 'Map features / sectors', es: 'Mapea features / sectores' } },
        { step: 'Line geometry', color: '#c97a28', desc: { en: 'Line choice through section', es: 'Elección de línea por sección' } },
      ],
    },
  },
  surf: {
    sources: [
      { id: 'beach',  label: { en: 'Beach / Pier Cam', es: 'Cámara de Playa / Muelle' }, tier: 0, recommended: false },
      { id: 'drone',  label: { en: 'Overhead Drone',   es: 'Drone Cenital' },             tier: 1, recommended: false },
      { id: 'board',  label: { en: 'Board Cam',        es: 'Cámara en Tabla' },           tier: 1, recommended: false },
      { id: 'sensors',label: { en: 'Pressure Sensors', es: 'Sensores de Presión' },       tier: 2, recommended: false },
    ],
    rows: [
      { label: { en: 'Surfer detection', es: 'Detección de surfista' },          beach: 2, drone: 2, board: 0, sensors: 0 },
      { label: { en: 'Pose / balance', es: 'Pose / balance' },                   beach: 1, drone: 2, board: 0, sensors: 0 },
      { label: { en: 'Wave phase detection', es: 'Detección de fase de ola' },   beach: 2, drone: 2, board: 1, sensors: 0 },
      { label: { en: 'Maneuver tagging', es: 'Etiquetado de maniobra' },         beach: 2, drone: 2, board: 0, sensors: 0 },
      { label: { en: 'Timing / pop-up', es: 'Timing / pop-up' },                beach: 1, drone: 1, board: 2, sensors: 0 },
      { label: { en: 'Wave quality score', es: 'Score de calidad de ola' },      beach: 1, drone: 2, board: 0, sensors: 0 },
      { label: { en: 'Load / pressure analysis', es: 'Análisis de carga / presión' }, beach: 0, drone: 0, board: 0, sensors: 2 },
      { label: { en: 'AI coaching (VLM)', es: 'Coaching IA (VLM)' },            beach: 2, drone: 2, board: 1, sensors: 0 },
    ],
    pipelines: {},
  },
};

// Renders a horizontal pipeline flow: [step] → [step] → …
function PipelineFlow({ steps, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 14px', minWidth: 110, maxWidth: 140,
            background: s.color + '10',
            border: `1px solid ${s.color}30`,
            borderRadius: 6,
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: 'Space Mono, monospace', fontSize: 11, color: s.color,
              letterSpacing: '0.06em', textAlign: 'center', marginBottom: 5,
            }}>{s.step}</span>
            <span style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#aaa',
              textAlign: 'center', lineHeight: 1.4,
            }}>{typeof s.desc === 'object' ? (s.desc.es || s.desc.en) : s.desc}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', padding: '0 6px', color: '#333',
              fontFamily: 'Space Mono, monospace', fontSize: 14, flexShrink: 0,
            }}>→</div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function PipelineFlowLang({ steps, lang }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 14px', minWidth: 110, maxWidth: 140,
            background: s.color + '10',
            border: `1px solid ${s.color}30`,
            borderRadius: 6,
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: 'Space Mono, monospace', fontSize: 9, color: s.color,
              letterSpacing: '0.06em', textAlign: 'center', marginBottom: 5,
            }}>{s.step}</span>
            <span style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, color: '#888',
              textAlign: 'center', lineHeight: 1.4,
            }}>{tl(s.desc, lang)}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', padding: '0 6px', color: '#333',
              fontFamily: 'Space Mono, monospace', fontSize: 14, flexShrink: 0,
            }}>→</div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// Camera source matrix + pipeline diagrams
function CameraSection({ sport, sc, lang }) {
  const data = CAMERA_DATA[sport];
  if (!data) return null;
  const { sources, rows, pipelines } = data;
  const col = sc.colorHex;

  // Value cell renderer: 0=none, 1=partial, 2=full
  const Cell = ({ v, color }) => {
    if (v === 2) return <span style={{ color, fontSize: 14 }}>?</span>;
    if (v === 1) return <span style={{ color: '#555', fontSize: 14 }} title="partial">?</span>;
    return <span style={{ color: '#2a2a2a', fontSize: 14 }}>—</span>;
  };

  // Determine column keys from sources
  const colKeys = sources.map(s => s.id);

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Section label */}
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#8a8a8a', letterSpacing: '0.12em', marginBottom: 16 }}>
        {sport === 'downhill'
          ? (lang === 'es' ? 'FUENTE DE VIDEO — ACTUAL Y ROADMAP POR CÁMARA' : 'VIDEO SOURCE — CURRENT AND ROADMAP BY CAMERA')
          : (lang === 'es' ? 'FUENTE DE VIDEO — QUÉ DESBLOQUEA CADA CÁMARA' : 'VIDEO SOURCE — WHAT EACH CAMERA UNLOCKS')}
      </div>

      {/* Camera matrix table */}
      <div style={{ border: '1px solid #222', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `240px repeat(${sources.length}, 1fr)`,
          background: '#141414', borderBottom: '1px solid #222',
        }}>
          <div style={{ padding: '13px 16px', fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#777' }}>
            {lang === 'es' ? 'ANÁLISIS' : 'ANALYSIS'}
          </div>
          {sources.map(src => (
            <div key={src.id} style={{ padding: '13px 8px', textAlign: 'center' }}>
              <div style={{
                fontFamily: 'Space Mono, monospace', fontSize: 11, color: src.recommended ? col : '#777',
                letterSpacing: '0.07em',
              }}>{tl(src.label, lang)}</div>
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center', gap: 4 }}>
                {src.recommended && (
                  <span style={{
                    fontFamily: 'Space Mono, monospace', fontSize: 9, color: col,
                    background: col + '15', border: `1px solid ${col}30`,
                    borderRadius: 3, padding: '1px 5px', letterSpacing: '0.06em',
                  }}>{lang === 'es' ? 'RECOMENDADO' : 'RECOMMENDED'}</span>
                )}
                <span style={{
                  fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#666',
                  background: '#161616', border: '1px solid #222',
                  borderRadius: 3, padding: '1px 5px',
                }}>TIER {src.tier}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Data rows */}
        {rows.map((row, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: `240px repeat(${sources.length}, 1fr)`,
            borderBottom: i < rows.length - 1 ? '1px solid #1a1a1a' : 'none',
            background: i % 2 ? '#0f0f0f' : 'transparent',
            alignItems: 'center',
          }}>
            <div style={{ padding: '16px 18px', fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, color: '#c8c8c0', lineHeight: 1.4 }}>
              {tl(row.label, lang)}
            </div>
            {colKeys.map(key => (
              <div key={key} style={{ textAlign: 'center' }}>
                <Cell v={row[key] ?? 0} color={col} />
              </div>
            ))}
          </div>
        ))}

        {/* Legend */}
        <div style={{
          padding: '8px 16px', background: '#0d0d0d', borderTop: '1px solid #1a1a1a',
          display: 'flex', gap: 18, alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#777', letterSpacing: '0.08em' }}>
            {lang === 'es' ? 'LEYENDA:' : 'LEGEND:'}
          </span>
          {[
            { sym: '?', label: { en: 'Full support', es: 'Soporte completo' }, color: col },
            { sym: '◈', label: { en: 'Partial / reduced accuracy', es: 'Parcial / menor precisión' }, color: '#555' },
            { sym: '—', label: { en: 'Not applicable', es: 'No aplica' }, color: '#2a2a2a' },
          ].map((l, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: l.color, fontSize: 13 }}>{l.sym}</span>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, color: '#999' }}>{tl(l.label, lang)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Pipeline flows per camera: DH mixes current live flow with planned camera adapters. */}
      {Object.keys(pipelines).length > 0 && (
        <div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 14, color: '#a0a0a0', letterSpacing: '0.12em', marginBottom: 16 }}>
            {sport === 'downhill'
              ? (lang === 'es' ? 'FLUJOS POR CÁMARA — ACTUAL + ROADMAP' : 'CAMERA FLOWS — CURRENT + ROADMAP')
              : (lang === 'es' ? 'FLUJO DEL PIPELINE — TIER 0' : 'PIPELINE FLOW — TIER 0')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(pipelines).map(([camId, steps]) => {
              const camSrc = sources.find(s => s.id === camId);
              if (!camSrc) return null;
              return (
                <div key={camId} style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '18px 20px' }}>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: '#999', letterSpacing: '0.08em', marginBottom: 14 }}>
                    {tl(camSrc.label, lang).toUpperCase()}
                  </div>
                  <PipelineFlowLang steps={steps} lang={lang} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const SPORT_TIERS = {
  karting: [
    {
      tier: 0,
      status: 'live',
      statusLabel: { en: 'LIVE NOW', es: 'EN VIVO' },
      input: { en: 'Any video (FPV drone or GoPro helmet cam)', es: 'Cualquier video (drone FPV o GoPro casco)' },
      tech: ['YOLO11n', 'ByteTrack', 'SAM3.1 + HSV', 'Groq LLM + VLM'],
      features: [
        { en: 'Lateral position on track (LAT POS bar)', es: 'Posición lateral en pista (barra LAT POS)' },
        { en: 'Line consistency score per kart', es: 'Score de consistencia de línea por kart' },
        { en: 'Track width utilization score', es: 'Score de uso del ancho de pista' },
        { en: 'Gap to kart ahead (GAP BAR)', es: 'Gap al kart de adelante (GAP BAR)' },
        { en: 'Kerb contact detection L/R', es: 'Detección de contacto con kerb izq/der' },
        { en: 'SAM segmentation by camera view: FPV follow and GoPro action cam both supported today', es: 'Segmentación SAM por vista de cámara: hoy se soportan tanto FPV follow como GoPro action cam' },
        { en: 'No human pose model: karting value comes from kart geometry, track mask, kerbs and gap.', es: 'Sin modelo de pose humana: el valor en karting viene de geometría del kart, máscara de pista, kerbs y gap.' },
        { en: 'LLM summary · auto (metrics only, no image) + VLM on-demand frame analysis (image + time-window metrics)', es: 'Resumen LLM · automático (solo métricas, sin imagen) + análisis VLM de frame bajo demanda (imagen + métricas de ventana temporal)' },
      ],
      limits: [
        { en: 'No lap timing or corner mapping', es: 'Sin tiempo por vuelta ni mapa de curvas' },
        { en: 'No track-specific model (zero-shot only)', es: 'Sin modelo específico del kartodromo (solo zero-shot)' },
        { en: 'GoPro detects visible karts ahead; own-kart position is inferred from road geometry, not directly detected.', es: 'GoPro detecta karts visibles adelante; la posición propia se infiere por geometría de pista, no se detecta directamente.' },
      ],
    },
    {
      tier: 1,
      status: 'planned',
      statusLabel: { en: '~2M', es: '~2M' },
      input: { en: '50+ labelled frames from this track + 50 sessions recorded', es: '50+ frames etiquetados de este kartodromo + 50 sesiones grabadas' },
      tech: ['YOLO11 fine-tuned', 'Lap timer', 'Corner segmentation', 'Helmet detector', 'Groq VLM'],
      features: [
        { en: 'Per-lap score breakdown', es: 'Desglose de score por vuelta' },
        { en: 'Corner phases: brake · turn-in · apex · exit', es: 'Fases de curva: freno · giro · ápex · salida' },
        { en: 'Helmet-specific detection (closer range)', es: 'Detección específica de casco (corta distancia)' },
        { en: 'Gap trend: closing vs. losing ground', es: 'Tendencia de gap: cerrando vs. perdiendo terreno' },
        { en: 'Overtaking opportunity flags (kart L/R)', es: 'Alertas de oportunidad de sobrepaso (kart izq/der)' },
        { en: 'Sector-level coaching per corner', es: 'Coaching por sector, por curva' },
      ],
      limits: [
        { en: 'Requires footage from this specific track', es: 'Requiere footage de este kartodromo específicamente' },
        { en: 'No GPS: lap timing via vision landmarks only', es: 'Sin GPS: tiempo de vuelta solo por landmarks visuales' },
        { en: 'No telemetry (throttle, brake pressure)', es: 'Sin telemetría (acelerador, presión de freno)' },
      ],
    },
    {
      tier: 2,
      status: 'roadmap',
      statusLabel: { en: '6M+', es: '6M+' },
      input: { en: 'Fixed overhead cam + GPS/OBD + expert reference laps', es: 'Cámara fija overhead + GPS/OBD + vueltas de referencia experta' },
      tech: ['Multi-cam fusion', 'GPS/OBD integration', 'Expert line model', 'Edge inference (Jetson/RPi)'],
      features: [
        { en: 'Live coaching overlay on video feed', es: 'Overlay de coaching en tiempo real sobre el video' },
        { en: 'Delta vs. ideal racing line per corner', es: 'Delta vs. línea ideal de carrera por curva' },
        { en: 'Telemetry charts: speed · G-force · throttle', es: 'Telemetría: velocidad · G · acelerador' },
        { en: 'Driver progression score across sessions', es: 'Score de progresión del piloto entre sesiones' },
        { en: 'Automated post-session report', es: 'Reporte automático post-sesión' },
      ],
      limits: [
        { en: 'Hardware installation required at track', es: 'Instalación de hardware requerida en el kartodromo' },
        { en: 'Expert reference laps needed per circuit', es: 'Vueltas de referencia de experto por circuito' },
      ],
    },
    {
      tier: 3,
      status: 'research',
      statusLabel: { en: 'RESEARCH', es: 'INVESTIGACIÓN' },
      input: { en: 'Full Tier 2 data + track geometry model + GPU simulation cluster', es: 'Datos completos Tier 2 + modelo geométrico de la pista + cluster GPU de simulación' },
      tech: ['Sim environment (CARLA/Isaac)', 'PPO / SAC RL agent', 'Digital twin', 'Expert trajectory model', 'Track grip model'],
      features: [
        { en: 'RL agent finds optimal racing line per corner (trained entirely in simulation)', es: 'Agente RL encuentra la línea óptima por curva (entrenado completamente en simulación)' },
        { en: 'Digital twin of track: geometry + grip zones + kerb profiles', es: 'Gemelo digital de la pista: geometría + zonas de grip + perfil de kerbs' },
        { en: 'Real driver line vs RL optimal · delta per sector (e.g. "-0.3 s at corner 4")', es: 'Línea real del piloto vs RL óptimo · delta por sector (ej. "-0.3 s en curva 4")' },
        { en: 'Predictive coaching: simulate "what if you brake 10 m earlier"', es: 'Coaching predictivo: simula "qué pasaría si frenarás 10 m antes"' },
        { en: 'Agent retrains continuously with each new real session', es: 'El agente se re-entrena continuamente con cada sesión real nueva' },
      ],
      limits: [
        { en: 'Track geometry must be surveyed or laser-scanned (±2 cm)', es: 'La geometría de la pista debe ser relevada o escaneada con láser (±2 cm)' },
        { en: 'Requires full Tier 2 telemetry as simulation ground truth', es: 'Requiere telemetría completa Tier 2 como verdad de campo para la simulación' },
        { en: 'Training phase is GPU-intensive (not real-time)', es: 'La fase de entrenamiento requiere cluster GPU (no es tiempo real)' },
        { en: 'Sim-to-real gap: track grip variability affects transfer quality', es: 'Brecha sim-to-real: la variabilidad del grip afecta la calidad de transferencia' },
      ],
    },
  ],
  downhill: [
    {
      tier: 0,
      status: 'live',
      statusLabel: { en: 'LIVE NOW', es: 'EN VIVO' },
      input: { en: 'Base DH review: any video — no labelled data required', es: 'Revisión DH base: cualquier video — sin datos etiquetados' },
      tech: ['YOLO Pose', 'Line proxy', 'Groq llama-4-scout'],
      features: [
        { en: 'Body pose only when the rider is externally visible; GoPro mainly provides POV cues.', es: 'Pose corporal solo cuando el rider se ve desde fuera; GoPro principalmente aporta señales POV.' },
        { en: 'Balance score (hip/shoulder alignment)', es: 'Score de balance (alineación cadera/hombros)' },
        { en: 'Line efficiency from rider trajectory proxy.', es: 'Eficiencia de línea desde proxy de trayectoria.' },
        { en: 'Terrain context is heuristic from speed/posture buckets.', es: 'El contexto de terreno es heurístico desde buckets de velocidad/postura.' },
        { en: 'VLM coaching · 1 call per video', es: 'Coaching VLM · 1 llamada por video' },
      ],
      limits: [
        { en: 'No per-section breakdown (whole run only)', es: 'Sin desglose por sección (solo la bajada completa)' },
        { en: 'For visual trail isolation choose Premium/SAM.', es: 'Para aislamiento visual del sendero elige Premium/SAM.' },
        { en: 'No speed or G-force data', es: 'Sin datos de velocidad o G' },
      ],
    },
    {
      tier: 1,
      status: 'live',
      statusLabel: { en: 'PREMIUM', es: 'PREMIUM' },
      input: { en: 'Camera-specific DH Premium: follow drone, GoPro POV, front/overhead drone', es: 'DH Premium por cámara: dron seguimiento, GoPro POV, dron frontal/cenital' },
      tech: ['SAM trail mask', 'Pose model where body is visible', 'Section detector', 'Groq VLM'],
      features: [
        { en: 'Follow drone: strongest pose + line view when the full rider is visible from outside', es: 'Dron seguimiento: la vista más fuerte para pose + línea cuando el rider se ve completo desde fuera' },
        { en: 'GoPro: SAM trail/obstacle mask + line preview; no full-body posture claim', es: 'GoPro: máscara SAM de sendero/obstáculos + línea próxima; sin prometer postura de cuerpo completo' },
        { en: 'Front/overhead drone: SAM corridor + trajectory geometry + section mapping, weaker posture detail', es: 'Dron frontal/cenital: corredor SAM + geometría de trayectoria + mapeo de secciones, menor detalle postural' },
        { en: 'Per-section posture scoring only where an external body view exists', es: 'Score de postura por sección solo donde existe vista externa del cuerpo' },
        { en: 'Run-over-run comparison', es: 'Comparación bajada a bajada' },
        { en: 'Terrain-specific guidance per section type', es: 'Guía específica por tipo de terreno' },
      ],
      limits: [
        { en: 'Quality depends on visibility, shadows and how clearly the trail separates from vegetation.', es: 'La calidad depende de visibilidad, sombras y qué tan claro se separa el sendero de la vegetación.' },
        { en: 'GoPro and front/overhead already use SAM; follow-drone remains the strongest view for pose.', es: 'GoPro y frontal/cenital ya usan SAM; follow-drone sigue siendo la toma más fuerte para pose.' },
        { en: 'No sensor data (vision only)', es: 'Sin sensores (solo visión)' },
      ],
    },
    {
      tier: 2,
      status: 'roadmap',
      statusLabel: { en: '12M+', es: '12M+' },
      input: { en: 'IMU + GPS + expert reference runs on same trail', es: 'IMU + GPS + bajadas de referencia de experto en el mismo sendero' },
      tech: ['IMU/GPS fusion', 'Expert stance model', 'Real-time edge inference'],
      features: [
        { en: 'Real-time posture feedback during ride', es: 'Feedback de postura en tiempo real durante la bajada' },
        { en: 'Force / load analysis per obstacle', es: 'Análisis de fuerzas / carga por obstáculo' },
        { en: 'Trajectory delta vs. expert reference', es: 'Delta de trayectoria vs. referencia de experto' },
        { en: 'Multi-run progression dashboard', es: 'Dashboard de progresión multi-bajada' },
      ],
      limits: [
        { en: 'Wearable hardware required (IMU vest/helmet)', es: 'Hardware wearable requerido (IMU en chaleco/casco)' },
        { en: 'Expert reference runs needed per trail', es: 'Bajadas de referencia por sendero' },
      ],
    },
  ],
  surf: [
    {
      tier: 0,
      status: 'shell',
      statusLabel: { en: 'COMING', es: 'PRÓXIMO' },
      input: { en: 'Any video — no labelled data required', es: 'Cualquier video — sin datos etiquetados' },
      tech: ['YOLO11', 'SAM3', 'MediaPipe Pose', 'Wave classifier (HSV)'],
      features: [
        { en: 'Surfer detection + pose per frame', es: 'Detección de surfista + pose por frame' },
        { en: 'Wave phase detection (paddle, pop-up, ride)', es: 'Detección de fase de ola (remada, pop-up, ride)' },
        { en: 'Balance / posture analysis', es: 'Análisis de balance / postura' },
        { en: 'Maneuver tagging (cutback, turn, wipeout)', es: 'Etiquetado de maniobras (cutback, giro, caída)' },
      ],
      limits: [
        { en: 'Engine not yet built (declared shell)', es: 'Motor aún no construido (shell declarado)' },
        { en: 'Wave quality not measured', es: 'Calidad de ola no medida' },
        { en: 'No scoring (tagging only)', es: 'Sin scoring (solo etiquetado)' },
      ],
    },
    {
      tier: 1,
      status: 'planned',
      statusLabel: { en: '~4M', es: '~4M' },
      input: { en: '200+ labelled wave/maneuver clips from local break', es: '200+ clips de ola/maniobra etiquetados de la rompiente local' },
      tech: ['Wave segmentation model', 'Maneuver classifier', 'Timing analyzer', 'Groq VLM'],
      features: [
        { en: 'Maneuver quality scores (power, flow, control)', es: 'Scores de calidad de maniobra (potencia, flow, control)' },
        { en: 'Wave selection quality analysis', es: 'Análisis de calidad de selección de ola' },
        { en: 'Pop-up timing feedback', es: 'Feedback de timing de pop-up' },
        { en: 'Session maneuver log + summary', es: 'Log de maniobras de sesión + resumen' },
      ],
      limits: [
        { en: 'Model trained on specific break (not universal)', es: 'Modelo entrenado en rompiente específica (no universal)' },
        { en: 'No real-time (post-session only)', es: 'Sin tiempo real (solo post-sesión)' },
      ],
    },
    {
      tier: 2,
      status: 'roadmap',
      statusLabel: { en: '12M+', es: '12M+' },
      input: { en: 'Drone + board pressure sensors + GPS + judge reference scores', es: 'Drone + sensores de presión de tabla + GPS + scores de referencia de juez' },
      tech: ['Multi-view drone fusion', 'Wave quality model', 'Judge-style scoring', 'Edge inference'],
      features: [
        { en: 'Live heat scoring during competition', es: 'Scoring de heat en vivo durante la competencia' },
        { en: 'Wave quality correlation (size, shape, power)', es: 'Correlación de calidad de ola (tamaño, forma, potencia)' },
        { en: 'Judge-style feedback per ride', es: 'Feedback estilo juez por ride' },
        { en: 'Priority and positioning advice', es: 'Consejo de prioridad y posicionamiento' },
      ],
      limits: [
        { en: 'Drone + sensor hardware required', es: 'Hardware de drone + sensores requerido' },
        { en: 'Judge reference scores needed to calibrate', es: 'Scores de referencia de juez para calibrar' },
      ],
    },
  ],
};

// ── Tech term modals ──────────────────────────────────────────────────────────

const MODAL_CONTENT = {
  'YOLO11n': {
    title: 'YOLO11 nano — Object Detector',
    body: {
      en: 'Ultralytics YOLO11 nano is the latest and fastest variant of the YOLO series (2024). It processes each video frame to produce kart bounding boxes (x, y, w, h, confidence). Compared to YOLOv8n it has improved detection accuracy at the same or higher speed (~200 FPS on CPU). Trained on COCO (80 classes). Karts are detected via the vehicle class family; zero-shot at Tier 0. Override model via KART_YOLO_MODEL env var.',
      es: 'Ultralytics YOLO11 nano es la variante más reciente y rápida de la serie YOLO (2024). Procesa cada frame para producir bounding boxes de karts (x, y, w, h, confianza). Comparado con YOLOv8n tiene mejor precisión a la misma velocidad (~200 FPS en CPU). Entrenado en COCO (80 clases). Karts detectados por familia de clases de vehículos; zero-shot en Tier 0. Sobreescribir modelo con la variable de entorno KART_YOLO_MODEL.',
    },
  },
  'YOLO11 fine-tuned': {
    title: 'YOLO11 Fine-tuning — Domain Adaptation',
    body: {
      en: 'Fine-tuning takes a pre-trained YOLO11 model and continues training on domain-specific labelled data. For Tier 1: manually label 50+ frames from this track (karts, helmets, kerbs). Training runs 50–100 epochs on a GPU (~1 h). Result: detection accuracy jumps at this track\'s camera angle, lighting, and kart types — vs zero-shot COCO.',
      es: 'El fine-tuning toma un modelo YOLO11 pre-entrenado y continúa el entrenamiento con datos del dominio específico. Para Tier 1: etiquetar manualmente 50+ frames de este kartodromo (karts, cascos, kerbs). Entrenamiento de 50–100 épocas en GPU (~1 h). Resultado: la precisión mejora significativamente para este ángulo, iluminación y tipos de kart — vs COCO zero-shot.',
    },
  },
  'ByteTrack': {
    title: 'ByteTrack — Multi-Object Tracker',
    body: {
      en: 'ByteTrack pairs with any detector to assign persistent IDs across frames. Unlike SORT (which only tracks high-confidence detections), ByteTrack also uses low-confidence detections to maintain track continuity through occlusions. It uses a Kalman filter for motion prediction and IoU (Intersection over Union) matching to associate detections frame-to-frame. Result: each kart keeps ID #1, #2… even when karts cross or briefly disappear.',
      es: 'ByteTrack se combina con cualquier detector para asignar IDs persistentes entre frames. A diferencia de SORT (que solo trackea detecciones de alta confianza), ByteTrack también usa detecciones de baja confianza para mantener continuidad durante oclusiones. Usa un filtro de Kalman para predicción de movimiento y matching por IoU (Intersección sobre Unión) para asociar detecciones entre frames. Resultado: cada kart mantiene el ID #1, #2… incluso cuando se cruzan o desaparecen brevemente.',
    },
  },
  'SAM3.1 + HSV': {
    title: 'SAM3.1 + HSV — Track Segmentation',
    body: {
      en: 'Hybrid approach using Meta SAM3.1 (Segment Anything Model 3.1 multiplex, 848M params) with text prompts, calibrated into an HSV mask for full-video speed. Step 1: SAM3 runs on a single best-calibration frame with a natural-language text prompt (e.g. "asphalt karting track surface") — no coordinate clicking needed. Step 2: HSV color ranges are extracted from the SAM3 mask pixels. Step 3: The calibrated HSV filter is applied to all frames at ~100 FPS. Result: 12× faster than SAM3 full-video propagation with no coordinate fragility. The text prompt is customizable per session from the Analyze page.',
      es: 'Enfoque híbrido que usa Meta SAM3.1 (Segment Anything Model 3.1 multiplex, 848M params) con text prompts, calibrado en una máscara HSV para velocidad en todo el video. Paso 1: SAM3 corre sobre un único frame de calibración con un prompt de texto en lenguaje natural (ej. "asphalt karting track surface") — sin necesidad de hacer clic en coordenadas. Paso 2: Los rangos de color HSV se extraen de los píxeles de la máscara SAM3. Paso 3: El filtro HSV calibrado se aplica a todos los frames a ~100 FPS. Resultado: 12× más rápido que la propagación SAM3 completa sin fragilidad de coordenadas. El texto del prompt es personalizable por sesión desde la página de Analizar.',
    },
  },
  'HSV mask': {
    title: 'HSV Mask — Track Color Filtering',
    body: {
      en: 'Hue-Saturation-Value color space filtering. HSV separates color (Hue) from brightness (Value), making it more robust to lighting changes than RGB. The SAM3 mask from the calibration frame extracts the H, S, V min/max ranges of the asphalt for this specific camera and lighting. Those calibrated ranges are applied every frame via cv2.inRange() to produce the green track overlay without re-running SAM3.',
      es: 'Filtrado por espacio de color Hue-Saturation-Value. HSV separa el color (Hue) del brillo (Value), haciéndolo más robusto ante cambios de iluminación que RGB. La máscara SAM3 del frame de calibración extrae los rangos mínimos y máximos de H, S, V del asfalto para esta cámara e iluminación específica. Esos rangos se aplican en cada frame con cv2.inRange() produciendo el overlay verde de pista sin volver a ejecutar SAM3.',
    },
  },
  'Groq llama-4-scout': {
    title: 'Groq llama-4-scout — LLM + VLM',
    body: {
      en: "Two distinct AI calls via Groq llama-4-scout:\n\n• LLM (automatic, text-only): runs once at end of pipeline using ONLY session metrics — kart scores, kerb rate, consistency, edge use. No image sent. Returns a general performance summary.\n\n• VLM (on-demand, image + time-window metrics): activates only when the user explicitly pins a timestamp in the review player. Input: annotated frame at that exact moment + telemetry within ±5s (kerb events, gap, apex markers, session stats). Returns frame-specific coaching. The VLM never runs automatically — it can only comment on visual content when a frame is deliberately selected.\n\nGroq LPU: ~800 tokens/s, each call under 2 s.",
      es: "Dos llamadas IA distintas vía Groq llama-4-scout:\n\n• LLM (automático, solo texto): se ejecuta una vez al final del pipeline usando ÚNICAMENTE métricas de sesión — scores de karts, tasa de kerb, consistencia, uso de pista. Sin imagen. Devuelve un resumen general de rendimiento.\n\n• VLM (bajo demanda, imagen + métricas de ventana temporal): solo se activa cuando el usuario ancla explícitamente un timestamp en el reproductor. Entrada: el frame anotado exacto en ese momento + telemetría dentro de ±5s (eventos kerb, gap, marcadores de ápex, estadísticas globales). Devuelve coaching específico de ese instante. El VLM nunca corre automáticamente — solo puede opinar sobre contenido visual cuando un frame es deliberadamente seleccionado.\n\nLPU de Groq: ~800 tokens/s, cada llamada en menos de 2 s.",
    },
  },
  'PPO / SAC RL agent': {
    title: 'Reinforcement Learning — PPO & SAC',
    body: {
      en: 'Proximal Policy Optimization (PPO) and Soft Actor-Critic (SAC) are state-of-the-art RL algorithms for continuous control. In the karting context, the agent learns a policy: given track state (position, speed, heading), output optimal steering/throttle to minimize lap time. The agent trains entirely inside a simulation (digital twin), using millions of virtual laps. The resulting optimal racing line is then used to analyze real driver footage — no on-track training required.',
      es: 'Proximal Policy Optimization (PPO) y Soft Actor-Critic (SAC) son algoritmos de RL de última generación para control continuo. En el contexto del karting, el agente aprende una política: dado el estado de la pista (posición, velocidad, rumbo), generar el volante/acelerador óptimo para minimizar el tiempo de vuelta. El agente se entrena completamente dentro de una simulación (gemelo digital), usando millones de vueltas virtuales. La línea de carrera óptima resultante se usa para analizar el footage real — sin entrenamiento en pista.',
    },
  },
  'Digital twin': {
    title: 'Digital Twin — Virtual Track Model',
    body: {
      en: 'A digital twin is a physics-accurate virtual replica of a physical system. For a karting track: (1) precise geometric model of track layout (from laser scan or photogrammetry), (2) surface friction model per zone (asphalt grip, kerb grip, grass penalty), (3) kart physics model (weight, tire curve, engine torque). The RL agent trains inside this simulation. The fidelity of the twin directly determines the quality of the coaching output transferred to real-world driving.',
      es: 'Un gemelo digital es una réplica virtual con física precisa de un sistema físico. Para un kartodromo: (1) modelo geométrico preciso del trazado (de escaneo láser o fotogrametría), (2) modelo de fricción superficial por zona (grip del asfalto, grip del kerb, penalización de césped), (3) modelo físico del kart (peso, curva de neumático, torque del motor). El agente RL se entrena dentro de esta simulación. La fidelidad del gemelo determina directamente la calidad del coaching transferido a la conducción real.',
    },
  },
  'MediaPipe Pose': {
    title: 'MediaPipe Pose — Body Keypoint Estimation',
    body: {
      en: 'Google MediaPipe Pose detects 33 body landmarks (keypoints) per frame in real time, including shoulders, hips, knees, ankles, and wrists. For downhill analysis, the key landmarks are shoulders, hips, and knees — used to compute trunk lean angle, hip/shoulder alignment, and center-of-mass position relative to the bike. Runs on CPU at ~30 FPS. Zero-shot, no training required.',
      es: 'Google MediaPipe Pose detecta 33 puntos de referencia corporales (keypoints) por frame en tiempo real, incluyendo hombros, caderas, rodillas, tobillos y muñecas. Para el análisis de downhill, los landmarks clave son hombros, caderas y rodillas — usados para calcular el ángulo de inclinación del tronco, alineación cadera/hombros, y posición del centro de masa relativo a la bici. Corre en CPU a ~30 FPS. Zero-shot, sin entrenamiento requerido.',
    },
  },
  'Sim environment (CARLA/Isaac)': {
    title: 'Simulation Environment — CARLA / Isaac Sim',
    body: {
      en: 'CARLA (open-source) and NVIDIA Isaac Sim are physics-accurate driving simulators. For karting, a custom track model is loaded into the simulator with the kart physics parameters. The RL agent interacts with the simulation at 1000+ steps/second (much faster than real time), allowing millions of laps to be trained in hours. The simulator handles tire physics, collision detection, and environmental effects (grip under rain, etc.).',
      es: 'CARLA (open-source) y NVIDIA Isaac Sim son simuladores de conducción con física precisa. Para karting, se carga un modelo personalizado de la pista en el simulador con los parámetros físicos del kart. El agente RL interactúa con la simulación a 1000+ pasos/segundo (mucho más rápido que el tiempo real), permitiendo entrenar millones de vueltas en horas. El simulador maneja la física de neumáticos, detección de colisiones y efectos ambientales (grip bajo lluvia, etc.).',
    },
  },
};

function InfoModal({ term, onClose, lang, color }) {
  const content = MODAL_CONTENT[term];
  if (!content) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#00000092', backdropFilter: 'blur(6px)',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#141414', border: `1px solid ${color}40`,
          borderRadius: 12, padding: '28px 30px',
          maxWidth: 520, width: '90%',
          boxShadow: `0 0 40px ${color}18`,
        }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <div>
            <span style={{
              fontFamily: 'Space Mono, monospace', fontSize: 8, color, letterSpacing: '0.1em',
              background: color + '15', border: `1px solid ${color}30`,
              borderRadius: 3, padding: '2px 8px', display: 'inline-block', marginBottom: 8,
            }}>{term}</span>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, fontWeight: 700, color: '#EDEDE8' }}>
              {content.title}
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#555', fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: -2 }}>×</button>
        </div>
        {/* Body */}
        <p style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#aaa', lineHeight: 1.75 }}>
          {tl(content.body, lang)}
        </p>
        <div style={{ marginTop: 18, textAlign: 'right' }}>
          <button onClick={onClose} style={{
            fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#555',
            border: '1px solid #2a2a2a', borderRadius: 4, padding: '4px 14px',
            letterSpacing: '0.08em',
          }}>{lang === 'es' ? 'CERRAR' : 'CLOSE'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Tier block ────────────────────────────────────────────────────────────────

function TierBlock({ tier, sc, lang }) {
  const [modalTerm, setModalTerm] = useState(null);
  const isLive     = tier.status === 'live';
  const isShell    = tier.status === 'shell';
  const isResearch = tier.status === 'research';
  const statusColor = isLive ? '#22c55e' : isResearch ? '#818cf8' : isShell ? '#555' : '#6b6b6b';
  const dim = !isLive;

  const col = sc.colorHex;

  return (
    <div style={{
      border: `1px solid ${isLive ? col + '55' : '#1e1e1e'}`,
      borderRadius: 10, overflow: 'hidden',
      background: isLive ? col + '07' : '#0d0d0d',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px', background: '#141414', borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 15, color: dim ? '#777' : col, letterSpacing: '0.1em', flexShrink: 0 }}>
          TIER {tier.tier}
        </span>
        <span style={{
          fontFamily: 'Space Mono, monospace', fontSize: 12, letterSpacing: '0.07em',
          color: statusColor, border: `1px solid ${statusColor}50`, borderRadius: 3, padding: '2px 9px', flexShrink: 0,
        }}>
          {tl(tier.statusLabel, lang)}
        </span>
        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, color: dim ? '#b8b8b0' : '#e6e3dc', flex: 1, lineHeight: 1.35 }}>
          {tl(tier.input, lang)}
        </span>
      </div>

      {/* Body: 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 0 }}>

        {/* Tech stack */}
        <div style={{ padding: '22px 24px', borderRight: '1px solid #1a1a1a' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: dim ? '#888' : '#aaa', letterSpacing: '0.09em', marginBottom: 16 }}>
            {lang === 'es' ? 'TECNOLOGÍAS' : 'TECH STACK'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tier.tech.map((t, i) => {
              const hasModal = !!MODAL_CONTENT[t];
              return (
                <span key={i}
                  onClick={() => hasModal && setModalTerm(t)}
                  title={hasModal ? (lang === 'es' ? 'Haz clic para saber más' : 'Click to learn more') : undefined}
                  style={{
                    fontFamily: 'Space Mono, monospace', fontSize: 13,
                    color: dim ? '#aaa' : col,
                    background: dim ? '#1c1c1c' : col + '12',
                    border: `1px solid ${dim ? '#333' : col + '25'}`,
                    borderRadius: 3, padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: 6,
                    whiteSpace: 'nowrap', width: 'fit-content',
                    cursor: hasModal ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}>
                  {t}
                  {hasModal && (
                    <span style={{ fontSize: 10, opacity: 0.65, fontFamily: 'Space Mono, monospace' }}>i</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Features */}
        <div style={{ padding: '22px 24px', borderRight: '1px solid #1a1a1a' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: dim ? '#888' : '#aaa', letterSpacing: '0.09em', marginBottom: 16 }}>
            {lang === 'es' ? 'QUÉ ENTREGA' : 'WHAT YOU GET'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tier.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: dim ? '#666' : col, fontSize: 12, flexShrink: 0, marginTop: 3 }}>◆</span>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, color: dim ? '#c8c8c0' : '#F4F1EA', lineHeight: 1.55 }}>
                  {tl(f, lang)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Requirements / Limitations */}
        <div style={{ padding: '22px 24px' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: dim ? '#888' : '#aaa', letterSpacing: '0.09em', marginBottom: 16 }}>
            {isLive
              ? (lang === 'es' ? 'LÍMITES A CONSIDERAR' : 'LIMITS TO CONSIDER')
              : (lang === 'es' ? 'REQUISITOS / LÍMITES' : 'REQUIREMENTS / LIMITS')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tier.limits.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: isLive ? '#ef6444' : '#eab308', fontSize: 13, flexShrink: 0, marginTop: 3 }}>
                  {isLive ? '!' : '→'}
                </span>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, color: dim ? '#c8c8c0' : '#d8d6ce', lineHeight: 1.55 }}>
                  {tl(l, lang)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalTerm && (
        <InfoModal
          term={modalTerm}
          onClose={() => setModalTerm(null)}
          lang={lang}
          color={isLive ? col : statusColor}
        />
      )}
    </div>
  );
}

const CAMERA_TIER_GUIDES = {
  karting: {
    fpv_follow: [
      {
        tier: '0',
        status: 'live',
        statusLabel: { en: 'LIVE NOW', es: 'EN VIVO' },
        input: { en: 'FPV / follow drone video from above-behind', es: 'Video FPV / dron de seguimiento desde arriba-atrás' },
        tech: ['YOLO11n', 'ByteTrack', 'SAM3.1 + HSV', 'Groq LLM + VLM'],
        features: [
          { en: 'Track mask with SAM on FPV footage', es: 'Máscara de pista con SAM sobre footage FPV' },
          { en: 'Kart detection + stable lateral-position proxy', es: 'Detección de kart + proxy estable de posición lateral' },
          { en: 'Line consistency and track-width use', es: 'Consistencia de línea y uso del ancho de pista' },
        ],
        limits: [
          { en: 'No lap timing or corner map yet', es: 'Aún sin tiempo por vuelta ni mapa de curvas' },
          { en: 'Focus is kart path, not driver body pose', es: 'El foco es la trayectoria del kart, no la pose del piloto' },
        ],
      },
      {
        tier: '1',
        status: 'planned',
        statusLabel: { en: 'NEXT', es: 'SIGUIENTE' },
        input: { en: 'Same camera + track-specific labels', es: 'La misma cámara + etiquetas específicas del circuito' },
        tech: ['YOLO11 fine-tuned', 'Corner segmentation', 'Groq VLM'],
        features: [
          { en: 'Per-corner breakdown and sector coaching', es: 'Desglose por curva y coaching por sector' },
          { en: 'Track-specific line model instead of zero-shot only', es: 'Modelo de línea específico del circuito, no solo zero-shot' },
        ],
        limits: [
          { en: 'Needs labelled data from that circuit', es: 'Necesita datos etiquetados de ese circuito' },
        ],
      },
      {
        tier: '2',
        status: 'roadmap',
        statusLabel: { en: 'HARDWARE+', es: 'HARDWARE+' },
        input: { en: 'FPV + overhead + GPS/OBD fusion', es: 'FPV + cenital + fusión GPS/OBD' },
        tech: ['Multi-cam fusion', 'GPS/OBD integration', 'Expert line model'],
        features: [
          { en: 'Delta vs ideal line and session progression', es: 'Delta vs línea ideal y progresión entre sesiones' },
        ],
        limits: [
          { en: 'Requires track hardware and calibration', es: 'Requiere hardware e instalación en pista' },
        ],
      },
    ],
    action_cam: [
      {
        tier: '0',
        status: 'live',
        statusLabel: { en: 'LIVE NOW', es: 'EN VIVO' },
        input: { en: 'GoPro / helmet action-cam footage', es: 'Footage GoPro / action cam de casco' },
        tech: ['SAM3.1 + HSV', 'YOLO11n', 'ByteTrack', 'Groq LLM + VLM'],
        features: [
          { en: 'SAM track mask on the road ahead', es: 'Máscara SAM de la pista adelante' },
          { en: 'Apex direction, kerb L/R and gap to visible karts', es: 'Dirección de ápex, kerb izq/der y gap a karts visibles' },
          { en: 'Own-kart position inferred from view geometry', es: 'Posición propia inferida por geometría de vista' },
        ],
        limits: [
          { en: 'Not a direct physical own-kart detector', es: 'No detecta directamente un punto físico del kart propio' },
          { en: 'Weaker than overhead for absolute race geometry', es: 'Más débil que una cenital para geometría absoluta de carrera' },
        ],
      },
      {
        tier: '1',
        status: 'planned',
        statusLabel: { en: 'NEXT', es: 'SIGUIENTE' },
        input: { en: 'Same camera + track-specific visual landmarks', es: 'La misma cámara + landmarks visuales del circuito' },
        tech: ['Corner segmentation', 'Lap timer', 'Groq VLM'],
        features: [
          { en: 'Corner-by-corner narrative from POV footage', es: 'Narrativa curva por curva desde POV' },
          { en: 'Gap trends and overtaking-context flags', es: 'Tendencias de gap y alertas de contexto de sobrepaso' },
        ],
        limits: [
          { en: 'Still vision-only; no throttle/brake telemetry', es: 'Sigue siendo solo visión; sin telemetría de acelerador/freno' },
        ],
      },
      {
        tier: '2',
        status: 'roadmap',
        statusLabel: { en: 'OVERHEAD+', es: 'CENITAL+' },
        input: { en: 'GoPro + overhead race view + sensors', es: 'GoPro + vista cenital de carrera + sensores' },
        tech: ['Multi-cam fusion', 'GPS/OBD integration', 'Expert line model'],
        features: [
          { en: 'POV decisions tied to full-race geometry', es: 'Decisiones POV conectadas con la geometría completa de carrera' },
        ],
        limits: [
          { en: 'Requires additional cameras and calibrated track references', es: 'Requiere cámaras adicionales y referencias calibradas' },
        ],
      },
    ],
    overhead_drone: [
      {
        tier: '1',
        status: 'planned',
        statusLabel: { en: 'PLANNED', es: 'PLANIFICADO' },
        input: { en: 'Overhead drone over sector or full circuit', es: 'Dron cenital sobre sector o circuito completo' },
        tech: ['SAM3.1 + HSV', 'YOLO11n', 'ByteTrack'],
        features: [
          { en: 'Best geometry view for sectors, trajectories and multi-kart structure', es: 'La mejor vista geométrica para sectores, trayectorias y estructura multi-kart' },
        ],
        limits: [
          { en: 'Not yet exposed as a live production flow', es: 'Aún no está expuesto como flujo live de producción' },
        ],
      },
    ],
  },
  downhill: {
    drone_follow: [
      {
        tier: '0',
        status: 'live',
        statusLabel: { en: 'LIVE NOW', es: 'EN VIVO' },
        input: { en: 'Follow drone with rider visible from outside', es: 'Dron de seguimiento con el rider visible desde fuera' },
        tech: ['YOLO Pose', 'Line proxy', 'Groq llama-4-scout'],
        features: [
          { en: 'Strongest current view for posture + line together', es: 'La toma actual más fuerte para postura + línea juntas' },
          { en: 'Balance, body timing and commitment moments', es: 'Balance, timing corporal y momentos de compromiso' },
        ],
        limits: [
          { en: 'Trail isolation is weaker here than in POV / front-overhead SAM views', es: 'El aislamiento de sendero aquí es más débil que en POV / frontal-cenital con SAM' },
        ],
      },
      {
        tier: '1',
        status: 'live',
        statusLabel: { en: 'PREMIUM', es: 'PREMIUM' },
        input: { en: 'Follow drone + clearer corridor visibility', es: 'Dron de seguimiento + mejor visibilidad del corredor' },
        tech: ['Pose model', 'Section detector', 'Groq VLM'],
        features: [
          { en: 'Per-section posture scoring where the rider is visible', es: 'Score de postura por sección cuando el rider se ve bien' },
          { en: 'Run-over-run comparison', es: 'Comparación bajada a bajada' },
        ],
        limits: [
          { en: 'Depends heavily on how cleanly the rider stays visible', es: 'Depende mucho de qué tan limpio se ve al rider' },
        ],
      },
    ],
    helmet_cam: [
      {
        tier: '0',
        status: 'live',
        statusLabel: { en: 'LIVE NOW', es: 'EN VIVO' },
        input: { en: 'Helmet / chest GoPro POV', es: 'GoPro POV de casco / pecho' },
        tech: ['SAM trail mask', 'Line proxy', 'Groq VLM'],
        features: [
          { en: 'SAM trail and obstacle isolation from POV footage', es: 'Aislamiento SAM de sendero y obstáculos desde POV' },
          { en: 'Line preview, danger cues and section reading ahead', es: 'Línea próxima, señales de riesgo y lectura de sección' },
        ],
        limits: [
          { en: 'No full-body posture claim from POV footage', es: 'No promete postura corporal completa desde POV' },
        ],
      },
      {
        tier: '1',
        status: 'planned',
        statusLabel: { en: 'NEXT', es: 'SIGUIENTE' },
        input: { en: 'Same POV + more stable trail prompts', es: 'El mismo POV + prompts más estables de sendero' },
        tech: ['SAM prompt presets', 'Section detector', 'Groq VLM'],
        features: [
          { en: 'Stronger section-by-section trail interpretation', es: 'Interpretación de sendero más fuerte por sección' },
        ],
        limits: [
          { en: 'Still a rider-view system, not an external-pose system', es: 'Sigue siendo un sistema POV, no uno de pose externa' },
        ],
      },
    ],
    drone_front_overhead: [
      {
        tier: '0',
        status: 'live',
        statusLabel: { en: 'LIVE NOW', es: 'EN VIVO' },
        input: { en: 'Front or overhead drone over a DH section', es: 'Dron frontal o cenital sobre una sección DH' },
        tech: ['SAM trail mask', 'Section geometry', 'Groq VLM'],
        features: [
          { en: 'Best current DH camera for corridor geometry and section mapping', es: 'La mejor cámara DH actual para geometría de corredor y mapeo de secciones' },
          { en: 'Trajectory review with SAM context', es: 'Revisión de trayectoria con contexto SAM' },
        ],
        limits: [
          { en: 'Weaker posture detail than follow-drone', es: 'Menor detalle postural que el dron de seguimiento' },
        ],
      },
      {
        tier: '1',
        status: 'planned',
        statusLabel: { en: 'NEXT', es: 'SIGUIENTE' },
        input: { en: 'Same camera + repeated runs through same feature', es: 'La misma cámara + repeticiones del mismo feature' },
        tech: ['Section detector', 'Trajectory comparator'],
        features: [
          { en: 'Entry/exit comparison across repeated attempts', es: 'Comparación entrada/salida entre intentos repetidos' },
        ],
        limits: [
          { en: 'Best per-section, not whole-mountain from one angle', es: 'Mejor por sección, no para toda la montaña desde un solo ángulo' },
        ],
      },
    ],
  },
};

function CameraTierRoadmap({ sport, cameraMode, sc, lang }) {
  const tiers = CAMERA_TIER_GUIDES[sport]?.[cameraMode] || [];
  if (!tiers.length) return null;
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 14, color: sc.color, letterSpacing: '0.12em', marginBottom: 20 }}>
        {lang === 'es' ? 'ROADMAP POR CÁMARA' : 'CAMERA-SPECIFIC ROADMAP'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tiers.map(tier => (
          <TierBlock key={`${cameraMode}-${tier.tier}`} tier={tier} sc={sc} lang={lang} />
        ))}
      </div>
    </div>
  );
}

export function MethodPage({ state, setState }) {
  const { sport, lang } = state;
  const sc = SPORTS[sport];
  const cameraModes = CAMERA_MODES[sport] || [];
  const [methodCamera, setMethodCamera] = useState(() => {
    const first = cameraModes.find(m => m.available) || cameraModes[0];
    return first?.id || null;
  });

  useEffect(() => {
    const modes = CAMERA_MODES[sport] || [];
    const first = modes.find(m => m.available) || modes[0];
    setMethodCamera(first?.id || null);
  }, [sport]);

  const tiers = CAMERA_TIER_GUIDES[sport]?.[methodCamera] || SPORT_TIERS[sport] || SPORT_TIERS.downhill;

  const CAP_MATRIX = [
    { en: 'Video analysis',       es: 'Análisis de video',        dh: true,  kt: true,  sf: true  },
    { en: 'Pose / posture',       es: 'Pose / postura',           dh: true,  kt: false, sf: true  },
    { en: 'Track segmentation',   es: 'Segmentación de pista',    dh: false, kt: true,  sf: false },
    { en: 'Lateral position',     es: 'Posición lateral',         dh: false, kt: true,  sf: false },
    { en: 'Line review',          es: 'Revisión de línea',        dh: true,  kt: true,  sf: false },
    { en: 'Wave / terrain ctx.',  es: 'Contexto ola / terreno',   dh: true,  kt: false, sf: true  },
    { en: 'Multi-kart tracking',  es: 'Tracking multi-kart',      dh: false, kt: true,  sf: false },
    { en: 'VLM coaching',         es: 'Coaching VLM',             dh: true,  kt: true,  sf: true  },
    { en: 'Session playback',     es: 'Reproducción',             dh: true,  kt: true,  sf: true  },
  ];

  const sportList = Object.values(SPORTS);
  const sportSelectorTitle = lang === 'es' ? 'ELIGE DISCIPLINA' : 'CHOOSE DISCIPLINE';
  const sportSelectorCopy = lang === 'es'
    ? 'Primero elige el deporte. Luego mostramos qué cámaras sirven, qué entrega cada tier y dónde están los límites reales.'
    : 'Start with the sport. Then we show which cameras work, what each tier delivers, and where the real limits are.';

  return (
    <div style={{ padding: '52px 0 0', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '56px 38px' }}>

        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 14, color: '#a0a0a0', letterSpacing: '0.12em', marginBottom: 14 }}>
            {lang === 'es' ? 'CÓMO SE HACE' : 'HOW IT WORKS'}
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 44, fontWeight: 700, color: '#F4F1EA', margin: 0, lineHeight: 1.08 }}>
            {lang === 'es' ? 'Qué se puede medir con cada cámara' : 'What each camera can measure'}
          </h2>
          <p style={{ margin: '12px 0 0', maxWidth: 860, fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, color: '#c8c8c0', lineHeight: 1.65 }}>
            {lang === 'es'
              ? 'Primero mostramos valor deportivo. La tecnología aparece aquí para explicar límites y confianza, no para decorar.'
              : 'Athlete value comes first. Technology is shown here to explain limits and confidence, not as decoration.'}
          </p>
        </div>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: '#a0a0a0', letterSpacing: '0.12em', marginBottom: 10 }}>
            {sportSelectorTitle}
          </div>
          <p style={{ margin: '0 0 18px', maxWidth: 820, fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, color: '#9a9a92', lineHeight: 1.6 }}>
            {sportSelectorCopy}
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}>
            {sportList.map(item => {
              const active = item.id === sport;
              return (
                <button
                  key={item.id}
                  onClick={() => setState(s => ({ ...s, sport: item.id }))}
                  style={{
                    textAlign: 'left',
                    background: active ? `${item.colorHex}12` : '#101010',
                    border: `1px solid ${active ? item.color : '#202020'}`,
                    borderRadius: 8,
                    padding: '18px 18px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    minHeight: 148,
                    boxShadow: active ? `0 0 0 1px ${item.color}20 inset` : 'none',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: item.color, letterSpacing: '0.12em', marginBottom: 8 }}>
                        {item.abbr}
                      </div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 24, fontWeight: 600, color: '#F4F1EA', lineHeight: 1.1 }}>
                        {tl(item.label, lang)}
                      </div>
                    </div>
                    <StatusPill readiness={item.readiness} lang={lang} />
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, color: '#b8b8b0', lineHeight: 1.55 }}>
                    {tl(item.tagline, lang)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {item.capabilities.slice(0, 2).map(cap => (
                      <CapChip key={cap.id} cap={cap} sport={item.id} lang={lang} compact />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tier flows */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 14, color: sc.color, letterSpacing: '0.12em', marginBottom: 20 }}>
            {tl(sc.label, lang).toUpperCase()} — {lang === 'es' ? 'PLAN DE CAPACIDADES POR TIER' : 'CAPABILITY ROADMAP BY TIER'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tiers.map(tier => (
              <TierBlock key={tier.tier} tier={tier} sc={sc} lang={lang} />
            ))}
          </div>
        </div>

        {/* Camera source matrix + pipeline flows */}
        <CameraSection sport={sport} sc={sc} lang={lang} />

        {/* Capability matrix */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 14, color: '#a0a0a0', letterSpacing: '0.12em', marginBottom: 18 }}>
            {lang === 'es' ? 'MATRIZ DE CAPACIDADES POR DEPORTE' : 'CAPABILITY MATRIX BY SPORT'}
          </div>
          <div style={{ border: '1px solid #222', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '220px repeat(3, 1fr)', background: '#161616', borderBottom: '1px solid #222' }}>
              <div style={{ padding: '14px 18px', fontFamily: 'Space Mono, monospace', fontSize: 13, color: '#a0a0a0' }}>CAPABILITY</div>
              {sportList.map(s => (
                <div key={s.id} style={{ padding: '14px 0', fontFamily: 'Space Mono, monospace', fontSize: 13, color: s.color, textAlign: 'center', letterSpacing: '0.08em' }}>
                  {s.abbr}
                </div>
              ))}
            </div>
            {CAP_MATRIX.map((row, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '220px repeat(3, 1fr)',
                borderBottom: i < CAP_MATRIX.length - 1 ? '1px solid #22222228' : 'none',
                background: i % 2 ? '#0f0f0f' : 'transparent',
                alignItems: 'center',
              }}>
                <div style={{ padding: '14px 18px', fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, color: '#c8c8c0' }}>
                  {row[lang] || row.en}
                </div>
                {[row.dh, row.kt, row.sf].map((has, j) => {
                  const s = sportList[j];
                  return (
                    <div key={j} style={{ textAlign: 'center', fontSize: 16 }}>
                      <span style={{ color: has ? s.color : '#222' }}>{has ? '◆' : '—'}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Session model */}
        <div style={{ padding: '20px 22px', border: '1px solid #222', borderRadius: 8, background: '#0d142180' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#8a8a8a', letterSpacing: '0.1em', marginBottom: 14 }}>
            {lang === 'es' ? 'MODELO DE SESIÓN' : 'SESSION MODEL'}
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 14, lineHeight: 1.9, color: '#777' }}>
            <span style={{ color: '#a1a1a1' }}>session</span> {'{'}<br />
            {'  '}<span style={{ color: '#6b6b6b' }}>session_id</span><span style={{ color: '#3a3a3a' }}>:</span> <span style={{ color: '#888' }}>YYYYMMDD_HHMMSS</span><br />
            {'  '}<span style={{ color: '#6b6b6b' }}>sport</span><span style={{ color: '#3a3a3a' }}>:</span> <span style={{ color: '#888' }}>downhill | karting | surf</span><br />
            {'  '}<span style={{ color: '#6b6b6b' }}>capabilities</span><span style={{ color: '#3a3a3a' }}>:</span> <span style={{ color: '#888' }}>Capability[]</span><br />
            {'  '}<span style={{ color: '#6b6b6b' }}>artifacts</span><span style={{ color: '#3a3a3a' }}>:</span> <span style={{ color: '#888' }}>annotated_video · features.csv · features.json</span><br />
            {'  '}<span style={{ color: '#6b6b6b' }}>readiness</span><span style={{ color: '#3a3a3a' }}>:</span> <span style={{ color: '#888' }}>live | beta | shell</span><br />
            {'}'}
          </div>
        </div>

      </div>
    </div>
  );
}

