import React, { useState, useEffect, useRef } from 'react';
import { SPORTS, tl, ScoreRing, MiniChart } from './core.jsx';

const KT_COLOR = SPORTS.karting.color;

function CoachingText({ text }) {
  if (!text) return null;
  // Split on bullet lines (starting with * or -)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const bullets = lines.filter(l => l.startsWith('*') || l.startsWith('-'));
  const isBulleted = bullets.length >= 2;

  if (isBulleted) {
    return (
      <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'none' }}>
        {lines.map((line, i) => {
          const clean = line.replace(/^\*+|-+/, '').replace(/\*\*(.*?)\*\*/g, '$1').trim();
          if (!clean) return null;
          const isBullet = line.startsWith('*') || line.startsWith('-');
          return (
            <li key={i} style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 13, color: '#EDEDE8', lineHeight: 1.65,
              marginBottom: 8, paddingLeft: isBullet ? 0 : 8,
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              {isBullet && <span style={{ color: KT_COLOR, flexShrink: 0, marginTop: 2 }}>·</span>}
              {clean}
            </li>
          );
        })}
      </ul>
    );
  }
  // Plain text
  const clean = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^\*+/gm, '').trim();
  return <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#EDEDE8', margin: 0, lineHeight: 1.65 }}>{clean}</p>;
}

const KART_COLORS = [
  '#22d3ee', '#f59e0b', '#a78bfa', '#34d399', '#f87171', '#fb923c',
];

// ── Video player ──────────────────────────────────────────────────────────────

