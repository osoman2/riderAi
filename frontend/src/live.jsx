import React, { useState, useEffect } from 'react';
import { SPORTS, tl, StatusPill } from './core.jsx';

const DEVICES = [
  {
    id: 'gopro',
    name: 'GoPro Hero',
    sub: { en: 'WiFi · USB-C', es: 'WiFi · USB-C' },
    method: { en: 'WiFi Auto-Discovery', es: 'Descubrimiento WiFi' },
    steps: { en: ['Scanning WiFi…', 'Found GoPro-XXXX', 'Handshaking…', 'Connected'], es: ['Escaneando WiFi…', 'GoPro-XXXX encontrado', 'Conectando…', 'Conectado'] },
    icon: function Icon({ col }) {
      return (
        <svg viewBox="0 0 48 48" width="36" height="36">
          <rect x="4" y="12" width="40" height="26" rx="5" fill="none" stroke={col} strokeWidth="2" />
          <rect x="16" y="7" width="16" height="7" rx="2" fill="none" stroke={col} strokeWidth="1.5" />
          <circle cx="24" cy="26" r="7" fill="none" stroke={col} strokeWidth="2" />
          <circle cx="24" cy="26" r="3.5" fill={col} opacity="0.5" />
          <rect x="8" y="22" width="4" height="3" rx="1" fill={col} opacity="0.6" />
        </svg>
      );
    },
  },
  {
    id: 'insta360',
    name: 'Insta360',
    sub: { en: 'USB-C · WiFi', es: 'USB-C · WiFi' },
    method: { en: 'USB-C Direct', es: 'USB-C Directo' },
    steps: { en: ['Detecting USB…', 'Insta360 X4 found', 'Mounting device…', 'Connected'], es: ['Detectando USB…', 'Insta360 X4 encontrado', 'Montando…', 'Conectado'] },
    icon: function Icon({ col }) {
      return (
        <svg viewBox="0 0 48 48" width="36" height="36">
          <circle cx="24" cy="26" r="16" fill="none" stroke={col} strokeWidth="2" />
          <circle cx="24" cy="26" r="9" fill="none" stroke={col} strokeWidth="1.5" />
          <circle cx="24" cy="26" r="3" fill={col} opacity="0.6" />
          <rect x="20" y="6" width="8" height="5" rx="2" fill="none" stroke={col} strokeWidth="1.5" />
          <line x1="24" y1="11" x2="24" y2="17" stroke={col} strokeWidth="1.5" />
        </svg>
      );
    },
  },
  {
    id: 'phone',
    name: { en: 'Smartphone', es: 'Teléfono' },
    sub: { en: 'Browser cam · WebRTC', es: 'Cámara web · WebRTC' },
    method: { en: 'In-browser camera', es: 'Cámara en navegador' },
    steps: { en: ['Requesting permission…', 'Camera access granted', 'Starting stream…', 'Connected'], es: ['Solicitando permiso…', 'Acceso concedido', 'Iniciando stream…', 'Conectado'] },
    icon: function Icon({ col }) {
      return (
        <svg viewBox="0 0 48 48" width="36" height="36">
          <rect x="13" y="4" width="22" height="40" rx="4" fill="none" stroke={col} strokeWidth="2" />
          <circle cx="24" cy="38" r="2" fill={col} opacity="0.5" />
          <rect x="18" y="8" width="12" height="8" rx="2" fill="none" stroke={col} strokeWidth="1.5" />
          <circle cx="24" cy="12" r="2" fill={col} opacity="0.6" />
          <line x1="17" y1="22" x2="31" y2="22" stroke={col} strokeWidth="1" opacity="0.3" />
          <line x1="17" y1="26" x2="28" y2="26" stroke={col} strokeWidth="1" opacity="0.3" />
        </svg>
      );
    },
  },
];

const EDGE_PIPELINE = {
  downhill: { en: ['Frame extraction', 'Pose estimation', 'Terrain cues', 'Line scoring', 'Packaging artifacts'], es: ['Extracción de frames', 'Estimación de pose', 'Señales de terreno', 'Puntuación de línea', 'Empaquetando artefactos'] },
  karting:  { en: ['Frame extraction', 'Track edge detection', 'Route segmentation', 'Corner scoring', 'Packaging artifacts'], es: ['Extracción de frames', 'Detección de bordes', 'Segmentación de ruta', 'Puntuación de esquinas', 'Empaquetando artefactos'] },
  surf:     { en: ['Frame extraction', 'Wave detection', 'Pose estimation', 'Maneuver tagging', 'Packaging artifacts'], es: ['Extracción de frames', 'Detección de ola', 'Estimación de pose', 'Etiquetado de maniobras', 'Empaquetando artefactos'] },
};

