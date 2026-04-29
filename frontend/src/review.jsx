import React, { useState, useEffect, useRef } from 'react';
import { SPORTS, tl, StatusPill, CapChip, ScoreRing, MiniChart } from './core.jsx';
import { getSession, videoUrl } from './api.js';

// ── DH Telemetry timeline ─────────────────────────────────────────────────────

const POSTURE_COLOR = { attack: '#22d3ee', neutral: '#a3a3a3', defensive: '#f59e0b', unknown: '#333' };
const TERRAIN_COLOR = { flat: '#22c55e', jump: '#f59e0b', bermed: '#818cf8', rock: '#ef4444', unknown: '#333' };

function useCanvasDH(features, renderFn) {
  const ref = useRef(null);
  const draw = () => {
    const canvas = ref.current;
    if (!canvas || !features?.length) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (!w || !h) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    renderFn(ctx, w, h, features);
  };
  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [features]);
  return ref;
}

function DHLineChart({ features, field, color, label, normalize, lang }) {
  const vals = features.map(f => f[field]).filter(v => v != null);
  const vmin = normalize ? 0 : 0;
  const vmax = normalize ? Math.max(...vals, 1) : 100;

  const ref = useCanvasDH(features, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const n = features.length;
    const colW = W / n;

    // Filled area
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '44');
    grad.addColorStop(1, color + '06');
    ctx.beginPath();
    ctx.moveTo(0, H);
    let hasData = false;
    features.forEach((f, i) => {
      const v = f[field];
      if (v == null) return;
      const x = i * colW + colW / 2;
      const y = H - ((v - vmin) / (vmax - vmin)) * H * 0.9 - H * 0.05;
      if (!hasData) { ctx.lineTo(x, y); hasData = true; }
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    hasData = false;
    features.forEach((f, i) => {
      const v = f[field];
      if (v == null) return;
      const x = i * colW + colW / 2;
      const y = H - ((v - vmin) / (vmax - vmin)) * H * 0.9 - H * 0.05;
      if (!hasData) { ctx.moveTo(x, y); hasData = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  const maxV = vals.length ? Math.round(Math.max(...vals)) : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#555', letterSpacing: '0.08em' }}>{label}</span>
        <div style={{ display: 'flex', gap: 12 }}>
          {avg != null && (
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#444' }}>
              avg <span style={{ color }}>{avg}</span>
            </span>
          )}
          {maxV != null && (
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#444' }}>
              max <span style={{ color }}>{maxV}</span>
            </span>
          )}
        </div>
      </div>
      <canvas ref={ref} style={{ width: '100%', height: 36, display: 'block', borderRadius: 3, background: '#0a0a0a' }} />
    </div>
  );
}

function DHPostureTimeline({ features, lang }) {
  const ref = useCanvasDH(features, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const n = features.length;
    const colW = W / n;
    features.forEach((f, i) => {
      const c = POSTURE_COLOR[f.posture_label] || POSTURE_COLOR.unknown;
      ctx.fillStyle = c + (f.posture_label ? 'cc' : '33');
      ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW) + 1, H);
    });
  });

  const counts = {};
  features.forEach(f => { if (f.posture_label) counts[f.posture_label] = (counts[f.posture_label] || 0) + 1; });
  const total = features.length || 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#555', letterSpacing: '0.08em' }}>POSTURA</span>
        <div style={{ display: 'flex', gap: 10 }}>
          {Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([label, cnt]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: 1, background: POSTURE_COLOR[label], display: 'inline-block' }} />
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color: '#555' }}>
                {label} {Math.round(cnt / total * 100)}%
              </span>
            </span>
          ))}
        </div>
      </div>
      <canvas ref={ref} style={{ width: '100%', height: 14, display: 'block', borderRadius: 3 }} />
    </div>
  );
}

