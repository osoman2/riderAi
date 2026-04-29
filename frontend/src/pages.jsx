import React, { useState, useEffect } from 'react';
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
              SPORTOTIMIZATION — v2.0 / MULTI-SPORT FOUNDATION
            </div>
            <h1 style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 'clamp(36px, 5vw, 60px)',
              fontWeight: 700, color: '#EDEDE8',
              margin: '0 0 12px', lineHeight: 1.08, letterSpacing: '-0.02em',
            }}>
              {lang === 'es' ? 'Sube una sesión.' : 'Upload a session.'}<br />
              <span style={{ color: '#3a3a3a' }}>
                {lang === 'es' ? 'Recibe el siguiente paso.' : 'Get the next step.'}
              </span>
            </h1>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, color: '#6b6b6b', maxWidth: 460, lineHeight: 1.65, margin: '0 0 28px' }}>
              {lang === 'es'
                ? 'Análisis de rendimiento multideporte. Un sistema, adaptadores por deporte, capacidades declaradas.'
                : 'Multi-sport performance analysis. One system, sport-specific adapters, declared capabilities.'}
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
                onClick={() => setState(s => ({ ...s, page: 'sessions' }))}
                style={{
                  background: 'none', border: '1px solid #22222270', borderRadius: 6,
                  padding: '11px 22px', cursor: 'pointer',
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: 14,
                  color: '#6b6b6b', transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#EDEDE8'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#22222270'; e.currentTarget.style.color = '#6b6b6b'; }}>
                {lang === 'es' ? 'Ver sesiones' : 'View sessions'}
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

        {/* Shared model strip */}
        <div style={{
          padding: '18px 22px', border: '1px solid #222', borderRadius: 8,
          background: '#0f0f0f', display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', letterSpacing: '0.1em', flexShrink: 0 }}>
            {lang === 'es' ? 'MODELO COMPARTIDO' : 'SHARED SESSION MODEL'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['session_id', 'sport', 'capabilities[]', 'artifacts[]', 'readiness_state'].map(k => (
              <span key={k} style={{
                fontFamily: 'Space Mono, monospace', fontSize: 10,
                color: '#555', background: '#161616',
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
        en: 'Drone follows rider from above or behind. Full body visible — enables pose estimation, terrain segmentation, and line consistency scoring.',
        es: 'Drone sigue al rider desde arriba o atrás. Cuerpo completo visible — habilita estimación de pose, segmentación de terreno y scoring de línea.',
      },
      outputs: ['POSE EST.', 'LINE', 'TERRAIN SEG.'],
      available: true,
      color: '#f59e0b',
    },
    {
      id: 'helmet_cam',
      label: { en: 'Helmet / Body Cam', es: 'Cámara de Casco / Cuerpo' },
      icon: '⛑️',
      desc: {
        en: 'First-person view from helmet or chest mount. Terrain segmentation and upcoming line preview. Limited pose data (upper body only).',
        es: 'Vista en primera persona desde casco o pecho. Segmentación de terreno y previsualización de línea. Datos de pose limitados (parte superior).',
      },
      outputs: ['TERRAIN SEG.', 'LINE PREVIEW'],
      available: false,
      comingSoon: true,
      color: '#f59e0b',
    },
    {
      id: 'static_tripod',
      label: { en: 'Static Cam / Tripod', es: 'Cámara Fija / Trípode' },
      icon: '🎥',
      desc: {
        en: 'Fixed camera covering a specific corner or section. Optimal for full-body pose analysis and split timing. Limited terrain coverage.',
        es: 'Cámara fija en un sector o curva específica. Óptima para análisis de pose de cuerpo completo y tiempos parciales. Cobertura de terreno limitada.',
      },
      outputs: ['POSE EST.', 'SPLIT TIMING'],
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
        en: 'Drone follows kart from above or behind. Detects all karts, segments track with SAM3 text-prompt, measures lateral position and line consistency.',
        es: 'Drone sigue al kart desde arriba o atrás. Detecta todos los karts, segmenta la pista con SAM3, mide posición lateral y consistencia de línea.',
      },
      outputs: ['LAT POS', 'CONSIST.', 'EDGE USE', 'SAM3 overlay'],
      available: true,
      color: '#1fa84a',
    },
    {
      id: 'action_cam',
      label: { en: 'GoPro / Action Cam', es: 'GoPro / Cámara de Acción' },
      icon: '📷',
      desc: {
        en: 'Helmet or kart-mounted first-person camera. Measures gap to kart ahead, detects kerb contact left/right, tracks all visible karts via ByteTrack.',
        es: 'Cámara en primera persona en casco o kart. Mide brecha al kart adelante, detecta contacto con kerb izq/der, trackea karts visibles con ByteTrack.',
      },
      outputs: ['GAP BAR', 'KERB L/R', 'ByteTrack IDs'],
      available: true,
      color: '#22d3ee',
    },
    {
      id: 'overhead_drone',
      label: { en: 'Overhead / Cenital Drone', es: 'Drone Cenital / Overhead' },
      icon: '🛸',
      desc: {
        en: 'Top-down drone view of the full circuit or sector. Full lap trajectory, overtaking patterns, sector comparison between laps.',
        es: 'Vista cenital del circuito completo o sector. Trayectoria de vuelta completa, patrones de adelantamiento, comparación de sectores entre vueltas.',
      },
      outputs: ['FULL LAP', 'OVERTAKE ZONES', 'SECTOR CMP'],
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
    setCustomPrompt('');
    setShowPromptConfig(false);
    setStep('upload');
    setUploadedFile(null);
    setError('');
    setIsRealRun(false);
  }, [sport]);

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
        mode: sport === 'karting' ? kartingMode : undefined,
        prompt: activePrompt || undefined,
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

  const PROC_STEPS = {
    downhill: ['Extracting frames', 'Pose estimation', 'Terrain analysis', 'Line scoring', 'Building artifacts'],
    karting:  ['Extracting frames', 'Track edge detection', 'Apex markers', 'Route segmentation', 'Corner scoring'],
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
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 32px' }}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', letterSpacing: '0.12em', marginBottom: 10 }}>
            {lang === 'es' ? 'ANALIZAR SESIÓN' : 'ANALYZE SESSION'}
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 700, color: '#EDEDE8', margin: 0 }}>
            {lang === 'es' ? `Adaptador: ${tl(sc.label, lang)}` : `Adapter: ${tl(sc.label, lang)}`}
          </h2>
        </div>

        {/* Sport selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {Object.values(SPORTS).map(s => (
            <button key={s.id}
              onClick={() => setState(st => ({ ...st, sport: s.id }))}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${sport === s.id ? s.color + '80' : '#222'}`,
                background: sport === s.id ? s.color + '18' : 'transparent',
                color: sport === s.id ? s.color : '#555',
                fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 500,
                transition: 'all 0.2s',
              }}>
              {tl(s.label, lang)}
              <span style={{ display: 'block', fontFamily: 'Space Mono, monospace', fontSize: 9, marginTop: 2, opacity: 0.6 }}>
                {s.readiness.toUpperCase()}
              </span>
            </button>
          ))}
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
          {STEPS.map((s, i) => {
            const stepIdx = STEPS.findIndex(x => x.id === step);
            const done = i < stepIdx;
            const active = s.id === step;
            return (
              <React.Fragment key={s.id}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: active ? sc.color : done ? sc.color + '40' : '#161616',
                    border: `2px solid ${active ? sc.color : done ? sc.color + '60' : '#222'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Space Mono, monospace', fontSize: 10,
                    color: active ? '#080808' : done ? sc.color : '#555',
                    fontWeight: 700, transition: 'all 0.3s', flexShrink: 0,
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, color: active ? sc.color : '#555', whiteSpace: 'nowrap' }}>
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
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#555', letterSpacing: '0.1em', marginBottom: 10 }}>
                    {lang === 'es' ? 'TIPO DE CÁMARA' : 'CAMERA TYPE'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: modes.length === 2 ? '1fr 1fr' : 'repeat(3,1fr)', gap: 10 }}>
                    {modes.map(m => {
                      const active = cameraMode === m.id;
                      const locked = !m.available;
                      return (
                        <div key={m.id}
                          onClick={() => { if (!locked) setCameraMode(m.id); }}
                          style={{
                            border: `1px solid ${active ? m.color + '80' : locked ? '#1a1a1a' : '#222'}`,
                            borderRadius: 8, padding: '14px 16px',
                            background: active ? m.color + '10' : locked ? '#0c0c0c' : '#111',
                            cursor: locked ? 'default' : 'pointer',
                            transition: 'all 0.2s', position: 'relative', opacity: locked ? 0.55 : 1,
                          }}>
                          {/* Coming soon badge */}
                          {m.comingSoon && (
                            <div style={{
                              position: 'absolute', top: 8, right: 8,
                              fontFamily: 'Space Mono, monospace', fontSize: 7,
                              color: '#555', background: '#161616',
                              border: '1px solid #2a2a2a', borderRadius: 3,
                              padding: '1px 5px', letterSpacing: '0.06em',
                            }}>
                              {lang === 'es' ? 'PRÓXIMO' : 'SOON'}
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: 17 }}>{m.icon}</span>
                            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 600, color: active ? m.color : locked ? '#444' : '#bbb' }}>
                              {tl(m.label, lang)}
                            </span>
                            {active && !locked && (
                              <span style={{
                                marginLeft: 'auto', fontFamily: 'Space Mono, monospace', fontSize: 7,
                                color: m.color, background: m.color + '18', border: `1px solid ${m.color}40`,
                                borderRadius: 3, padding: '1px 6px', letterSpacing: '0.06em',
                              }}>
                                {lang === 'es' ? 'ACTIVO' : 'ACTIVE'}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: '0 0 10px', fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, color: active ? '#aaa' : '#555', lineHeight: 1.5 }}>
                            {tl(m.desc, lang)}
                          </p>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {m.outputs.map(o => (
                              <span key={o} style={{
                                fontFamily: 'Space Mono, monospace', fontSize: 8,
                                color: active ? m.color : '#444',
                                background: active ? m.color + '12' : '#141414',
                                border: `1px solid ${active ? m.color + '30' : '#222'}`,
                                borderRadius: 3, padding: '2px 7px',
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

            {/* ── Segmentation prompt config (collapsible) ── */}
            <div style={{ marginBottom: 20 }}>
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
                  {showPromptConfig ? '▲' : '▼'}
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
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('dc-file-in').click()}
              style={{
                border: `2px dashed ${drag ? sc.color : '#222'}`,
                borderRadius: 12, padding: '56px 32px',
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
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, color: '#EDEDE8', marginBottom: 6 }}>
                {lang === 'es' ? 'Arrastra tu video aquí' : 'Drop session video here'}
              </div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b' }}>
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
                  <span style={{ color: '#ef6444', fontSize: 14 }}>⚠</span>
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
                {sc.capabilities.map(cap => <CapChip key={cap.id} cap={cap} sport={sport} lang={lang} compact />)}
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

const DEMO_SESSIONS = [
  { session_id: 'demo-s001', sport: 'downhill', original_filename: 'la_parva_run3.mp4', avg_balance_score: 78, avg_line_efficiency_score: 82, avg_speed_proxy: 3.4 },
  { session_id: 'karting-demo-luciano', sport: 'karting', original_filename: 'kart_fpv_luciano.mp4',  avg_balance_score: null, avg_line_efficiency_score: null, avg_speed_proxy: null, _kartingDemo: true, _kartingVideo: 'luciano', _kartingMode: 'fpv_follow' },
  { session_id: 'karting-demo-gopro',   sport: 'karting', original_filename: 'gopro_helmet_cam.mp4', avg_balance_score: null, avg_line_efficiency_score: null, avg_speed_proxy: null, _kartingDemo: true, _kartingVideo: 'gopro',   _kartingMode: 'action_cam' },
  { session_id: 'demo-s003', sport: 'downhill', original_filename: 'la_parva_run1.mp4', avg_balance_score: 84, avg_line_efficiency_score: 76, avg_speed_proxy: 3.1 },
  { session_id: 'demo-s004', sport: 'surf',     original_filename: 'punta_lobos.mp4',   avg_balance_score: null, avg_line_efficiency_score: null, avg_speed_proxy: null },
];

// Non-downhill demo sessions always shown as reference (karting demo + surf shell)
const SHELL_DEMOS = DEMO_SESSIONS.filter(s => s.sport !== 'downhill');

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
  if (sess.avg_balance_score != null) scores.push({ k: lang === 'es' ? 'pos' : 'pos', v: Math.round(sess.avg_balance_score) });
  if (sess.avg_line_efficiency_score != null) scores.push({ k: 'line', v: Math.round(sess.avg_line_efficiency_score) });

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
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: sc.color, background: sc.color + '15', border: `1px solid ${sc.color}40`, borderRadius: 3, padding: '3px 8px' }}>DEMO ◆</span>
          ) : scores.length > 0 ? scores.map(s => (
            <div key={s.k} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 17, color: sc.color, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#6b6b6b', textTransform: 'uppercase', marginTop: 2 }}>{s.k}</div>
            </div>
          )) : (
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#3a3a3a', border: '1px solid #222', borderRadius: 3, padding: '3px 8px' }}>SHELL</span>
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
      setSessions(DEMO_SESSIONS);
      return;
    }
    setLoading(true);
    listSessions()
      .then(data => {
        const real = data.length ? data : DEMO_SESSIONS.filter(s => s.sport === 'downhill');
        // Always append karting/surf shell demos as reference entries
        const shellIds = new Set(SHELL_DEMOS.map(s => s.session_id));
        const merged = [...real.filter(s => !shellIds.has(s.session_id)), ...SHELL_DEMOS];
        setSessions(merged);
      })
      .catch(() => setSessions(DEMO_SESSIONS))
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
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: '#555', padding: '40px 0', textAlign: 'center' }}>
              {lang === 'es' ? 'Sin sesiones guardadas.' : 'No saved sessions yet.'}
            </div>
          )}
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
      { label: { en: 'Kart detection (YOLO11)', es: 'Detección de kart (YOLO11)' },          fpv: 2, gopro: 2, overhead: 2, gps: 0 },
      { label: { en: 'Lateral position on track', es: 'Posición lateral en pista' },      fpv: 2, gopro: 1, overhead: 2, gps: 0 },
      { label: { en: 'Track segmentation (SAM3)', es: 'Segmentación de pista (SAM3)' },   fpv: 2, gopro: 2, overhead: 2, gps: 0 },
      { label: { en: 'Multi-kart tracking', es: 'Tracking multi-kart' },                  fpv: 2, gopro: 2, overhead: 2, gps: 0 },
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
      { id: 'drone',    label: { en: 'Follow Drone',        es: 'Drone de Seguimiento' },      tier: 1, recommended: false },
      { id: 'checkpoint',label:{ en: 'Fixed Checkpoint',    es: 'Checkpoint Fijo' },            tier: 1, recommended: false },
      { id: 'imu',      label: { en: 'IMU / GPS',           es: 'IMU / GPS' },                 tier: 2, recommended: false },
    ],
    rows: [
      { label: { en: 'Body pose (MediaPipe)', es: 'Pose corporal (MediaPipe)' },              trail: 2, drone: 1, checkpoint: 1, imu: 0 },
      { label: { en: 'Balance score', es: 'Score de balance' },                               trail: 2, drone: 1, checkpoint: 1, imu: 0 },
      { label: { en: 'Terrain classification', es: 'Clasificación de terreno' },              trail: 2, drone: 2, checkpoint: 0, imu: 0 },
      { label: { en: 'Line efficiency', es: 'Eficiencia de línea' },                          trail: 1, drone: 2, checkpoint: 0, imu: 0 },
      { label: { en: 'Section breakdown', es: 'Desglose por sección' },                       trail: 0, drone: 1, checkpoint: 2, imu: 1 },
      { label: { en: 'Run-over-run comparison', es: 'Comparación entre bajadas' },            trail: 1, drone: 1, checkpoint: 2, imu: 2 },
      { label: { en: 'Speed / G-force', es: 'Velocidad / G' },                               trail: 0, drone: 0, checkpoint: 0, imu: 2 },
      { label: { en: 'AI coaching (VLM)', es: 'Coaching IA (VLM)' },                        trail: 2, drone: 2, checkpoint: 2, imu: 0 },
    ],
    pipelines: {
      trail: [
        { step: 'MediaPipe', color: '#c97a28', desc: { en: '17 pose keypoints / frame', es: '17 puntos de pose / frame' } },
        { step: 'HSV terrain', color: '#eab308', desc: { en: 'Classify rock / root / drop', es: 'Clasifica piedra / raíz / caída' } },
        { step: 'Balance', color: '#c97a28', desc: { en: 'Hip/shoulder alignment score', es: 'Score de alineación cadera/hombros' } },
        { step: 'Line', color: '#c97a28', desc: { en: 'Path efficiency vs terrain', es: 'Eficiencia de trayectoria vs terreno' } },
        { step: 'Groq LLM', color: '#a78bfa', desc: { en: 'metrics-only summary', es: 'resumen solo métricas' } },
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
              fontFamily: 'Space Mono, monospace', fontSize: 9, color: s.color,
              letterSpacing: '0.06em', textAlign: 'center', marginBottom: 5,
            }}>{s.step}</span>
            <span style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, color: '#888',
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
    if (v === 2) return <span style={{ color, fontSize: 14 }}>◆</span>;
    if (v === 1) return <span style={{ color: '#555', fontSize: 14 }} title="partial">◈</span>;
    return <span style={{ color: '#2a2a2a', fontSize: 14 }}>—</span>;
  };

  // Determine column keys from sources
  const colKeys = sources.map(s => s.id);

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Section label */}
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', letterSpacing: '0.12em', marginBottom: 16 }}>
        {lang === 'es' ? 'FUENTE DE VIDEO — QUÉ DESBLOQUEA CADA CÁMARA' : 'VIDEO SOURCE — WHAT EACH CAMERA UNLOCKS'}
      </div>

      {/* Camera matrix table */}
      <div style={{ border: '1px solid #222', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `200px repeat(${sources.length}, 1fr)`,
          background: '#141414', borderBottom: '1px solid #222',
        }}>
          <div style={{ padding: '10px 16px', fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#555' }}>
            {lang === 'es' ? 'ANÁLISIS' : 'ANALYSIS'}
          </div>
          {sources.map(src => (
            <div key={src.id} style={{ padding: '10px 8px', textAlign: 'center' }}>
              <div style={{
                fontFamily: 'Space Mono, monospace', fontSize: 9, color: src.recommended ? col : '#555',
                letterSpacing: '0.07em',
              }}>{tl(src.label, lang)}</div>
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center', gap: 4 }}>
                {src.recommended && (
                  <span style={{
                    fontFamily: 'Space Mono, monospace', fontSize: 7, color: col,
                    background: col + '15', border: `1px solid ${col}30`,
                    borderRadius: 3, padding: '1px 5px', letterSpacing: '0.06em',
                  }}>{lang === 'es' ? 'RECOMENDADO' : 'RECOMMENDED'}</span>
                )}
                <span style={{
                  fontFamily: 'Space Mono, monospace', fontSize: 7, color: '#444',
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
            gridTemplateColumns: `200px repeat(${sources.length}, 1fr)`,
            borderBottom: i < rows.length - 1 ? '1px solid #1a1a1a' : 'none',
            background: i % 2 ? '#0f0f0f' : 'transparent',
            alignItems: 'center',
          }}>
            <div style={{ padding: '10px 16px', fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: '#888' }}>
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
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#333', letterSpacing: '0.08em' }}>
            {lang === 'es' ? 'LEYENDA:' : 'LEGEND:'}
          </span>
          {[
            { sym: '◆', label: { en: 'Full support', es: 'Soporte completo' }, color: col },
            { sym: '◈', label: { en: 'Partial / reduced accuracy', es: 'Parcial / menor precisión' }, color: '#555' },
            { sym: '—', label: { en: 'Not applicable', es: 'No aplica' }, color: '#2a2a2a' },
          ].map((l, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: l.color, fontSize: 13 }}>{l.sym}</span>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, color: '#555' }}>{tl(l.label, lang)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Pipeline flows per available camera */}
      {Object.keys(pipelines).length > 0 && (
        <div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', letterSpacing: '0.12em', marginBottom: 14 }}>
            {lang === 'es' ? 'FLUJO DEL PIPELINE — TIER 0' : 'PIPELINE FLOW — TIER 0'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(pipelines).map(([camId, steps]) => {
              const camSrc = sources.find(s => s.id === camId);
              if (!camSrc) return null;
              return (
                <div key={camId} style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#555', letterSpacing: '0.08em', marginBottom: 12 }}>
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
        { en: 'SAM3 text-prompt segmentation (custom prompt supported)', es: 'Segmentación por text-prompt SAM3 (prompt personalizable)' },
        { en: 'LLM summary · auto (metrics only, no image) + VLM on-demand frame analysis (image + time-window metrics)', es: 'Resumen LLM · automático (solo métricas, sin imagen) + análisis VLM de frame bajo demanda (imagen + métricas de ventana temporal)' },
      ],
      limits: [
        { en: 'No lap timing or corner mapping', es: 'Sin tiempo por vuelta ni mapa de curvas' },
        { en: 'No track-specific model (zero-shot only)', es: 'Sin modelo específico del kartodromo (solo zero-shot)' },
        { en: 'LAT POS loses accuracy on GoPro POV', es: 'LAT POS pierde precisión en vista GoPro' },
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
      input: { en: 'Any video — no labelled data required', es: 'Cualquier video — sin datos etiquetados' },
      tech: ['MediaPipe Pose', 'Terrain classifier (HSV)', 'Groq llama-4-scout'],
      features: [
        { en: 'Body pose: 17 keypoints per frame', es: 'Pose corporal: 17 puntos clave por frame' },
        { en: 'Balance score (hip/shoulder alignment)', es: 'Score de balance (alineación cadera/hombros)' },
        { en: 'Line efficiency (path relative to terrain)', es: 'Eficiencia de línea (trayectoria vs. terreno)' },
        { en: 'Terrain context cues (rock, root, drop)', es: 'Señales de terreno (piedra, raíz, caída)' },
        { en: 'VLM coaching · 1 call per video', es: 'Coaching VLM · 1 llamada por video' },
      ],
      limits: [
        { en: 'No per-section breakdown (whole run only)', es: 'Sin desglose por sección (solo la bajada completa)' },
        { en: 'Terrain classifier is zero-shot, not trained', es: 'Clasificador de terreno zero-shot, no entrenado' },
        { en: 'No speed or G-force data', es: 'Sin datos de velocidad o G' },
      ],
    },
    {
      tier: 1,
      status: 'planned',
      statusLabel: { en: '~3M', es: '~3M' },
      input: { en: '100+ annotated stances + terrain-labelled footage', es: '100+ posturas anotadas + footage con etiquetas de terreno' },
      tech: ['Fine-tuned pose model', 'Terrain segmentation', 'Section detector', 'Groq VLM'],
      features: [
        { en: 'Per-section posture scoring (rock vs. root vs. drop)', es: 'Score de postura por sección (piedra / raíz / caída)' },
        { en: 'Posture trend across the full session', es: 'Tendencia postural en toda la sesión' },
        { en: 'Run-over-run comparison', es: 'Comparación bajada a bajada' },
        { en: 'Terrain-specific guidance per section type', es: 'Guía específica por tipo de terreno' },
      ],
      limits: [
        { en: 'Requires labelled footage from similar trails', es: 'Requiere footage etiquetado de senderos similares' },
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
      borderRadius: 8, overflow: 'hidden',
      background: isLive ? col + '07' : '#0d0d0d',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 18px', background: '#141414', borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: dim ? '#555' : col, letterSpacing: '0.1em', flexShrink: 0 }}>
          TIER {tier.tier}
        </span>
        <span style={{
          fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.07em',
          color: statusColor, border: `1px solid ${statusColor}50`, borderRadius: 3, padding: '2px 9px', flexShrink: 0,
        }}>
          {tl(tier.statusLabel, lang)}
        </span>
        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: dim ? '#999' : '#ccc', flex: 1 }}>
          {tl(tier.input, lang)}
        </span>
      </div>

      {/* Body: 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 0 }}>

        {/* Tech stack */}
        <div style={{ padding: '16px 18px', borderRight: '1px solid #1a1a1a' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: dim ? '#666' : '#777', letterSpacing: '0.09em', marginBottom: 12 }}>
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
                    fontFamily: 'Space Mono, monospace', fontSize: 10,
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
                    <span style={{ fontSize: 9, opacity: 0.45, fontFamily: 'sans-serif' }}>?</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Features */}
        <div style={{ padding: '16px 18px', borderRight: '1px solid #1a1a1a' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: dim ? '#666' : '#777', letterSpacing: '0.09em', marginBottom: 12 }}>
            {lang === 'es' ? (isLive ? 'LO QUE YA HACE' : 'LO QUE HARÁ') : (isLive ? 'WHAT IT DOES' : 'WHAT IT WILL DO')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tier.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: dim ? '#666' : col, fontSize: 10, flexShrink: 0, marginTop: 2 }}>◆</span>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: dim ? '#aaa' : '#EDEDE8', lineHeight: 1.45 }}>
                  {tl(f, lang)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Requirements / Limitations */}
        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: dim ? '#666' : '#777', letterSpacing: '0.09em', marginBottom: 12 }}>
            {isLive
              ? (lang === 'es' ? 'LIMITACIONES ACTUALES' : 'CURRENT LIMITATIONS')
              : (lang === 'es' ? 'PARA LLEGAR A ESTE TIER' : 'REQUIREMENTS TO REACH')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tier.limits.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: isLive ? '#ef6444' : '#eab308', fontSize: 10, flexShrink: 0, marginTop: 2 }}>
                  {isLive ? '!' : '→'}
                </span>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: dim ? '#aaa' : '#bbb', lineHeight: 1.45 }}>
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