const STEPS_UI = [
  { id: 'select',     en: 'Device',   es: 'Dispositivo' },
  { id: 'pairing',    en: 'Pair',     es: 'Emparejar' },
  { id: 'armed',      en: 'Record',   es: 'Grabar' },
  { id: 'processing', en: 'Edge',     es: 'Edge' },
  { id: 'done',       en: 'Review',   es: 'Revisión' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export function LivePage({ state, setState }) {
  const { sport, lang } = state;
  const sc = SPORTS[sport];

  const [step, setStep] = useState('select');
  const [device, setDevice] = useState(null);
  const [pairTick, setPairTick] = useState(0);
  const [recSecs, setRecSecs] = useState(0);
  const [procTick, setProcTick] = useState(0);
  const [recRunning, setRecRunning] = useState(false);

  useEffect(() => {
    if (step !== 'pairing') return;
    const id = setInterval(() => setPairTick(t => t + 1), 420);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (step !== 'pairing') return;
    const dev = DEVICES.find(d => d.id === device);
    const dur = dev ? dev.steps.en.length * 900 : 3200;
    const t = setTimeout(() => setStep('armed'), dur);
    return () => clearTimeout(t);
  }, [step, device]);

  useEffect(() => {
    if (!recRunning) return;
    const id = setInterval(() => setRecSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [recRunning]);

  useEffect(() => {
    if (step !== 'processing') return;
    const id = setInterval(() => setProcTick(t => t + 1), 140);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (step !== 'processing') return;
    const t = setTimeout(() => setStep('done'), state.demo ? 1200 : 5200);
    return () => clearTimeout(t);
  }, [step]);

  function reset() {
    setStep('select'); setDevice(null); setPairTick(0);
    setRecSecs(0); setProcTick(0); setRecRunning(false);
  }

  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const dev = DEVICES.find(d => d.id === device);
  const stepIdx = STEPS_UI.findIndex(s => s.id === step);

  return (
    <div style={{ padding: '52px 0 0', minHeight: '100vh' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 28px' }}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 12px #ef4444' }} />
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#ef6444', letterSpacing: '0.14em' }}>
              {lang === 'es' ? 'CAPTURA EN VIVO / EDGE' : 'LIVE / EDGE CAPTURE'}
            </span>
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 24, fontWeight: 700, color: '#dce8f5', margin: '0 0 6px' }}>
            {lang === 'es' ? 'Cámara deportiva + dispositivo edge' : 'Sports cam + edge device'}
          </h2>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: '#4a6a8a', margin: 0, lineHeight: 1.6 }}>
            {lang === 'es'
              ? 'Graba con tu cámara, procesa en el dispositivo. Resultados listos en ~30 segundos.'
              : 'Record with your camera, process on-device. Results ready in ~30 seconds.'}
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
          {STEPS_UI.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            const col = active ? '#ef6444' : done ? sc.color : '#1c2d42';
            return (
              <React.Fragment key={s.id}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: active ? '#ef444420' : done ? sc.color + '30' : '#111c2e',
                    border: `2px solid ${col}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Space Mono, monospace', fontSize: 9,
                    color: active ? '#ef6444' : done ? sc.color : '#2a4a6a',
                    fontWeight: 700, transition: 'all 0.3s', flexShrink: 0,
                  }}>{done ? '✓' : i + 1}</div>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 10, color: active ? '#ef6444' : done ? sc.color : '#2a4a6a', whiteSpace: 'nowrap' }}>
                    {s[lang] || s.en}
                  </span>
                </div>
                {i < STEPS_UI.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: done ? sc.color + '50' : '#1c2d42', margin: '0 6px', marginTop: -14, transition: 'background 0.4s' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {step === 'select' && (
          <DeviceSelect lang={lang} sc={sc} onSelect={id => { setDevice(id); setStep('pairing'); }} />
        )}
        {step === 'pairing' && dev && (
          <PairingView dev={dev} tick={pairTick} lang={lang} sc={sc} />
        )}
        {step === 'armed' && dev && (
          <ArmedView
            dev={dev} lang={lang} sc={sc} sport={sport}
            recRunning={recRunning} recSecs={recSecs} fmtTime={fmtTime}
            onStart={() => setRecRunning(true)}
            onStop={() => { setRecRunning(false); setStep('processing'); }}
            onReset={reset}
          />
        )}
        {step === 'processing' && (
          <EdgeProcessing lang={lang} sc={sc} sport={sport} tick={procTick} demo={state.demo} />
        )}
        {step === 'done' && (
          <EdgeDone lang={lang} sc={sc} recSecs={recSecs} fmtTime={fmtTime} setState={setState} onReset={reset} sport={sport} />
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeviceSelect({ lang, sc, onSelect }) {
  const [hov, setHov] = useState(null);
  return (
    <div>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#4a6a8a', letterSpacing: '0.1em', marginBottom: 14 }}>
        {lang === 'es' ? 'ELIGE TU DISPOSITIVO' : 'CHOOSE YOUR DEVICE'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {DEVICES.map(d => {
          const name = typeof d.name === 'object' ? (d.name[lang] || d.name.en) : d.name;
          const sub = d.sub[lang] || d.sub.en;
          const meth = d.method[lang] || d.method.en;
          const isHov = hov === d.id;
          const IconComp = d.icon;
          return (
            <div key={d.id}
              onClick={() => onSelect(d.id)}
              onMouseEnter={() => setHov(d.id)}
              onMouseLeave={() => setHov(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 18,
                padding: '18px 20px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${isHov ? '#ef444450' : '#1c2d42'}`,
                background: isHov ? '#ef44440a' : '#0d142155',
                transition: 'all 0.2s',
              }}>
              <div style={{ flexShrink: 0 }}><IconComp col={isHov ? '#ef6444' : '#3a5a7a'} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, fontWeight: 600, color: '#dce8f5', marginBottom: 3 }}>{name}</div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#4a6a8a', marginBottom: 5 }}>{sub}</div>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#ef6444', background: '#ef444412', border: '1px solid #ef444428', borderRadius: 3, padding: '2px 7px' }}>
                  {meth}
                </span>
              </div>
              <div style={{ color: isHov ? '#ef6444' : '#1c2d42', fontSize: 18, transition: 'color 0.2s' }}>→</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 20, padding: '12px 16px', border: '1px solid #1c2d42', borderRadius: 8, background: '#0d142155', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#4a6a8a', letterSpacing: '0.08em' }}>
          {lang === 'es' ? 'ADAPTADOR:' : 'ADAPTER:'}
        </span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: sc.color }}>
          {sc.abbr} — {tl(sc.label, lang)}
        </span>
        <StatusPill readiness={sc.readiness} lang={lang} />
      </div>
    </div>
  );
}

