import React, { useState, useEffect, useRef } from 'react';

// ── Sport Config ──────────────────────────────────────────────────────────────

export const SPORTS = {
  downhill: {
    id: 'downhill',
    label: { en: 'Downhill', es: 'Descenso' },
    tagline: { en: 'Terrain & body analysis', es: 'Análisis de terreno y cuerpo' },
    abbr: 'DH',
    color: 'oklch(68% 0.15 45)',
    colorHex: '#c97a28',
    readiness: 'live',
    capabilities: [
      { id: 'posture', label: { en: 'Posture Analysis', es: 'Análisis Postural' }, live: true },
      { id: 'line', label: { en: 'Line Review', es: 'Revisión de Línea' }, live: true },
      { id: 'playback', label: { en: 'Session Playback', es: 'Reproducción' }, live: true },
      { id: 'terrain', label: { en: 'Terrain Cues', es: 'Señales de Terreno' }, live: true },
    ],
  },
  karting: {
    id: 'karting',
    label: { en: 'Karting', es: 'Karting' },
    tagline: { en: 'Track decision support', es: 'Soporte de decisión en pista' },
    abbr: 'KT',
    color: 'oklch(65% 0.19 145)',
    colorHex: '#1fa84a',
    readiness: 'beta',
    capabilities: [
      { id: 'segment', label: { en: 'Route Segmentation', es: 'Segmentación de Ruta' }, live: false },
      { id: 'brake', label: { en: 'Brake Score', es: 'Puntuación de Freno' }, live: false },
      { id: 'turn', label: { en: 'Turn Score', es: 'Puntuación de Giro' }, live: false },
      { id: 'line_rec', label: { en: 'Line Recommendation', es: 'Recomendación de Línea' }, live: false },
    ],
  },
  surf: {
    id: 'surf',
    label: { en: 'Surf', es: 'Surf' },
    tagline: { en: 'Wave & timing analysis', es: 'Análisis de ola y timing' },
    abbr: 'SF',
    color: 'oklch(68% 0.15 220)',
    colorHex: '#1a90d4',
    readiness: 'shell',
    capabilities: [
      { id: 'wave', label: { en: 'Wave Context', es: 'Contexto de Ola' }, live: false },
      { id: 'timing', label: { en: 'Timing Review', es: 'Revisión de Timing' }, live: false },
      { id: 'balance', label: { en: 'Balance Review', es: 'Revisión de Equilibrio' }, live: false },
      { id: 'maneuver', label: { en: 'Maneuver Tags', es: 'Etiquetas de Maniobra' }, live: false },
    ],
  },
};

export const READINESS = {
  live:  { en: 'Live',   es: 'En vivo',  color: '#22c55e' },
  beta:  { en: 'Beta',   es: 'Beta',     color: '#eab308' },
  shell: { en: 'Coming', es: 'Próximo',  color: '#6b7280' },
};

export function tl(obj, lang) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.en || '';
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

export function StatusPill({ readiness, lang }) {
  const r = READINESS[readiness] || READINESS.shell;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 4,
      border: `1px solid ${r.color}33`,
      background: `${r.color}15`,
      color: r.color,
      fontSize: 10, fontFamily: 'Space Mono, monospace',
      letterSpacing: '0.08em', textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: r.color, flexShrink: 0,
        ...(readiness === 'live' ? { boxShadow: `0 0 6px ${r.color}` } : {}),
      }} />
      {r[lang] || r.en}
    </span>
  );
}

export function CapChip({ cap, sport, lang, compact }) {
  const sc = SPORTS[sport];
  if (!sc) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: compact ? '2px 7px' : '4px 10px',
      borderRadius: 4,
      border: `1px solid ${cap.live ? sc.color + '55' : '#22270'}`,
      background: cap.live ? sc.color + '12' : 'transparent',
      color: cap.live ? sc.color : '#3a5a7a',
      fontSize: compact ? 10 : 11,
      fontFamily: 'Space Mono, monospace',
      whiteSpace: 'nowrap',
    }}>
      {cap.live ? '◆' : '◇'} {tl(cap.label, lang)}
    </span>
  );
}

export function ScoreRing({ value, label, color, size = 80 }) {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value, 100) / 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#222" strokeWidth={size * 0.08} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={size * 0.08}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
        />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
          style={{ fill: '#EDEDE8', fontSize: size * 0.22, fontFamily: 'Space Mono, monospace', fontWeight: 700 }}>
          {value}
        </text>
      </svg>
      <span style={{ fontSize: 10, color: '#6b6b6b', fontFamily: 'Space Mono, monospace', letterSpacing: '0.06em' }}>{label}</span>
    </div>
  );
}

export function MiniChart({ data, color, gradId, height = 52 }) {
  const id = `mg-${gradId || color.replace(/[^a-z0-9]/gi, '')}`;
  const w = 480, h = height;
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });
  const area = [`0,${h}`, ...pts, `${w},${h}`].join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────