export function MethodPage({ state }) {
  const { sport, lang } = state;
  const sc = SPORTS[sport];
  const tiers = SPORT_TIERS[sport] || SPORT_TIERS.downhill;

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

  return (
    <div style={{ padding: '52px 0 0', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 40px' }}>

        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#6b6b6b', letterSpacing: '0.12em', marginBottom: 10 }}>
            {lang === 'es' ? 'ARQUITECTURA' : 'SYSTEM ARCHITECTURE'}
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 30, fontWeight: 700, color: '#EDEDE8', margin: 0 }}>
            {lang === 'es' ? 'Cómo funciona' : 'How it works'}
          </h2>
        </div>

        {/* Tier flows */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: sc.color, letterSpacing: '0.12em', marginBottom: 16 }}>
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
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', letterSpacing: '0.12em', marginBottom: 16 }}>
            {lang === 'es' ? 'MATRIZ DE CAPACIDADES POR DEPORTE' : 'CAPABILITY MATRIX BY SPORT'}
          </div>
          <div style={{ border: '1px solid #222', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '220px repeat(3, 1fr)', background: '#161616', borderBottom: '1px solid #222' }}>
              <div style={{ padding: '10px 16px', fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b' }}>CAPABILITY</div>
              {sportList.map(s => (
                <div key={s.id} style={{ padding: '10px 0', fontFamily: 'Space Mono, monospace', fontSize: 9, color: s.color, textAlign: 'center', letterSpacing: '0.08em' }}>
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
                <div style={{ padding: '11px 16px', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#a1a1a1' }}>
                  {row[lang] || row.en}
                </div>
                {[row.dh, row.kt, row.sf].map((has, j) => {
                  const s = sportList[j];
                  return (
                    <div key={j} style={{ textAlign: 'center', fontSize: 13 }}>
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
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', letterSpacing: '0.1em', marginBottom: 14 }}>
            {lang === 'es' ? 'MODELO DE SESIÓN' : 'SESSION MODEL'}
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, lineHeight: 1.9, color: '#555' }}>
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