function PairingView({ dev, tick, lang, sc }) {
  const steps = dev.steps[lang] || dev.steps.en;
  const cur = Math.min(Math.floor(tick), steps.length - 1);
  const IconComp = dev.icon;
  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <IconComp col="#ef6444" />
      </div>
      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 28px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute', inset: i * 10,
            borderRadius: '50%',
            border: `1.5px solid #ef444430`,
            borderTopColor: cur >= i ? '#ef6444' : '#ef444420',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 280, margin: '0 auto', textAlign: 'left' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              border: `1.5px solid ${i < cur ? '#22c55e' : i === cur ? '#ef6444' : '#1c2d42'}`,
              background: i < cur ? '#22c55e20' : i === cur ? '#ef444415' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: i < cur ? '#22c55e' : i === cur ? '#ef6444' : '#2a4a6a',
              transition: 'all 0.4s',
            }}>
              {i < cur ? '✓' : ''}
            </div>
            <span style={{
              fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.04em',
              color: i < cur ? '#22c55e' : i === cur ? '#dce8f5' : '#2a4a6a',
              transition: 'color 0.4s',
            }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArmedView({ dev, lang, sc, recRunning, recSecs, fmtTime, onStart, onStop, onReset }) {
  const name = typeof dev.name === 'object' ? (dev.name[lang] || dev.name.en) : dev.name;
  const [flash, setFlash] = useState(false);
  const IconComp = dev.icon;

  useEffect(() => {
    if (!recRunning) return;
    const id = setInterval(() => setFlash(f => !f), 800);
    return () => clearInterval(id);
  }, [recRunning]);

  return (
    <div>
      <div style={{ padding: '16px 20px', borderRadius: 10, marginBottom: 24, border: '1px solid #22c55e40', background: '#22c55e08', display: 'flex', alignItems: 'center', gap: 14 }}>
        <IconComp col="#22c55e" />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 600, color: '#dce8f5' }}>{name}</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#22c55e', border: '1px solid #22c55e40', padding: '2px 7px', borderRadius: 3 }}>
              {lang === 'es' ? 'CONECTADO' : 'CONNECTED'}
            </span>
          </div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#4a6a8a' }}>
            {dev.method[lang] || dev.method.en} · {tl(sc.label, lang)}
          </div>
        </div>
        <button onClick={onReset} style={{ background: 'none', border: '1px solid #1c2d42', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#3a5a7a' }}>
          {lang === 'es' ? 'cambiar' : 'change'}
        </button>
      </div>

      {/* Camera preview */}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #1c2d42', background: '#04071099', aspectRatio: '16/9', position: 'relative', marginBottom: 20 }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }}>
          <defs><pattern id="lgrid2" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="#dce8f5" strokeWidth="0.5" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#lgrid2)" />
        </svg>
        {recRunning && (
          <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', alignItems: 'center', gap: 6, background: '#07090fcc', padding: '4px 10px', borderRadius: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: flash ? '#ef4444' : '#ef444440', transition: 'background 0.3s', boxShadow: flash ? '0 0 8px #ef4444' : 'none' }} />
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#ef6444', letterSpacing: '0.08em' }}>REC {fmtTime(recSecs)}</span>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
          <div style={{ opacity: 0.2 }}><IconComp col="#dce8f5" /></div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#2a4a6a', letterSpacing: '0.1em' }}>
            {lang === 'es' ? 'VISTA EN VIVO' : 'LIVE VIEW'}
          </div>
        </div>
        {['tl', 'tr', 'bl', 'br'].map(pos => (
          <div key={pos} style={{
            position: 'absolute',
            top:    pos.startsWith('t') ? 10 : undefined,
            bottom: pos.startsWith('b') ? 10 : undefined,
            left:   pos.endsWith('l')   ? 10 : undefined,
            right:  pos.endsWith('r')   ? 10 : undefined,
            width: 16, height: 16,
            borderTop:    pos.startsWith('t') ? `2px solid ${sc.color}60` : 'none',
            borderBottom: pos.startsWith('b') ? `2px solid ${sc.color}60` : 'none',
            borderLeft:   pos.endsWith('l')   ? `2px solid ${sc.color}60` : 'none',
            borderRight:  pos.endsWith('r')   ? `2px solid ${sc.color}60` : 'none',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {!recRunning ? (
          <button onClick={onStart} style={{
            flex: 1, padding: '14px 0', background: '#ef444418', border: '1px solid #ef444450',
            borderRadius: 8, cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 600,
            color: '#ef6444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
            {lang === 'es' ? 'Iniciar grabación' : 'Start recording'}
          </button>
        ) : (
          <button onClick={onStop} style={{
            flex: 1, padding: '14px 0', background: sc.color + '18', border: `1px solid ${sc.color}50`,
            borderRadius: 8, cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 600,
            color: sc.color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: sc.color }} />
            {lang === 'es' ? `Detener y analizar (${fmtTime(recSecs)})` : `Stop & analyze (${fmtTime(recSecs)})`}
          </button>
        )}
      </div>
    </div>
  );
}

function EdgeProcessing({ lang, sc, sport, tick, demo }) {
  const pipeline = EDGE_PIPELINE[sport] || EDGE_PIPELINE.downhill;
  const steps = pipeline[lang === 'es' ? 'es' : 'en'];
  const cur = Math.min(Math.floor(tick / (demo ? 6 : 10)), steps.length - 1);
  const pct = Math.min((tick / (demo ? 36 : 56)) * 100, 99);

  return (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#4a6a8a', letterSpacing: '0.1em', marginBottom: 24 }}>
        {lang === 'es' ? 'PROCESANDO EN DISPOSITIVO EDGE' : 'PROCESSING ON EDGE DEVICE'}
      </div>
      <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 28px' }}>
        <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r="50" fill="none" stroke="#1c2d42" strokeWidth="6" />
          <circle cx="60" cy="60" r="50" fill="none" stroke={sc.color} strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${sc.color}70)`, transition: 'stroke-dashoffset 0.2s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 20, color: '#dce8f5', fontWeight: 700 }}>{Math.round(pct)}%</span>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#4a6a8a', letterSpacing: '0.08em' }}>EDGE</span>
        </div>
      </div>
      <div style={{ maxWidth: 320, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {steps.map((s, i) => {
          const done = i < cur;
          const active = i === cur;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 6, textAlign: 'left',
              background: active ? sc.color + '10' : done ? '#0d142155' : 'transparent',
              border: `1px solid ${active ? sc.color + '40' : done ? sc.color + '18' : '#1c2d4218'}`,
              transition: 'all 0.3s',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                background: done ? sc.color + '30' : active ? sc.color + '20' : 'transparent',
                border: `1.5px solid ${done || active ? sc.color : '#1c2d42'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, color: sc.color,
              }}>
                {done ? '✓' : active ? '·' : ''}
              </div>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.04em', color: done ? sc.color : active ? '#dce8f5' : '#2a4a6a', transition: 'color 0.3s' }}>
                {s}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 24, fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#3a5a7a' }}>
        {lang === 'es' ? '~30 segundos para resultados completos' : '~30 seconds to full results'}
      </div>
    </div>
  );
}

function EdgeDone({ lang, sc, recSecs, fmtTime, setState, onReset, sport }) {
  const SUMMARY = {
    downhill: { en: ['Posture drift — frames 44–91', 'Line commitment early on sector 3'], es: ['Deriva postural — frames 44–91', 'Línea comprometida en sector 3'] },
    karting:  { en: ['Brake point C3 0.4s late', 'Apex C1 optimal — replicate'], es: ['Punto de frenado C3 0.4s tarde', 'Apex C1 óptimo — replicar'] },
    surf:     { en: ['Wave entry timing good', 'Balance correction on turn — mid-ride'], es: ['Buen timing de entrada a ola', 'Corrección de equilibrio en giro'] },
  };
  const notes = (SUMMARY[sport] || SUMMARY.downhill)[lang === 'es' ? 'es' : 'en'];

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#22c55e14', border: '2px solid #22c55e50', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 26, color: '#22c55e' }}>✓</div>
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, color: '#dce8f5', marginBottom: 4 }}>
        {lang === 'es' ? 'Sesión edge procesada' : 'Edge session processed'}
      </div>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#4a6a8a', marginBottom: 28, letterSpacing: '0.08em' }}>
        {lang === 'es' ? `DURACIÓN: ${fmtTime(recSecs)} · ARTEFACTOS LISTOS` : `DURATION: ${fmtTime(recSecs)} · ARTIFACTS READY`}
      </div>
      <div style={{ border: '1px solid #1c2d42', borderRadius: 8, padding: '16px 18px', marginBottom: 20, textAlign: 'left', background: '#0d142170' }}>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#4a6a8a', letterSpacing: '0.1em', marginBottom: 12 }}>
          {lang === 'es' ? 'VISTA PREVIA — PRÓXIMOS PASOS' : 'PREVIEW — NEXT STEPS'}
        </div>
        {notes.map((n, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < notes.length - 1 ? 9 : 0 }}>
            <span style={{ color: sc.color, flexShrink: 0 }}>↑</span>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, color: '#dce8f5', lineHeight: 1.45 }}>{n}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={() => setState(s => ({ ...s, page: 'review' }))} style={{
          background: sc.color, border: 'none', borderRadius: 6, padding: '11px 26px', cursor: 'pointer',
          fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 600, color: '#07090f',
        }}>
          {lang === 'es' ? 'Ver análisis →' : 'View analysis →'}
        </button>
        <button onClick={onReset} style={{
          background: 'none', border: '1px solid #1c2d42', borderRadius: 6, padding: '11px 20px', cursor: 'pointer',
          fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: '#4a6a8a',
        }}>
          {lang === 'es' ? 'Nueva sesión' : 'New session'}
        </button>
      </div>
    </div>
  );
}
