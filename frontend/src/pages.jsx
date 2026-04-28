import React, { useState, useEffect } from 'react';
import { SPORTS, READINESS, tl, StatusPill, CapChip, ScoreRing, MiniChart } from './core.jsx';
import { analyzeSession, listSessions } from './api.js';

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

export function AnalyzePage({ state, setState }) {
  const { sport, lang, demo, backendOnline } = state;
  const [step, setStep] = useState('upload');
  const [drag, setDrag] = useState(false);
  const [tick, setTick] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState('');
  const sc = SPORTS[sport];

  useEffect(() => { setStep('upload'); setUploadedFile(null); setError(''); }, [sport]);

  useEffect(() => {
    if (step !== 'processing') return;
    const id = setInterval(() => setTick(t => t + 1), 90);
    return () => clearInterval(id);
  }, [step]);

  async function runAnalysis(file) {
    setError('');
    setStep('processing');
    setTick(0);

    if (demo || !backendOnline) {
      // Demo: simulate processing
      setTimeout(() => setStep('done'), 1800);
      return;
    }

    try {
      const result = await analyzeSession(file, sport);
      setState(s => ({ ...s, reviewSessionId: result.session_id }));
      setStep('done');
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

            {(demo || !backendOnline) && (
              <button onClick={() => runAnalysis(null)} style={{
                width: '100%', padding: '11px 0', marginBottom: 20,
                border: '1px solid #eab30845', borderRadius: 8,
                background: '#eab30810', color: '#eab308',
                fontFamily: 'Space Mono, monospace', fontSize: 10, cursor: 'pointer',
                letterSpacing: '0.08em', transition: 'background 0.2s',
              }}>
                ● {lang === 'es' ? 'EJECUTAR EN MODO DEMO' : 'RUN IN DEMO MODE'}
              </button>
            )}

            {!backendOnline && (
              <div style={{ padding: '10px 14px', border: '1px solid #eab30828', borderRadius: 6, background: '#eab30808', marginBottom: 12 }}>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#eab308' }}>
                  {lang === 'es' ? '● MODO DEMO — backend no disponible' : '● DEMO MODE — backend unavailable'}
                </span>
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
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#6b6b6b', marginBottom: 6 }}>
              {lang === 'es' ? 'Ejecutando adaptador de sport...' : 'Running sport adapter...'}
            </div>
            {backendOnline && !demo && (
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

function SessionRow({ sess, lang, onClick }) {
  const sc = SPORTS[sess.sport] || SPORTS.downhill;
  const [hov, setHov] = useState(false);

  const scores = [];
  if (sess.avg_balance_score != null) scores.push({ k: lang === 'es' ? 'pos' : 'pos', v: Math.round(sess.avg_balance_score) });
  if (sess.avg_line_efficiency_score != null) scores.push({ k: 'line', v: Math.round(sess.avg_line_efficiency_score) });

  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px', borderRadius: 8,
        border: `1px solid ${hov ? sc.color + '50' : '#222'}`,
        background: hov ? sc.color + '07' : '#111111',
        cursor: 'pointer', transition: 'all 0.2s',
      }}>
      <div style={{ width: 3, height: 36, borderRadius: 2, background: sc.color, flexShrink: 0, boxShadow: `0 0 8px ${sc.color}50` }} />
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: sc.color, width: 22, flexShrink: 0 }}>
        {sc.abbr}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: '#EDEDE8', marginBottom: 2 }}>
          {sess.original_filename || sess.session_id}
        </div>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b' }}>
          {formatDate(sess.session_id)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18 }}>
        {sess._kartingDemo ? (
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: 9,
            color: sc.color, background: sc.color + '15',
            border: `1px solid ${sc.color}40`, borderRadius: 3, padding: '3px 8px',
          }}>
            DEMO ◆
          </span>
        ) : scores.length > 0 ? scores.map(s => (
          <div key={s.k} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 17, color: sc.color, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#6b6b6b', textTransform: 'uppercase', marginTop: 2 }}>{s.k}</div>
          </div>
        )) : (
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#3a3a3a', border: '1px solid #222', borderRadius: 3, padding: '3px 8px' }}>
            SHELL
          </span>
        )}
      </div>
      <div style={{ color: '#3a3a3a', fontSize: 14, paddingLeft: 4 }}>→</div>
    </div>
  );
}