function DHTimeline({ features, lang, color }) {
  if (!features?.length) return null;
  const hasBalance  = features.some(f => f.balance_score != null);
  const hasLine     = features.some(f => f.line_efficiency_score != null);
  const hasSpeed    = features.some(f => f.speed_proxy != null);
  const hasPosture  = features.some(f => f.posture_label != null);
  if (!hasBalance && !hasLine && !hasSpeed) return null;

  return (
    <div style={{ border: '1px solid #1e1e1e', borderRadius: 8, background: '#0a0a0a', overflow: 'hidden' }}>
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid #161616',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#444', letterSpacing: '0.1em' }}>
          {lang === 'es' ? 'TELEMETRÍA · TIMELINE' : 'TELEMETRY · TIMELINE'}
        </span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#2a2a2a' }}>
          {features.length} {lang === 'es' ? 'puntos' : 'pts'}
        </span>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {hasBalance && (
          <DHLineChart features={features} field="balance_score" color="#f59e0b"
            label={lang === 'es' ? 'BALANCE / POSTURA (0-100)' : 'BALANCE / POSTURE (0-100)'} lang={lang} />
        )}
        {hasLine && (
          <DHLineChart features={features} field="line_efficiency_score" color={color}
            label={lang === 'es' ? 'EFICIENCIA DE LÍNEA (0-100)' : 'LINE EFFICIENCY (0-100)'} lang={lang} />
        )}
        {hasSpeed && (
          <DHLineChart features={features} field="speed_proxy" color="#22d3ee"
            label={lang === 'es' ? 'VELOCIDAD PROXY' : 'SPEED PROXY'} normalize lang={lang} />
        )}
        {hasPosture && (
          <DHPostureTimeline features={features} lang={lang} />
        )}
      </div>
    </div>
  );
}

// ── Demo data fallback ────────────────────────────────────────────────────────

const DEMO_REVIEW = {
  downhill: {
    session: { label: 'La Parva — Run 3', date: '2026-04-21', duration: '3:42' },
    scores: [
      { key: 'posture', value: 78, label: { en: 'POSTURE', es: 'POSTURA' } },
      { key: 'line',    value: 82, label: { en: 'LINE',    es: 'LÍNEA' } },
      { key: 'terrain', value: 71, label: { en: 'TERRAIN', es: 'TERRENO' } },
    ],
    trend: [62, 65, 70, 68, 74, 78, 76, 80, 78, 82],
    frames: [
      { t: '0:18', note: { en: 'Entry posture good — weight centred', es: 'Postura de entrada buena — peso centrado' }, ok: true },
      { t: '1:04', note: { en: 'CoG too far back — sector 2 start', es: 'CoG muy atrás — inicio sector 2' }, ok: false },
      { t: '1:42', note: { en: 'Line commitment late on corner 4', es: 'Entrada tardía en esquina 4' }, ok: false },
      { t: '2:55', note: { en: 'Recovery clean — strong finish', es: 'Recuperación limpia — buen final' }, ok: true },
    ],
    guidance: [
      { type: 'improve', en: 'Centre of gravity too far back — frames 142–188', es: 'Centro de gravedad muy atrás — fotogramas 142–188' },
      { type: 'improve', en: 'Late commitment to line on corner 4', es: 'Entrada tardía en esquina 4' },
      { type: 'ok',      en: 'Terrain reading through sector 1 is strong', es: 'Lectura de terreno en sector 1 es buena' },
      { type: 'ok',      en: 'Recovery from sector 2 error is clean', es: 'Recuperación del error en sector 2 es limpia' },
    ],
  },
  karting: {
    session: { label: 'Circuito 1 — Q3', date: '2026-04-20', duration: '5:18' },
    scores: [
      { key: 'brake', value: 71, label: { en: 'BRAKE', es: 'FRENO' } },
      { key: 'turn',  value: 65, label: { en: 'TURN',  es: 'GIRO' } },
      { key: 'line',  value: 74, label: { en: 'LINE',  es: 'LÍNEA' } },
    ],
    trend: [55, 58, 60, 58, 64, 62, 68, 71, 70, 74],
    corners: [
      { id: 'C1', phase: 'turn-in', brake: 78, turn: 72, note: { en: 'Good entry, brake timing optimal', es: 'Buena entrada, timing de freno óptimo' } },
      { id: 'C2', phase: 'apex',    brake: 64, turn: 58, note: { en: 'Brake 0.3s earlier, apex missed wide', es: 'Frenar 0.3s antes, apex fallado' } },
      { id: 'C3', phase: 'exit',    brake: 71, turn: 60, note: { en: 'Turn-in 1.2m too late, wide exit', es: 'Giro 1.2m tardío, salida amplia' } },
      { id: 'C4', phase: 'straight',brake: 80, turn: 78, note: { en: 'Optimal. Use as reference lap', es: 'Óptimo. Usar como referencia' } },
      { id: 'C5', phase: 'apex',    brake: 66, turn: 62, note: { en: 'Slight understeer on exit', es: 'Subviraje leve en la salida' } },
    ],
    guidance: [
      { type: 'improve', en: 'Brake 0.3s earlier on corner C2', es: 'Frenar 0.3s antes en esquina C2' },
      { type: 'improve', en: 'Turn-in point on C3 is 1.2m too late', es: 'Punto de giro en C3 es 1.2m muy tarde' },
      { type: 'ok',      en: 'C4 execution is reference quality — replicate', es: 'Ejecución de C4 es referencia — replicar' },
      { type: 'improve', en: 'Reduce understeer on C5 exit', es: 'Reducir subviraje en salida de C5' },
    ],
  },
  surf: { shell: true },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseGuidance(text) {
  if (!text) return [];
  const items = [];
  let mode = 'ok';
  for (const line of text.split('\n')) {
    if (/weakness|weaknes|debilid|recomend|recommendation|improve/i.test(line)) mode = 'improve';
    if (/strength|strengths|fortalez/i.test(line)) mode = 'ok';
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet) {
      items.push({ type: mode, text: bullet[1].replace(/\*\*/g, '') });
    }
  }
  return items.slice(0, 6);
}