export function Nav({ state, setState }) {
  const { sport, page, lang, demo, backendOnline } = state;
  const sc = SPORTS[sport];

  const pages = [
    { id: 'overview', en: 'Overview',  es: 'Vista General' },
    { id: 'analyze',  en: 'Analyze',   es: 'Analizar' },
    { id: 'live',     en: 'Live',      es: 'En Vivo', accent: true },
    { id: 'sessions', en: 'Sessions',  es: 'Sesiones' },
    { id: 'method',   en: 'Method',    es: 'Método' },
  ];

  const navPage = ['overview', 'analyze', 'live', 'sessions', 'method'].includes(page) ? page : null;

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      height: 52,
      background: '#080808ee',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid #1e1e1e',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 20,
    }}>
      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}
        onClick={() => setState(s => ({ ...s, page: 'overview' }))}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: sc.color,
          boxShadow: `0 0 8px ${sc.color}`,
          transition: 'background 0.4s, box-shadow 0.4s',
        }} />
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#EDEDE8', letterSpacing: '0.14em' }}>
          DRCOACH
        </span>
      </div>

      {/* Page tabs */}
      <div style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }}>
        {pages.map(p => (
          <button key={p.id}
            onClick={() => setState(s => ({ ...s, page: p.id }))}
            style={{
              background: p.accent && navPage !== p.id ? '#ef444408'
                        : navPage === p.id ? '#1e1e1e' : 'none',
              border: p.accent && navPage !== p.id ? '1px solid #ef444430' : 'none',
              borderBottom: `2px solid ${navPage === p.id ? sc.color : 'transparent'}`,
              cursor: 'pointer',
              padding: p.accent ? '4px 14px' : '6px 16px',
              borderRadius: navPage === p.id ? '4px 4px 0 0' : '4px',
              fontFamily: 'Space Grotesk, sans-serif', fontSize: 13,
              color: p.accent ? (navPage === p.id ? sc.color : '#ef6444') : navPage === p.id ? '#EDEDE8' : '#555',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
            {p.accent && (
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#ef4444', boxShadow: '0 0 6px #ef4444',
                display: 'inline-block', flexShrink: 0,
              }} />
            )}
            {p[lang] || p.en}
          </button>
        ))}
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Backend status */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontFamily: 'Space Mono, monospace', fontSize: 9,
          color: backendOnline ? '#22c55e' : '#555',
          letterSpacing: '0.08em',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: backendOnline ? '#22c55e' : '#555',
            boxShadow: backendOnline ? '0 0 6px #22c55e' : 'none',
          }} />
          {backendOnline ? 'API' : 'DEMO'}
        </span>

        {/* Sport pills */}
        <div style={{ display: 'flex', gap: 3 }}>
          {Object.values(SPORTS).map(s => (
            <button key={s.id}
              onClick={() => setState(st => ({ ...st, sport: s.id }))}
              title={tl(s.label, lang)}
              style={{
                width: 34, height: 24, borderRadius: 4,
                border: `1px solid ${sport === s.id ? s.color : '#222'}`,
                background: sport === s.id ? s.colorHex + '22' : 'transparent',
                color: sport === s.id ? s.color : '#555',
                fontFamily: 'Space Mono, monospace', fontSize: 9,
                cursor: 'pointer', transition: 'all 0.2s',
                letterSpacing: '0.04em',
              }}>
              {s.abbr}
            </button>
          ))}
        </div>

        {/* Lang */}
        <div style={{ display: 'flex', gap: 2 }}>
          {['ES', 'EN'].map(l => {
            const active = lang === l.toLowerCase();
            return (
              <button key={l}
                onClick={() => setState(s => ({ ...s, lang: l.toLowerCase() }))}
                style={{
                  padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
                  border: `1px solid ${active ? sc.colorHex : '#333'}`,
                  background: 'none',
                  color: active ? sc.colorHex : '#444',
                  fontFamily: 'Space Mono, monospace', fontSize: 10,
                  letterSpacing: '0.08em', transition: 'border-color 0.2s, color 0.2s',
                  appearance: 'none', WebkitAppearance: 'none',
                }}>
                {l}
              </button>
            );
          })}
        </div>

        {/* Demo toggle */}
        <button
          onClick={() => setState(s => ({ ...s, demo: !s.demo }))}
          style={{
            background: demo ? '#eab30812' : 'none',
            border: `1px solid ${demo ? '#eab30860' : '#222'}`,
            borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
            fontFamily: 'Space Mono, monospace', fontSize: 10,
            color: demo ? '#eab308' : '#555',
            letterSpacing: '0.06em', transition: 'all 0.2s',
          }}>
          {demo ? '● DEMO' : '○ DEMO'}
        </button>

        {/* VRL mark */}
        <a href="https://vectorridgelabs.com/en" target="_blank" rel="noopener noreferrer"
          title="Vector Ridge Labs"
          style={{
            fontFamily: 'Space Mono, monospace', fontSize: 8,
            color: '#2e2e2e', letterSpacing: '0.14em', textDecoration: 'none',
            paddingLeft: 6, borderLeft: '1px solid #1a1a1a',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#555'}
          onMouseLeave={e => e.currentTarget.style.color = '#2e2e2e'}>
          VRL
        </a>
      </div>
    </nav>
  );
}

export { useState, useEffect, useRef };