export function SessionsPage({ state, setState }) {
  const { lang, backendOnline } = state;
  const [filter, setFilter] = useState('all');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

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
  }, [backendOnline]);

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
          <div style={{ display: 'flex', gap: 5 }}>
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
              onClick={() => {
                if (sess._kartingDemo) {
                  setState(s => ({ ...s, sport: 'karting', page: 'karting-demo', kartingVideo: sess._kartingVideo, kartingMode: sess._kartingMode }));
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

const SPORT_TIERS = {
  karting: [
    {
      tier: 0,
      status: 'live',
      statusLabel: { en: 'LIVE NOW', es: 'EN VIVO' },
      requires: { en: 'Any video — no labelled data', es: 'Cualquier video — sin datos etiquetados' },
      pipeline: [
        { en: 'YOLOv8n + ByteTrack', es: 'YOLOv8n + ByteTrack' },
        { en: 'SAM2 Image + HSV', es: 'SAM2 Image + HSV' },
        { en: 'Groq VLM (1 call)', es: 'Groq VLM (1 llamada)' },
      ],
      outputs: [
        { en: 'Annotated video', es: 'Video anotado' },
        { en: 'LAT POS · consistency · edge use', es: 'LAT POS · consistencia · uso de pista' },
        { en: 'GAP BAR · KERB L/R', es: 'GAP BAR · KERB izq/der' },
        { en: 'VLM coaching text', es: 'Texto de coaching VLM' },
      ],
    },
    {
      tier: 1,
      status: 'planned',
      statusLabel: { en: '~2 MONTHS', es: '~2 MESES' },
      requires: { en: '50+ labelled frames from this track + 50 sessions', es: '50+ frames etiquetados de este kartodromo + 50 sesiones' },
      pipeline: [
        { en: 'YOLO fine-tuned on track', es: 'YOLO fine-tuned en pista' },
        { en: 'Lap timing + corner seg.', es: 'Tiempo por vuelta + seg. de curvas' },
        { en: 'Helmet + gap trend', es: 'Casco + tendencia de gap' },
      ],
      outputs: [
        { en: 'Per-lap breakdown', es: 'Desglose por vuelta' },
        { en: 'Brake · turn-in · apex · exit scores', es: 'Scores de freno · giro · ápex · salida' },
        { en: 'Overtaking opportunity flags', es: 'Alertas de oportunidad de sobrepaso' },
        { en: 'Sector-level coaching', es: 'Coaching por sector' },
      ],
    },
    {
      tier: 2,
      status: 'roadmap',
      statusLabel: { en: '6+ MONTHS', es: '6+ MESES' },
      requires: { en: 'Multi-cam rig + GPS/OBD + expert reference runs', es: 'Multi-cam + GPS/OBD + vueltas de referencia de experto' },
      pipeline: [
        { en: 'Multi-modal fusion', es: 'Fusión multimodal' },
        { en: 'Expert ideal-line model', es: 'Modelo de línea ideal experta' },
        { en: 'Real-time edge inference', es: 'Inferencia en tiempo real (edge)' },
      ],
      outputs: [
        { en: 'Live coaching overlay', es: 'Overlay de coaching en vivo' },
        { en: 'Ideal-line delta per corner', es: 'Delta vs. línea ideal por curva' },
        { en: 'Telemetry charts (speed · G · throttle)', es: 'Telemetría (velocidad · G · acelerador)' },
        { en: 'Driver progression score', es: 'Score de progresión del piloto' },
      ],
    },
  ],
  downhill: [
    {
      tier: 0,
      status: 'live',
      statusLabel: { en: 'LIVE NOW', es: 'EN VIVO' },
      requires: { en: 'Any video — no labelled data', es: 'Cualquier video — sin datos etiquetados' },
      pipeline: [
        { en: 'MediaPipe Pose (17 kpts)', es: 'MediaPipe Pose (17 puntos)' },
        { en: 'Terrain classifier', es: 'Clasificador de terreno' },
        { en: 'Groq VLM (1 call)', es: 'Groq VLM (1 llamada)' },
      ],
      outputs: [
        { en: 'Annotated video', es: 'Video anotado' },
        { en: 'Balance score · line efficiency', es: 'Score de balance · eficiencia de línea' },
        { en: 'Terrain context cues', es: 'Señales de contexto de terreno' },
        { en: 'VLM coaching text', es: 'Texto de coaching VLM' },
      ],
    },
    {
      tier: 1,
      status: 'planned',
      statusLabel: { en: '~3 MONTHS', es: '~3 MESES' },
      requires: { en: '100+ annotated stances + terrain labels', es: '100+ posturas anotadas + etiquetas de terreno' },
      pipeline: [
        { en: 'Fine-tuned pose model', es: 'Modelo de pose fine-tuned' },
        { en: 'Terrain segmentation', es: 'Segmentación de terreno' },
        { en: 'Section-aware scoring', es: 'Scoring por tipo de sección' },
      ],
      outputs: [
        { en: 'Per-section posture scores', es: 'Scores de postura por sección' },
        { en: 'Posture trend over session', es: 'Tendencia postural en la sesión' },
        { en: 'Terrain-specific guidance', es: 'Guía específica por terreno' },
        { en: 'Run-over-run comparison', es: 'Comparación bajada a bajada' },
      ],
    },
    {
      tier: 2,
      status: 'roadmap',
      statusLabel: { en: '12+ MONTHS', es: '12+ MESES' },
      requires: { en: 'IMU + GPS + expert reference runs', es: 'IMU + GPS + bajadas de referencia de experto' },
      pipeline: [
        { en: 'Sensor + video fusion', es: 'Fusión sensor + video' },
        { en: 'Expert stance matching', es: 'Matching con postura de experto' },
        { en: 'Real-time edge inference', es: 'Inferencia en tiempo real (edge)' },
      ],
      outputs: [
        { en: 'Real-time posture feedback', es: 'Feedback de postura en tiempo real' },
        { en: 'Force / load analysis', es: 'Análisis de fuerzas / carga' },
        { en: 'Trajectory vs. expert delta', es: 'Trayectoria vs. delta de experto' },
        { en: 'Multi-run progression', es: 'Progresión multi-bajada' },
      ],
    },
  ],
  surf: [
    {
      tier: 0,
      status: 'shell',
      statusLabel: { en: 'COMING', es: 'PRÓXIMO' },
      requires: { en: 'Any video — no labelled data', es: 'Cualquier video — sin datos etiquetados' },
      pipeline: [
        { en: 'YOLOv8 + SAM2', es: 'YOLOv8 + SAM2' },
        { en: 'Pose estimation', es: 'Estimación de pose' },
        { en: 'Wave classifier', es: 'Clasificador de ola' },
      ],
      outputs: [
        { en: 'Annotated video', es: 'Video anotado' },
        { en: 'Wave phase detection', es: 'Detección de fase de ola' },
        { en: 'Balance / posture analysis', es: 'Análisis de balance / postura' },
        { en: 'Maneuver tagging', es: 'Etiquetado de maniobras' },
      ],
    },
    {
      tier: 1,
      status: 'planned',
      statusLabel: { en: '~4 MONTHS', es: '~4 MESES' },
      requires: { en: '200+ labelled wave/maneuver examples', es: '200+ ejemplos etiquetados de ola/maniobra' },
      pipeline: [
        { en: 'Wave segmentation model', es: 'Modelo de segmentación de ola' },
        { en: 'Maneuver classifier', es: 'Clasificador de maniobra' },
        { en: 'Timing analysis', es: 'Análisis de timing' },
      ],
      outputs: [
        { en: 'Maneuver scores', es: 'Scores de maniobra' },
        { en: 'Wave-selection quality', es: 'Calidad de selección de ola' },
        { en: 'Timing feedback', es: 'Feedback de timing' },
        { en: 'Session maneuver log', es: 'Log de maniobras de sesión' },
      ],
    },
    {
      tier: 2,
      status: 'roadmap',
      statusLabel: { en: '12+ MONTHS', es: '12+ MESES' },
      requires: { en: 'Drone + board sensors + GPS + judge reference', es: 'Drone + sensores de tabla + GPS + referencia de juez' },
      pipeline: [
        { en: 'Multi-view fusion', es: 'Fusión multi-vista' },
        { en: 'Wave quality model', es: 'Modelo de calidad de ola' },
        { en: 'Judge-style scoring', es: 'Scoring estilo juez' },
      ],
      outputs: [
        { en: 'Live heat scoring', es: 'Scoring de heat en vivo' },
        { en: 'Wave correlation', es: 'Correlación con ola' },
        { en: 'Judge-style feedback', es: 'Feedback estilo juez' },
        { en: 'Priority / positioning advice', es: 'Consejo de prioridad / posicionamiento' },
      ],
    },
  ],
};

function TierBlock({ tier, sc, lang }) {
  const isLive   = tier.status === 'live';
  const isShell  = tier.status === 'shell';
  const isPlanned = tier.status === 'planned';

  const statusColor = isLive ? '#22c55e' : isShell ? '#555' : '#6b6b6b';
  const borderColor = isLive ? sc.color + '50' : '#222';
  const bg          = isLive ? sc.color + '07' : '#111111';

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 8, overflow: 'hidden', background: bg }}>
      {/* Header */}
      <div style={{
        padding: '9px 16px', background: '#161616', borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: isLive ? sc.color : '#555', letterSpacing: '0.1em' }}>
          TIER {tier.tier}
        </span>
        <span style={{
          fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.08em',
          color: statusColor, background: statusColor + '18',
          border: `1px solid ${statusColor}40`, borderRadius: 3, padding: '2px 8px',
        }}>
          {tl(tier.statusLabel, lang)}
        </span>
      </div>

      {/* Flow row */}
      <div style={{ padding: '14px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Input */}
        <div style={{ background: '#1a1a1a', borderRadius: 6, padding: '9px 13px', minWidth: 130, maxWidth: 200 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#3a3a3a', letterSpacing: '0.08em', marginBottom: 5 }}>INPUT</div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: isLive ? '#EDEDE8' : '#555', lineHeight: 1.4 }}>
            {tl(tier.requires, lang)}
          </div>
        </div>

        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 14, color: '#333', alignSelf: 'center', paddingTop: 4 }}>→</div>

        {/* Pipeline steps */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {tier.pipeline.map((step, i) => (
            <React.Fragment key={i}>
              <div style={{
                border: `1px solid ${isLive ? sc.color + '35' : '#1a1a1a'}`,
                borderRadius: 6, padding: '7px 12px', background: isLive ? sc.color + '09' : '#0d0d0d',
              }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: isLive ? '#EDEDE8' : '#3a3a3a', whiteSpace: 'nowrap' }}>
                  {tl(step, lang)}
                </div>
              </div>
              {i < tier.pipeline.length - 1 && (
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#222' }}>→</div>
              )}
            </React.Fragment>
          ))}
        </div>

        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 14, color: '#333', alignSelf: 'center', paddingTop: 4 }}>→</div>

        {/* Outputs */}
        <div style={{ background: '#1a1a1a', borderRadius: 6, padding: '9px 13px' }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#3a3a3a', letterSpacing: '0.08em', marginBottom: 5 }}>OUTPUTS</div>
          {tier.outputs.map((out, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: i < tier.outputs.length - 1 ? 4 : 0 }}>
              <span style={{ color: isLive ? sc.color : '#222', fontSize: 9, flexShrink: 0 }}>◆</span>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: isLive ? '#EDEDE8' : '#3a3a3a' }}>
                {tl(out, lang)}
              </span>
            </div>
          ))}
        </div>
      </div>
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
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '48px 32px' }}>

        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', letterSpacing: '0.12em', marginBottom: 10 }}>
            {lang === 'es' ? 'ARQUITECTURA' : 'SYSTEM ARCHITECTURE'}
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 700, color: '#EDEDE8', margin: 0 }}>
            {lang === 'es' ? 'Cómo funciona' : 'How it works'}
          </h2>
        </div>

        {/* Tier flows */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: sc.color, letterSpacing: '0.12em', marginBottom: 16 }}>
            {tl(sc.label, lang).toUpperCase()} — {lang === 'es' ? 'PLAN DE CAPACIDADES POR TIER' : 'CAPABILITY ROADMAP BY TIER'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tiers.map(tier => (
              <TierBlock key={tier.tier} tier={tier} sc={sc} lang={lang} />
            ))}
          </div>
        </div>

        {/* Capability matrix */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', letterSpacing: '0.12em', marginBottom: 16 }}>
            {lang === 'es' ? 'MATRIZ DE CAPACIDADES' : 'CAPABILITY MATRIX'}
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