function VideoPanel({ lang, video = 'luciano', mode = 'fpv_follow' }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.play().catch(() => {}); setPlaying(true); }
  }

  function seek(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const v = videoRef.current;
    if (v && v.duration) {
      v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
    }
  }

  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #222', background: '#0d0d0d' }}>
      <div style={{
        padding: '7px 12px', borderBottom: '1px solid #1a1a1a',
        fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: KT_COLOR,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{video === 'gopro' ? 'GoPro Casco' : 'FPV — Luciano'}</span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#3a3a3a' }}>
          {video === 'gopro' ? 'Action cam · SAM2 · ByteTrack' : 'Chase cam · SAM2 · ByteTrack'}
        </span>
      </div>

      <div style={{ position: 'relative', background: '#000', aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          src={`/karting-demo/${video}_annotated.mp4`}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          onTimeUpdate={() => {
            const v = videoRef.current;
            if (v?.duration) setProgress(v.currentTime / v.duration);
          }}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onEnded={() => setPlaying(false)}
          onError={() => setError(true)}
          playsInline
        />
        {error && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', background: '#0d0d0d', gap: 10,
          }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b' }}>VIDEO NOT FOUND</div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#333', textAlign: 'center' }}>
              Run pipeline then re-encode to public/karting-demo/
            </div>
          </div>
        )}
        <button onClick={toggle} style={{
          position: 'absolute', inset: 0, background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {!playing && !error && (
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: KT_COLOR + '20', border: `2px solid ${KT_COLOR}80`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <polygon points="5,2 16,9 5,16" fill={KT_COLOR} />
              </svg>
            </div>
          )}
        </button>
      </div>

      <div style={{ padding: '10px 14px', background: '#0d0d0d' }}>
        <div onClick={seek} style={{
          height: 3, background: '#1a1a1a', borderRadius: 2, cursor: 'pointer', marginBottom: 8,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${progress * 100}%`, background: KT_COLOR, borderRadius: 2,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b' }}>
            {fmt(progress * duration)} / {fmt(duration)}
          </span>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#3a3a3a' }}>
            YOLOv8n + ByteTrack
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Kart card ─────────────────────────────────────────────────────────────────

function KartCard({ kart, lang, expanded, onToggle }) {
  const color = kart.color;
  const overall = Math.round(kart.scores.overall);
  const consistency = Math.round(kart.scores.consistency);
  const edgeUse = Math.round(kart.scores.edge_use);

  return (
    <div style={{
      border: `1px solid ${expanded ? color + '60' : '#222'}`,
      borderRadius: 8, overflow: 'hidden',
      background: expanded ? color + '06' : '#111111',
      transition: 'all 0.25s',
    }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6,
          background: color + '20', border: `1px solid ${color}60`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Space Mono, monospace', fontSize: 10, color, fontWeight: 700, flexShrink: 0,
        }}>#{kart.id}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: '#EDEDE8', marginBottom: 1 }}>
            Kart #{kart.id}
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b' }}>
            {kart.frames_detected} {lang === 'es' ? 'frames detectados' : 'frames detected'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {[
            { v: overall,     k: lang === 'es' ? 'GLOBAL' : 'OVERALL' },
            { v: consistency, k: lang === 'es' ? 'CONSIST.' : 'CONSIST.' },
            { v: edgeUse,     k: lang === 'es' ? 'PISTA' : 'WIDTH USE' },
          ].map(s => (
            <div key={s.k} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 16, color, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#6b6b6b', marginTop: 2 }}>{s.k}</div>
            </div>
          ))}
          <div style={{ color: expanded ? color : '#3a3a3a', fontSize: 12, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'all 0.2s' }}>→</div>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${color}20` }}>
          {/* Score rings */}
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', margin: '16px 0' }}>
            <ScoreRing value={overall}     label={lang === 'es' ? 'GLOBAL'   : 'OVERALL'}   color={color} size={70} />
            <ScoreRing value={consistency} label={lang === 'es' ? 'CONSIST.' : 'CONSIST.'}  color={color} size={70} />
            <ScoreRing value={edgeUse}     label={lang === 'es' ? 'USO PISTA': 'WIDTH USE'} color={color} size={70} />
          </div>

          {/* Lateral position */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', marginBottom: 6 }}>
              {lang === 'es' ? 'POSICIÓN LATERAL MEDIA' : 'MEAN LATERAL POSITION'}
            </div>
            <div style={{ position: 'relative', height: 18, background: '#1a1a1a', borderRadius: 4 }}>
              <div style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                left: `${(kart.lat_mean || 0.5) * 100}%`, marginLeft: -6,
                width: 12, height: 12, borderRadius: '50%', background: color,
                boxShadow: `0 0 8px ${color}`,
              }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#333' }} />
              <span style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#3a3a3a' }}>L</span>
              <span style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#3a3a3a' }}>R</span>
            </div>
          </div>

          {/* VLM coaching */}
          {kart.coaching && (
            <div style={{
              padding: '12px 14px', borderRadius: 6,
              border: `1px solid ${color}30`, background: color + '08', marginBottom: 4,
            }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color, letterSpacing: '0.1em', marginBottom: 10 }}>
                VLM COACH — GROQ / llama-4-scout
              </div>
              <CoachingText text={kart.coaching} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Action cam panel — driver coaching card ───────────────────────────────────

function DriverCoachCard({ coaching, karts_ahead, lang }) {
  const color = KT_COLOR;
  return (
    <div style={{ border: `1px solid ${color}40`, borderRadius: 8, background: color + '06', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color, letterSpacing: '0.1em', marginBottom: 4 }}>
            VLM COACH — GROQ / llama-4-scout
          </div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#EDEDE8' }}>
            {lang === 'es' ? 'Análisis de situación de carrera' : 'Race situation analysis'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 18, color, lineHeight: 1 }}>{karts_ahead}</div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#6b6b6b', marginTop: 2 }}>
            {lang === 'es' ? 'KARTS DETECTADOS' : 'KARTS SPOTTED'}
          </div>
        </div>
      </div>
      <div style={{ padding: '16px' }}>
        {coaching
          ? <CoachingText text={coaching} />
          : <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#3a3a3a', margin: 0 }}>
              {lang === 'es' ? 'Sin datos — corre el pipeline' : 'No data — run the pipeline'}
            </p>
        }
      </div>
      <div style={{ padding: '10px 16px', borderTop: `1px solid #1a1a1a`, display: 'flex', gap: 16 }}>
        {[
          { label: 'KERB L/R', detail: lang === 'es' ? 'detección de ápex' : 'apex detection' },
          { label: 'GAP BAR',  detail: lang === 'es' ? 'proximidad al kart' : 'kart proximity' },
          { label: 'ByteTrack', detail: lang === 'es' ? 'tracking de karts' : 'kart tracking' },
        ].map(t => (
          <div key={t.label}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: color, letterSpacing: '0.06em' }}>{t.label}</div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#3a3a3a' }}>{t.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Feature annotation legend ─────────────────────────────────────────────────

function FeatureAnnotations({ mode, lang }) {
  const isActionCam = mode === 'action_cam';

  const features = isActionCam ? [
    {
      tag: 'GAP BAR',
      color: KT_COLOR,
      tier: 0,
      title: { en: 'Proximity to kart ahead', es: 'Proximidad al kart de adelante' },
      detail: { en: 'Normalized bounding-box area of the closest detected kart — larger fill = physically closer', es: 'Área normalizada del bbox del kart más cercano — barra más llena = físicamente más cerca' },
    },
    {
      tag: 'KERB L / R',
      color: '#22d3ee',
      tier: 0,
      title: { en: 'Apex / kerb contact zone', es: 'Zona de contacto con ápex / kerb' },
      detail: { en: 'HSV red-white edge detection restricted to left/right 10% of frame — fires when the kart passes over kerb lines', es: 'Detección HSV rojo-blanco en el 10% izq/der del frame — activa cuando el kart pasa sobre los kerbs' },
    },
    {
      tag: 'ByteTrack #ID',
      color: '#a78bfa',
      tier: 0,
      title: { en: 'Persistent kart identity', es: 'Identidad persistente de kart' },
      detail: { en: 'YOLO detects bounding boxes each frame — ByteTrack links detections with consistent IDs across time, counting unique karts', es: 'YOLO detecta bboxes por frame — ByteTrack enlaza detecciones con IDs consistentes en el tiempo, contando karts únicos' },
    },
    {
      tag: 'VLM COACH',
      color: '#a78bfa',
      tier: 0,
      title: { en: 'Race situation analysis (1 call/video)', es: 'Análisis de situación de carrera (1 llamada/video)' },
      detail: { en: 'Fires on the frame with the most simultaneously visible karts — Groq llama-4-scout-17b — GoPro helmet-cam specific prompt', es: 'Se ejecuta en el frame con más karts visibles simultáneamente — Groq llama-4-scout-17b — prompt específico para GoPro casco' },
    },
    {
      tag: 'HELMET DET.',
      color: '#f59e0b',
      tier: 1,
      title: { en: 'Helmet-specific detection (Tier 1)', es: 'Detección específica de casco (Tier 1)' },
      detail: { en: 'Fine-tune YOLO on helmet class from this track footage — more precise than kart-body boxes at close range', es: 'Fine-tune de YOLO en clase casco con footage de este kartodromo — más preciso que bboxes de carrocería a corta distancia' },
    },
    {
      tag: 'OVERTAKE OPP.',
      color: '#f59e0b',
      tier: 1,
      title: { en: 'Overtaking opportunity (Tier 1)', es: 'Oportunidad de sobrepaso (Tier 1)' },
      detail: { en: 'Detect karts to left/right vs. center-ahead — flag when side space opens up vs. kart ahead narrows', es: 'Detecta karts a izq/der vs. al centro adelante — señala cuando se abre espacio lateral vs. se estrecha el frente' },
    },
    {
      tag: 'GAP TREND',
      color: '#f59e0b',
      tier: 1,
      title: { en: 'Gap closing / opening rate (Tier 1)', es: 'Velocidad de cierre / apertura de gap (Tier 1)' },
      detail: { en: 'Derivative of GAP BAR value across frames — positive = closing, negative = losing ground', es: 'Derivada del valor del GAP BAR entre frames — positivo = cerrando, negativo = perdiendo terreno' },
    },
  ] : [
    {
      tag: 'LAT POS',
      color: KT_COLOR,
      tier: 0,
      title: { en: 'Lateral track position', es: 'Posición lateral en pista' },
      detail: { en: 'kart_center_x ÷ SAM2-segmented track width — 0 = left edge, 1 = right edge — shown as bar overlay on video', es: 'centro_kart_x ÷ ancho de pista segmentado por SAM2 — 0 = borde izq, 1 = borde der — mostrado como barra overlay en el video' },
    },
    {
      tag: 'CONSIST.',
      color: KT_COLOR,
      tier: 0,
      title: { en: 'Line consistency', es: 'Consistencia de línea' },
      detail: { en: '100 − (σ_lateral × 300) — stability of lateral position across frames. High score = same line every pass through this section', es: '100 − (σ_lateral × 300) — estabilidad de posición lateral entre frames. Score alto = misma línea en cada pasada por esta sección' },
    },
    {
      tag: 'EDGE USE',
      color: KT_COLOR,
      tier: 0,
      title: { en: 'Track width utilization', es: 'Uso del ancho de pista' },
      detail: { en: 'mean(|lat − 0.5| × 2) × 100 — how far from centerline the kart operates. High = uses full track width', es: 'media(|lat − 0.5| × 2) × 100 — qué tan lejos del centro opera el kart. Alto = usa el ancho total de pista' },
    },
    {
      tag: 'SAM2 + HSV',
      color: '#22c55e',
      tier: 0,
      title: { en: 'Track surface mask (green overlay)', es: 'Máscara de superficie de pista (overlay verde)' },
      detail: { en: 'SAM2 Image on frame 0 → samples track HSV percentiles (p5–p95) → calibrated threshold applied to all frames', es: 'SAM2 Image en frame 0 → muestrea percentiles HSV de pista (p5–p95) → umbral calibrado aplicado a todos los frames' },
    },
    {
      tag: 'VLM COACH',
      color: '#a78bfa',
      tier: 0,
      title: { en: 'Track position analysis (1 call/video)', es: 'Análisis de posición en pista (1 llamada/video)' },
      detail: { en: 'Fires on the clearest frame of kart #1 — Groq llama-4-scout-17b — FPV drone-follow specific prompt with green mask + LAT POS bar context', es: 'Se ejecuta en el frame más claro del kart #1 — Groq llama-4-scout-17b — prompt específico para drone FPV con contexto de máscara verde y barra LAT POS' },
    },
    {
      tag: 'CORNER SEG.',
      color: '#f59e0b',
      tier: 1,
      title: { en: 'Corner phase segmentation (Tier 1)', es: 'Segmentación de fases de curva (Tier 1)' },
      detail: { en: 'Split each lap into: straight · brake · turn-in · apex · exit — enables per-section scoring vs. lap average', es: 'Divide cada vuelta en: recta · frenada · giro · ápex · salida — permite score por sección vs. promedio de vuelta' },
    },
  ];

  const tier0 = features.filter(f => f.tier === 0);
  const tier1 = features.filter(f => f.tier === 1);

  function FeatureRow({ f }) {
    return (
      <div style={{
        padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
        borderBottom: '1px solid #1a1a1a',
      }}>
        <span style={{
          fontFamily: 'Space Mono, monospace', fontSize: 8, whiteSpace: 'nowrap',
          color: f.color, background: f.color + '14', border: `1px solid ${f.color}28`,
          borderRadius: 3, padding: '2px 7px', flexShrink: 0, marginTop: 1, letterSpacing: '0.05em',
        }}>{f.tag}</span>
        <div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: '#EDEDE8', marginBottom: 2 }}>
            {tl(f.title, lang)}
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#3a3a3a', lineHeight: 1.55 }}>
            {tl(f.detail, lang)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #222', borderRadius: 8, overflow: 'hidden', background: '#111111' }}>
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid #1a1a1a', background: '#161616',
        fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', letterSpacing: '0.1em',
      }}>
        {lang === 'es' ? 'ANOTACIONES — QUÉ MIDE CADA OVERLAY' : 'ANNOTATIONS — WHAT EACH OVERLAY MEASURES'}
      </div>

      {/* Tier 0 — active */}
      <div style={{ padding: '6px 14px 0', background: KT_COLOR + '06' }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#22c55e', letterSpacing: '0.08em' }}>
          TIER 0 — ACTIVE
        </span>
      </div>
      {tier0.map((f, i) => <FeatureRow key={i} f={f} />)}

      {/* Tier 1 — planned */}
      {tier1.length > 0 && (
        <>
          <div style={{ padding: '8px 14px 0' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#f59e0b', letterSpacing: '0.08em' }}>
              TIER 1 — {lang === 'es' ? 'PLANIFICADO ~2 MESES' : 'PLANNED ~2 MONTHS'}
            </span>
          </div>
          {tier1.map((f, i) => <FeatureRow key={i} f={f} />)}
        </>
      )}
      <div style={{ height: 1 }} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function KartingDemoPage({ state, setState }) {
  const { lang } = state;
  const video = state.kartingVideo || 'luciano';
  const mode  = state.kartingMode  || 'fpv_follow';
  const isActionCam = mode === 'action_cam';

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedKart, setExpandedKart] = useState(null);

  useEffect(() => {
    setLoading(true);
    setSummary(null);
    fetch(`/karting-demo/${video}_summary.json`)
      .then(r => r.json())
      .then(data => {
        setSummary(data);
        const first = data.top_karts?.[0];
        if (first !== undefined) setExpandedKart(first);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [video]);

  // Action cam: single driver card from coaching.driver
  // FPV follow: kart cards from top_karts + driver_scores
  const karts = summary ? (isActionCam
    ? [{ id: 'driver', color: KART_COLORS[0], frames_detected: summary.frames_analyzed,
         scores: { overall: null, consistency: null, edge_use: null },
         lat_mean: null, coaching: summary.coaching?.driver || null }]
    : (summary.top_karts || []).map((id, idx) => {
        const s = summary.driver_scores?.[String(id)] || {};
        return {
          id, color: KART_COLORS[idx % KART_COLORS.length],
          frames_detected: s.frames_detected || 0,
          scores: { overall: s.score||0, consistency: s.consistency||0, edge_use: s.edge_use||0 },
          lat_mean: s.lat_mean,
          coaching: summary.coaching?.driver || summary.coaching?.[String(id)] || null,
        };
      })
  ) : [];

  const modeLabel = isActionCam ? 'Action Cam — Casco' : 'FPV Drone Follow';

  return (
    <div style={{ padding: '52px 0 0', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <button onClick={() => setState(s => ({ ...s, page: 'sessions' }))} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', letterSpacing: '0.08em', padding: 0,
              }}>
                ← {lang === 'es' ? 'SESIONES' : 'SESSIONS'}
              </button>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#3a3a3a' }}>/</span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: KT_COLOR, letterSpacing: '0.08em' }}>
                {lang === 'es' ? 'DEMO KARTING' : 'KARTING DEMO'}
              </span>
            </div>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 24, fontWeight: 700, color: '#EDEDE8', margin: '0 0 4px' }}>
              {isActionCam ? 'Kartodromo — GoPro Casco' : 'Kartodromo — FPV Drone Follow'}
            </h2>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b' }}>
              {summary?.date || '2026-04-28'} · {summary?.frames_analyzed || '—'} frames · {summary?.karts_detected || '—'} karts
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['YOLOv8n', 'ByteTrack', 'SAM2 Video', 'Groq VLM'].map((b, i) => (
              <span key={b} style={{
                fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.06em',
                color: i === 3 ? '#a78bfa' : KT_COLOR,
                background: (i === 3 ? '#a78bfa' : KT_COLOR) + '12',
                border: `1px solid ${(i === 3 ? '#a78bfa' : KT_COLOR)}30`,
                borderRadius: 4, padding: '3px 8px',
              }}>{b}</span>
            ))}
          </div>
        </div>

        {/* Main layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

          {/* Left: video + stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <VideoPanel lang={lang} video={video} mode={mode} />

            {/* Pipeline numbers strip */}
            {summary && (
              <div style={{
                display: 'flex', gap: 0,
                border: '1px solid #222', borderRadius: 8, overflow: 'hidden', background: '#111111',
              }}>
                {[
                  { v: summary.frames_analyzed, k: lang === 'es' ? 'frames' : 'frames' },
                  { v: summary.karts_detected,  k: lang === 'es' ? 'karts det.' : 'karts det.' },
                  { v: 'SAM2+HSV',              k: lang === 'es' ? 'segmentación' : 'segmentation' },
                  { v: 'GROQ',                  k: 'llama-4-scout-17b' },
                ].map((s, i, arr) => (
                  <div key={i} style={{
                    flex: 1, padding: '10px 14px', textAlign: 'center',
                    borderRight: i < arr.length - 1 ? '1px solid #1a1a1a' : 'none',
                  }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: KT_COLOR, lineHeight: 1, marginBottom: 3 }}>{s.v}</div>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#3a3a3a' }}>{s.k}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Feature annotations — mode-specific */}
            <FeatureAnnotations mode={mode} lang={lang} />
          </div>

          {/* Right: kart analysis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', letterSpacing: '0.1em', marginBottom: 4 }}>
              {lang === 'es' ? 'ANÁLISIS POR KART' : 'PER-KART ANALYSIS'}
              {summary && <span style={{ color: '#3a3a3a', marginLeft: 8 }}>— datos reales del pipeline</span>}
            </div>

            {loading && (
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', padding: '20px 0', textAlign: 'center' }}>
                {lang === 'es' ? 'Cargando datos...' : 'Loading data...'}
              </div>
            )}

            {!loading && karts.length === 0 && (
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#3a3a3a', padding: '20px 0', textAlign: 'center' }}>
                {lang === 'es' ? 'Corrá el pipeline para ver análisis real.' : 'Run the pipeline to see real analysis.'}
              </div>
            )}

            {isActionCam ? (
              <DriverCoachCard
                coaching={summary?.coaching?.driver}
                karts_ahead={summary?.karts_detected || 0}
                lang={lang}
              />
            ) : karts.map(kart => (
              <KartCard
                key={kart.id}
                kart={kart}
                lang={lang}
                expanded={expandedKart === kart.id}
                onToggle={() => setExpandedKart(prev => prev === kart.id ? null : kart.id)}
              />
            ))}

          </div>
        </div>
      </div>
    </div>
  );
}