function buildReviewFromSession(session) {
  const scores = [];
  if (session.avg_balance_score != null)
    scores.push({ key: 'posture', value: Math.round(session.avg_balance_score), label: { en: 'POSTURE', es: 'POSTURA' } });
  if (session.avg_line_efficiency_score != null)
    scores.push({ key: 'line', value: Math.min(100, Math.round(session.avg_line_efficiency_score)), label: { en: 'LINE', es: 'LÍNEA' } });
  if (session.avg_speed_proxy != null)
    scores.push({ key: 'speed', value: Math.min(99, Math.round(session.avg_speed_proxy * 10)), label: { en: 'SPEED', es: 'VELOC.' } });

  const features = session.features || [];
  const trend = features
    .filter(f => f.balance_score != null)
    .map(f => f.balance_score)
    .filter((_, i) => i % Math.max(1, Math.floor(features.length / 20)) === 0)
    .slice(0, 20);

  const frames = features
    .filter(f => f.posture_label != null)
    .filter((_, i) => i % Math.max(1, Math.floor(features.length / 6)) === 0)
    .slice(0, 4)
    .map(f => {
      const t = f.timestamp_sec != null ? `${Math.floor(f.timestamp_sec / 60)}:${String(Math.floor(f.timestamp_sec % 60)).padStart(2, '0')}` : '—';
      const ok = f.posture_label === 'attack' || (f.balance_score != null && f.balance_score > 70);
      return {
        t,
        note: { en: `${f.posture_label || '—'} · balance ${Math.round(f.balance_score ?? 0)}`, es: `${f.posture_label || '—'} · equilibrio ${Math.round(f.balance_score ?? 0)}` },
        ok,
      };
    });

  const guidance = parseGuidance(session.coaching_summary);

  return { scores, trend, frames, guidance };
}

// ── Sync Video Player ─────────────────────────────────────────────────────────

function SyncVideoPlayer({ sessionId, lang, sportColor }) {
  const v1Ref = useRef(null);
  const v2Ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const inputSrc = videoUrl(sessionId, 'input');
  const annotatedSrc = videoUrl(sessionId, 'annotated');

  function fmt(s) {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  function togglePlay() {
    const v1 = v1Ref.current, v2 = v2Ref.current;
    if (!v1) return;
    if (playing) { v1.pause(); v2?.pause(); setPlaying(false); }
    else { v1.play(); v2?.play(); setPlaying(true); }
  }

  function seekTo(val) {
    const v1 = v1Ref.current, v2 = v2Ref.current;
    if (!v1 || !duration) return;
    const t = (val / 10000) * duration;
    v1.currentTime = t;
    if (v2) v2.currentTime = t;
    setCurrentTime(t);
    setProgress(val);
  }

  function onTimeUpdate() {
    const v1 = v1Ref.current, v2 = v2Ref.current;
    if (!v1 || !duration) return;
    const t = v1.currentTime;
    setCurrentTime(t);
    setProgress((t / duration) * 10000);
    if (v2 && Math.abs(v1.currentTime - v2.currentTime) > 0.15) {
      v2.currentTime = v1.currentTime;
    }
  }

  function onEnded() { setPlaying(false); }

  return (
    <div style={{ border: '1px solid #222', borderRadius: 10, overflow: 'hidden', background: '#08080899' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {[
          { ref: v1Ref, src: inputSrc, label: lang === 'es' ? 'ENTRADA' : 'INPUT', primary: true },
          { ref: v2Ref, src: annotatedSrc, label: lang === 'es' ? 'ANOTADO' : 'ANNOTATED', primary: false },
        ].map(({ ref, src, label, primary }) => (
          <div key={label} style={{ borderRight: primary ? '1px solid #222' : 'none' }}>
            <div style={{ padding: '6px 12px', background: '#161616', borderBottom: '1px solid #222' }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', letterSpacing: '0.1em' }}>{label}</span>
            </div>
            <video
              ref={ref}
              src={src}
              muted
              preload="metadata"
              onTimeUpdate={primary ? onTimeUpdate : undefined}
              onLoadedMetadata={primary ? () => setDuration(ref.current?.duration || 0) : undefined}
              onEnded={primary ? onEnded : undefined}
              onClick={togglePlay}
              style={{ width: '100%', display: 'block', background: '#000', maxHeight: 260, objectFit: 'contain', cursor: 'pointer' }}
            />
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ padding: '10px 14px', background: '#111' }}>
        <div
          style={{ position: 'relative', height: 4, background: '#222', borderRadius: 2, marginBottom: 10, cursor: 'pointer' }}
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); seekTo(Math.round(((e.clientX - r.left) / r.width) * 10000)); }}>
          <div style={{ height: '100%', width: `${(progress / 10000) * 100}%`, background: sportColor, borderRadius: 2, transition: 'width 0.05s linear' }} />
          <div style={{
            position: 'absolute', top: -3, left: `${(progress / 10000) * 100}%`,
            width: 10, height: 10, borderRadius: '50%', background: sportColor,
            transform: 'translateX(-50%)', boxShadow: `0 0 6px ${sportColor}`,
          }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={togglePlay} style={{
            width: 28, height: 28, borderRadius: '50%',
            border: `1px solid ${sportColor}50`, background: sportColor + '20',
            cursor: 'pointer', color: sportColor, fontSize: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {playing ? '⏸' : '▶'}
          </button>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b' }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Circuit Map (karting) ─────────────────────────────────────────────────────

const CIRCUIT_PATH = 'M 55,45 L 280,45 C 345,45 350,75 350,110 C 350,150 310,165 265,165 L 175,165 C 130,165 105,185 95,210 C 85,235 100,260 130,260 L 230,260 C 280,260 305,245 312,215 L 312,285 C 312,315 275,325 240,325 L 75,325 C 25,325 20,295 20,255 L 20,120 C 20,70 40,45 55,45 Z';
const CORNER_POSITIONS = { C1: { cx: 350, cy: 112 }, C2: { cx: 90, cy: 232 }, C3: { cx: 312, cy: 238 }, C4: { cx: 312, cy: 307 }, C5: { cx: 20, cy: 262 } };
const PHASE_COLOR = { straight: '#22c55e', braking: '#ef4444', 'turn-in': '#eab308', apex: '#a78bfa', exit: '#3b82f6' };

function scoreColor(v) {
  if (v >= 75) return '#22c55e';
  if (v >= 63) return '#eab308';
  return '#ef4444';
}

function CircuitMap({ corners, sportColor, lang }) {
  const [selected, setSelected] = useState(null);
  const sel = selected ? corners.find(c => c.id === selected) : null;

  return (
    <div style={{ border: '1px solid #222', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', background: '#161616', borderBottom: '1px solid #222' }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: sportColor, letterSpacing: '0.1em' }}>
          {lang === 'es' ? 'MAPA DE CIRCUITO' : 'CIRCUIT MAP'}
        </span>
      </div>
      <div style={{ padding: '16px', background: '#0a0a0a', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <svg viewBox="0 0 400 370" style={{ width: 220, flexShrink: 0 }}>
          <path d={CIRCUIT_PATH} fill="none" stroke="#222" strokeWidth="20" strokeLinejoin="round" strokeLinecap="round" />
          <path d={CIRCUIT_PATH} fill="none" stroke="#0f0f0f" strokeWidth="15" strokeLinejoin="round" strokeLinecap="round" />
          <path d={CIRCUIT_PATH} fill="none" stroke="#141f30" strokeWidth="13" strokeLinejoin="round" strokeLinecap="round" />
          <path d={CIRCUIT_PATH} fill="none" stroke="#222" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 5" />
          <line x1="55" y1="34" x2="55" y2="56" stroke={sportColor} strokeWidth="2.5" />
          <text x="62" y="42" fontFamily="Space Mono, monospace" fontSize="9" fill={sportColor} opacity="0.9">S/F</text>
          {corners.map(c => {
            const pos = CORNER_POSITIONS[c.id];
            if (!pos) return null;
            const avg = (c.brake + c.turn) / 2;
            const col = scoreColor(avg);
            const isSel = selected === c.id;
            return (
              <g key={c.id} onClick={() => setSelected(isSel ? null : c.id)} style={{ cursor: 'pointer' }}>
                <circle cx={pos.cx} cy={pos.cy} r={isSel ? 16 : 11}
                  fill={col + '20'} stroke={col} strokeWidth={isSel ? 2 : 1.5}
                  style={{ filter: isSel ? `drop-shadow(0 0 7px ${col})` : 'none', transition: 'all 0.2s' }} />
                <text x={pos.cx} y={pos.cy + 4} textAnchor="middle"
                  fontFamily="Space Mono, monospace" fontSize={isSel ? 10 : 8.5}
                  fill={col} fontWeight="700" style={{ pointerEvents: 'none' }}>
                  {c.id}
                </text>
              </g>
            );
          })}
        </svg>
        <div style={{ flex: 1, paddingTop: 2 }}>
          {sel ? (
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: PHASE_COLOR[sel.phase] || '#6b6b6b', marginBottom: 12, letterSpacing: '0.06em' }}>
                {sel.id} / {sel.phase.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
                {[['brake', sel.brake], ['turn', sel.turn]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 22, color: scoreColor(v), fontWeight: 700, lineHeight: 1 }}>{v}</div>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#6b6b6b', marginTop: 3, letterSpacing: '0.08em' }}>{k.toUpperCase()}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: '#888', lineHeight: 1.55 }}>
                {sel.note[lang] || sel.note.en}
              </div>
              <button onClick={() => setSelected(null)} style={{
                marginTop: 12, background: 'none', border: '1px solid #222', borderRadius: 4,
                padding: '4px 10px', cursor: 'pointer', fontFamily: 'Space Mono, monospace',
                fontSize: 9, color: '#555',
              }}>← {lang === 'es' ? 'mapa' : 'map'}</button>
            </div>
          ) : (
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#555', marginBottom: 12, letterSpacing: '0.08em' }}>
                {lang === 'es' ? 'TOCA UNA ESQUINA' : 'TAP A CORNER'}
              </div>
              {[['#22c55e', '≥ 75', lang === 'es' ? 'óptimo' : 'optimal'],
                ['#eab308', '63–74', lang === 'es' ? 'mejorar' : 'improve'],
                ['#ef4444', '< 63', lang === 'es' ? 'crítico' : 'critical']
              ].map(([col, range, lbl]) => (
                <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: col, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: col }}>{range}</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#555' }}>{lbl}</span>
                </div>
              ))}
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #33333340' }}>
                {corners.map(c => {
                  const avg = (c.brake + c.turn) / 2;
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, cursor: 'pointer' }}
                      onClick={() => setSelected(c.id)}>
                      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: scoreColor(avg), width: 20 }}>{c.id}</span>
                      <div style={{ flex: 1, height: 3, background: '#222', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${avg}%`, background: scoreColor(avg), borderRadius: 2 }} />
                      </div>
                      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: scoreColor(avg), width: 24, textAlign: 'right' }}>{Math.round(avg)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Surf Shell ────────────────────────────────────────────────────────────────

function SurfShell({ sc, lang, setState }) {
  return (
    <div style={{ padding: '52px 0 0', minHeight: '100vh' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 32px' }}>
        <button onClick={() => setState(s => ({ ...s, page: 'sessions' }))} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b',
          letterSpacing: '0.08em', padding: 0, marginBottom: 28,
        }}>← {lang === 'es' ? 'SESIONES' : 'SESSIONS'}</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <StatusPill readiness="shell" lang={lang} />
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#555', letterSpacing: '0.08em' }}>
            {lang === 'es' ? 'ANÁLISIS EN DESARROLLO' : 'ANALYTICS IN DEVELOPMENT'}
          </span>
        </div>
        <div style={{
          border: `1px solid ${sc.color}28`, borderRadius: 12,
          background: sc.color + '05', padding: '52px 40px',
          textAlign: 'center', marginBottom: 24,
        }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: sc.color, letterSpacing: '0.14em', marginBottom: 14 }}>
            SURF / WAVE ANALYSIS
          </div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 700, color: '#EDEDE8', marginBottom: 10 }}>
            {lang === 'es' ? 'Módulo en construcción' : 'Module in development'}
          </div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: '#6b6b6b', maxWidth: 380, margin: '0 auto', lineHeight: 1.65 }}>
            {lang === 'es'
              ? 'El adaptador de surf está declarado en el sistema. Las capacidades se activarán progresivamente.'
              : 'The surf adapter is declared in the system. Capabilities will be enabled progressively.'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {sc.capabilities.map(cap => (
            <div key={cap.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', border: '1px solid #222', borderRadius: 6, background: '#111',
            }}>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#555' }}>
                {tl(cap.label, lang)}
              </span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#3a3a3a', border: '1px solid #222', padding: '2px 8px', borderRadius: 3 }}>
                {lang === 'es' ? 'PRÓXIMO' : 'UPCOMING'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SessionReviewPage ─────────────────────────────────────────────────────────

export function SessionReviewPage({ state, setState }) {
  const { sport, lang, reviewSessionId, backendOnline, demo } = state;
  const sc = SPORTS[sport] || SPORTS.downhill;
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(false);

  const isRealSession = reviewSessionId && !reviewSessionId.startsWith('demo');

  useEffect(() => {
    if (!isRealSession || !backendOnline) return;
    setLoading(true);
    getSession(reviewSessionId)
      .then(data => setSessionData(data))
      .catch(() => setSessionData(null))
      .finally(() => setLoading(false));
  }, [reviewSessionId, backendOnline, isRealSession]);

  // Determine sport from loaded data
  const activeSport = sessionData?.sport || sport;
  const asc = SPORTS[activeSport] || sc;

  // Show surf shell for surf sport
  if (activeSport === 'surf' && !sessionData) {
    return <SurfShell sc={asc} lang={lang} setState={setState} />;
  }

  // Build review data
  let reviewData, hasRealData;
  if (sessionData && isRealSession) {
    reviewData = buildReviewFromSession(sessionData);
    hasRealData = true;
  } else {
    reviewData = DEMO_REVIEW[activeSport] || DEMO_REVIEW.downhill;
    hasRealData = false;
    if (reviewData.shell) return <SurfShell sc={asc} lang={lang} setState={setState} />;
  }

  const sessionLabel = sessionData?.original_filename
    || (reviewData.session?.label || reviewSessionId || '—');

  const sessionDate = sessionData
    ? (reviewSessionId && reviewSessionId.length >= 8
        ? `${reviewSessionId.slice(0, 4)}-${reviewSessionId.slice(4, 6)}-${reviewSessionId.slice(6, 8)}`
        : '—')
    : reviewData.session?.date || '—';

  if (loading) {
    return (
      <div style={{ padding: '52px 0 0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: asc.color, letterSpacing: '0.1em', marginBottom: 8 }}>
            {lang === 'es' ? 'CARGANDO SESIÓN...' : 'LOADING SESSION...'}
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: asc.color + '50', animation: `pulse-${i} 1s ${i * 0.3}s infinite alternate` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const scores = reviewData.scores || [];
  const trend = reviewData.trend || [];
  const frames = reviewData.frames || [];
  const guidance = reviewData.guidance || [];
  const corners = reviewData.corners;

  return (
    <div style={{ padding: '52px 0 0', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '32px 28px' }}>

        {/* Back nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => setState(s => ({ ...s, page: 'sessions' }))} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b',
            letterSpacing: '0.08em', padding: 0,
          }}>← {lang === 'es' ? 'SESIONES' : 'SESSIONS'}</button>
          <span style={{ color: '#222' }}>·</span>
          <StatusPill readiness={asc.readiness} lang={lang} />
          {!hasRealData && (
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#eab308', border: '1px solid #eab30840', padding: '2px 8px', borderRadius: 3 }}>
              DEMO
            </span>
          )}
        </div>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 700, color: '#EDEDE8', margin: '0 0 4px' }}>
            {sessionLabel}
          </h2>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b' }}>
            {sessionDate}
            {sessionData?.coaching_summary && (
              <span style={{ marginLeft: 12, color: '#22c55e60' }}>✓ {lang === 'es' ? 'análisis LLM' : 'LLM analysis'}</span>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>

          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Video — real or placeholder */}
            {hasRealData && isRealSession ? (
              <SyncVideoPlayer sessionId={reviewSessionId} lang={lang} sportColor={asc.color} />
            ) : (
              <VideoPlaceholder sc={asc} lang={lang} />
            )}

            {/* Trend */}
            {trend.length >= 2 && (
              <div style={{ border: '1px solid #222', borderRadius: 8, padding: '16px 18px', background: '#111' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', letterSpacing: '0.1em', marginBottom: 12 }}>
                  {lang === 'es' ? 'TENDENCIA DE PUNTUACIÓN' : 'SCORE TREND'}
                </div>
                <MiniChart data={trend} color={asc.color} gradId={activeSport} height={54} />
              </div>
            )}

            {/* DH Telemetry timeline charts */}
            {activeSport === 'downhill' && hasRealData && sessionData?.features?.length > 0 && (
              <DHTimeline features={sessionData.features} lang={lang} color={asc.color} />
            )}

            {/* Frame events (downhill) */}
            {activeSport === 'downhill' && frames.length > 0 && (
              <div style={{ border: '1px solid #222', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: '#161616', borderBottom: '1px solid #222' }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: asc.color, letterSpacing: '0.1em' }}>
                    {lang === 'es' ? 'EVENTOS DE SESIÓN' : 'SESSION EVENTS'}
                  </span>
                </div>
                {frames.map((fr, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px',
                    borderBottom: i < frames.length - 1 ? '1px solid #22222222' : 'none',
                    background: i % 2 ? '#0d142118' : 'transparent',
                  }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: asc.color, flexShrink: 0, width: 36 }}>{fr.t}</div>
                    <div style={{ color: fr.ok ? '#22c55e' : '#ef4444', flexShrink: 0, marginTop: 1 }}>{fr.ok ? '✓' : '↑'}</div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#a1a1a1', lineHeight: 1.4 }}>
                      {fr.note[lang] || fr.note.en}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Circuit map (karting) */}
            {activeSport === 'karting' && corners && (
              <CircuitMap corners={corners} sportColor={asc.color} lang={lang} />
            )}

            {/* Coaching summary block */}
            {hasRealData && sessionData?.coaching_summary && (
              <div style={{ border: '1px solid #222', borderRadius: 8, padding: '16px 18px', background: '#111' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', letterSpacing: '0.1em', marginBottom: 12 }}>
                  {lang === 'es' ? 'ANÁLISIS COMPLETO' : 'FULL ANALYSIS'}
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: '#a1a1a1', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {sessionData.coaching_summary.replace(/\*\*/g, '').replace(/\*/g, '')}
                </div>
              </div>
            )}
          </div>

          {/* Right */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Score rings */}
            {scores.length > 0 && (
              <div style={{ border: '1px solid #222', borderRadius: 8, padding: '18px 14px', background: '#111' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', letterSpacing: '0.1em', marginBottom: 16 }}>
                  {lang === 'es' ? 'PUNTUACIONES' : 'SCORES'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  {scores.map(s => (
                    <ScoreRing key={s.key} value={s.value} label={tl(s.label, lang)} color={asc.color} size={76} />
                  ))}
                </div>
              </div>
            )}

            {/* Guidance */}
            {guidance.length > 0 && (
              <div style={{ border: '1px solid #222', borderRadius: 8, padding: '16px 16px', background: '#111' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', letterSpacing: '0.1em', marginBottom: 14 }}>
                  {lang === 'es' ? 'PRÓXIMOS PASOS' : 'NEXT STEPS'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {guidance.map((g, i) => (
                    <div key={i} style={{
                      padding: '10px 12px', borderRadius: 6,
                      border: `1px solid ${g.type === 'improve' ? '#ef444428' : '#22c55e28'}`,
                      background: g.type === 'improve' ? '#ef444406' : '#22c55e06',
                    }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: g.type === 'improve' ? '#ef4444' : '#22c55e', flexShrink: 0, fontSize: 12 }}>
                          {g.type === 'improve' ? '↑' : '✓'}
                        </span>
                        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: '#EDEDE8', lineHeight: 1.45 }}>
                          {g.text || g[lang] || g.en}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Capabilities */}
            <div style={{ border: '1px solid #222', borderRadius: 8, padding: '16px 16px', background: '#111' }}>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', letterSpacing: '0.1em', marginBottom: 12 }}>
                {lang === 'es' ? 'CAPACIDADES USADAS' : 'CAPABILITIES USED'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {asc.capabilities.filter(c => c.live).map(cap => (
                  <CapChip key={cap.id} cap={cap} sport={activeSport} lang={lang} compact />
                ))}
              </div>
            </div>

            {/* Posture / terrain distributions (real data) */}
            {hasRealData && sessionData?.posture_distribution && Object.keys(sessionData.posture_distribution).length > 0 && (
              <div style={{ border: '1px solid #222', borderRadius: 8, padding: '16px 16px', background: '#111' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', letterSpacing: '0.1em', marginBottom: 12 }}>
                  {lang === 'es' ? 'DISTRIBUCIÓN POSTURAL' : 'POSTURE DISTRIBUTION'}
                </div>
                {Object.entries(sessionData.posture_distribution).map(([label, count]) => {
                  const total = Object.values(sessionData.posture_distribution).reduce((a, b) => a + b, 0);
                  const pct = total ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={label} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#a1a1a1' }}>{label}</span>
                        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: asc.color }}>{pct}%</span>
                      </div>
                      <div style={{ height: 3, background: '#222', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: asc.color, borderRadius: 2, opacity: 0.7 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function VideoPlaceholder({ sc, lang }) {
  const [progress, setProgress] = useState(0.28);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setProgress(p => {
      if (p >= 1) { setPlaying(false); return 0; }
      return p + 0.0015;
    }), 50);
    return () => clearInterval(id);
  }, [playing]);

  const totalSecs = 222;
  const curSec = Math.floor(progress * totalSecs);
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', background: '#080808', border: '1px solid #222', aspectRatio: '16/9', position: 'relative' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }}>
        <defs>
          <pattern id="vgrid2" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#EDEDE8" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#vgrid2)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#222', letterSpacing: '0.1em' }}>
          {lang === 'es' ? 'DEMO · PROCESA UN VIDEO REAL' : 'DEMO · PROCESS A REAL VIDEO'}
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 50%, ${sc.color}0a, transparent 65%)` }} />
      <div style={{ position: 'absolute', top: 12, left: 14, fontFamily: 'Space Mono, monospace', fontSize: 11, color: sc.color, background: '#080808cc', padding: '3px 8px', borderRadius: 4 }}>
        {fmt(curSec)}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: 'linear-gradient(transparent, #08080899)' }}>
        <div style={{ position: 'relative', height: 3, background: '#222', borderRadius: 2, marginBottom: 10, cursor: 'pointer' }}
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setProgress((e.clientX - r.left) / r.width); }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: sc.color, borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setPlaying(!playing)} style={{
            width: 30, height: 30, borderRadius: '50%',
            border: `1px solid ${sc.color}50`, background: sc.color + '20',
            cursor: 'pointer', color: sc.color, fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{playing ? '⏸' : '▶'}</button>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b' }}>
            {fmt(curSec)} / 3:42
          </span>
        </div>
      </div>
    </div>
  );
}
