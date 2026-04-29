import React, { useState, useEffect, useRef } from 'react';
import { SPORTS, tl, ScoreRing, MiniChart } from './core.jsx';
import { getKartingSession, videoUrl, deleteSession, analyzeFrame } from './api.js';

const KT_COLOR = SPORTS.karting.color;

// ── Telemetry timeline charts ─────────────────────────────────────────────────

function useCanvasChart(frames, renderFn, deps = []) {
  const ref = useRef(null);
  const draw = () => {
    const canvas = ref.current;
    if (!canvas || !frames?.length) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (!w || !h) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    renderFn(ctx, w, h, frames);
  };
  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, ...deps]);
  return ref;
}

// Wrapper that adds click-to-seek and playhead indicator on top of any canvas chart
function SeekableChart({ children, onSeek, progress, height }) {
  const wrapRef = useRef(null);

  function handleClick(e) {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(frac);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', cursor: onSeek ? 'crosshair' : 'default' }}
      onClick={handleClick}>
      {children}
      {/* Playhead — white vertical line at current video position */}
      {progress != null && progress > 0 && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${progress * 100}%`,
          width: 1, background: 'rgba(255,255,255,0.7)',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

function KerbTimeline({ frames, lang, onSeek, progress }) {
  const ref = useCanvasChart(frames, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const n = frames.length;
    const col = W / n;
    frames.forEach((f, i) => {
      const kl = f.kl, kr = f.kr;
      if (kl && kr)      ctx.fillStyle = '#facc15';   // both — yellow
      else if (kl)       ctx.fillStyle = '#22d3ee';   // left — cyan
      else if (kr)       ctx.fillStyle = '#f87171';   // right — red
      else               ctx.fillStyle = '#1a1a1a';   // clear
      ctx.fillRect(Math.floor(i * col), 0, Math.ceil(col) + 1, H);
    });
    // Center divider
    ctx.fillStyle = '#333';
    ctx.fillRect(0, H / 2 - 0.5, W, 1);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#555', letterSpacing: '0.08em' }}>
          {lang === 'es' ? 'KERB CONTACT' : 'KERB CONTACT'}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          {[['#22d3ee', 'L'], ['#f87171', 'R'], ['#facc15', 'L+R']].map(([c, l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: 1, background: c, display: 'inline-block' }} />
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color: '#444' }}>{l}</span>
            </span>
          ))}
        </div>
      </div>
      <SeekableChart onSeek={onSeek} progress={progress}>
        <canvas ref={ref} style={{ width: '100%', height: 22, display: 'block', borderRadius: 3 }} />
      </SeekableChart>
    </div>
  );
}

function ApexTimeline({ frames, lang, onSeek, progress }) {
  const ref = useCanvasChart(frames, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const n = frames.length;
    const col = W / n;
    frames.forEach((f, i) => {
      if (f.ap === null || f.ap === undefined) {
        ctx.fillStyle = '#111';
      } else if (f.ap === -1) {
        ctx.fillStyle = '#1e3a5f';   // left — dark blue
      } else if (f.ap === 1) {
        ctx.fillStyle = '#3d1f00';   // right — dark orange
      } else {
        ctx.fillStyle = '#0f3020';   // center — dark green
      }
      ctx.fillRect(Math.floor(i * col), 0, Math.ceil(col) + 1, H);
    });
    ctx.fillStyle = '#333';
    ctx.fillRect(W / 2, 0, 1, H);  // center marker
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#555', letterSpacing: '0.08em' }}>
          APEX DIR
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          {[['#1e3a5f', lang === 'es' ? 'IZQ' : 'L'], ['#0f3020', lang === 'es' ? 'CTR' : 'C'], ['#3d1f00', lang === 'es' ? 'DER' : 'R']].map(([c, l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: 1, background: c, display: 'inline-block', border: '1px solid #333' }} />
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color: '#444' }}>{l}</span>
            </span>
          ))}
        </div>
      </div>
      <SeekableChart onSeek={onSeek} progress={progress}>
        <canvas ref={ref} style={{ width: '100%', height: 22, display: 'block', borderRadius: 3 }} />
      </SeekableChart>
    </div>
  );
}

function GapTimeline({ frames, lang, onSeek, progress }) {
  const ref = useCanvasChart(frames, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const n = frames.length;
    const col = W / n;
    // Draw filled area under the gap line
    ctx.beginPath();
    ctx.moveTo(0, H);
    let hasData = false;
    frames.forEach((f, i) => {
      if (f.gap != null) {
        const x = i * col + col / 2;
        const y = H - f.gap * H;
        if (!hasData) { ctx.lineTo(x, y); hasData = true; }
        else ctx.lineTo(x, y);
      }
    });
    ctx.lineTo(W, H);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#22d3ee55');
    grad.addColorStop(1, '#22d3ee08');
    ctx.fillStyle = grad;
    ctx.fill();
    // Line on top
    ctx.beginPath();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1;
    hasData = false;
    frames.forEach((f, i) => {
      if (f.gap != null) {
        const x = i * col + col / 2;
        const y = H - f.gap * H;
        if (!hasData) { ctx.moveTo(x, y); hasData = true; }
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#555', letterSpacing: '0.08em' }}>
          {lang === 'es' ? 'GAP (kart adelante)' : 'GAP (kart ahead)'}
        </span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color: '#333' }}>
          {lang === 'es' ? '0=lejos 1=cerca' : '0=far 1=close'}
        </span>
      </div>
      <SeekableChart onSeek={onSeek} progress={progress}>
        <canvas ref={ref} style={{ width: '100%', height: 32, display: 'block', borderRadius: 3 }} />
      </SeekableChart>
    </div>
  );
}

function LatTimeline({ frames, lang, onSeek, progress }) {
  const ref = useCanvasChart(frames, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const n = frames.length;
    const col = W / n;
    // Background gradient L→R
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0,   '#1a2a1a');
    grad.addColorStop(0.5, '#111');
    grad.addColorStop(1,   '#2a1a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Center ideal line
    ctx.fillStyle = '#222';
    ctx.fillRect(W / 2 - 0.5, 0, 1, H);
    // Lat position line
    ctx.beginPath();
    ctx.strokeStyle = KT_COLOR;
    ctx.lineWidth = 1.5;
    let hasData = false;
    frames.forEach((f, i) => {
      if (f.lat != null) {
        const x = i * col + col / 2;
        const y = H - f.lat * H;
        if (!hasData) { ctx.moveTo(x, y); hasData = true; }
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#555', letterSpacing: '0.08em' }}>
          {lang === 'es' ? 'POSICIÓN LATERAL' : 'LATERAL POSITION'}
        </span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color: '#333' }}>
          {lang === 'es' ? 'izq ←→ der' : 'L ←→ R'}
        </span>
      </div>
      <SeekableChart onSeek={onSeek} progress={progress}>
        <canvas ref={ref} style={{ width: '100%', height: 36, display: 'block', borderRadius: 3 }} />
      </SeekableChart>
    </div>
  );
}

function TelemetryTimeline({ frames, mode, lang, onSeek, progress }) {
  const isActionCam = mode === 'action_cam';
  if (!frames?.length) return null;

  return (
    <div style={{
      border: '1px solid #1e1e1e', borderRadius: 8,
      background: '#0a0a0a', overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid #161616',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#444', letterSpacing: '0.1em' }}>
          {lang === 'es' ? 'TELEMETRÍA · TIMELINE' : 'TELEMETRY · TIMELINE'}
        </span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {onSeek && (
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color: '#333', letterSpacing: '0.06em' }}>
              {lang === 'es' ? '← click para ir al frame' : '← click to seek'}
            </span>
          )}
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#2a2a2a' }}>
            {frames.length} {lang === 'es' ? 'pts' : 'pts'}
          </span>
        </div>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isActionCam ? (
          <>
            <KerbTimeline frames={frames} lang={lang} onSeek={onSeek} progress={progress} />
            <ApexTimeline frames={frames} lang={lang} onSeek={onSeek} progress={progress} />
            <GapTimeline  frames={frames} lang={lang} onSeek={onSeek} progress={progress} />
          </>
        ) : (
          <LatTimeline frames={frames} lang={lang} onSeek={onSeek} progress={progress} />
        )}
      </div>
    </div>
  );
}

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

function VideoPanel({ lang, video = 'luciano', mode = 'fpv_follow', src = null, sessionId = null, onAnalysisResult, onRegisterSeek, onProgressChange }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pinned, setPinned] = useState(null); // { time, pct } — marked analysis point

  // Register external seek function so TelemetryTimeline can seek the video
  useEffect(() => {
    if (onRegisterSeek) {
      onRegisterSeek((frac) => {
        const v = videoRef.current;
        if (v && v.duration) {
          v.currentTime = frac * v.duration;
          v.pause();
          setPlaying(false);
        }
      });
    }
  }, [onRegisterSeek]);

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

  function pinFrame() {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    setPinned({ time: v.currentTime, pct: v.currentTime / (v.duration || 1) });
  }

  async function requestAnalysis() {
    if (!sessionId || pinned === null) return;
    setAnalyzing(true);
    try {
      const result = await analyzeFrame(sessionId, pinned.time, mode);
      onAnalysisResult && onAnalysisResult({ ...result, pinned });
    } catch (e) {
      onAnalysisResult && onAnalysisResult({ error: e.message, pinned });
    } finally {
      setAnalyzing(false);
    }
  }

  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const canAnalyze = !!sessionId;

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #222', background: '#0d0d0d' }}>
      <div style={{
        padding: '7px 12px', borderBottom: '1px solid #1a1a1a',
        fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: KT_COLOR,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{src ? (mode === 'action_cam' ? 'GoPro / Action Cam' : 'FPV Drone Follow') : (video === 'gopro' ? 'GoPro Casco' : 'FPV — Luciano')}</span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#3a3a3a' }}>
          {mode === 'action_cam' ? 'Action cam · SAM3+HSV · ByteTrack' : 'Chase cam · SAM3+HSV · ByteTrack'}
        </span>
      </div>

      <div style={{ position: 'relative', background: '#000', aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          src={src || `/karting-demo/${video}_annotated.mp4`}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          onTimeUpdate={() => {
            const v = videoRef.current;
            if (v?.duration) {
              const p = v.currentTime / v.duration;
              setProgress(p);
              setCurrentTime(v.currentTime);
              onProgressChange?.(p);
            }
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

        {/* Pin button — top right, only for real sessions */}
        {canAnalyze && !error && (
          <button
            onClick={pinFrame}
            title={lang === 'es' ? 'Marcar frame para análisis VLM' : 'Mark frame for VLM analysis'}
            style={{
              position: 'absolute', top: 10, right: 10,
              padding: '5px 10px', borderRadius: 5,
              background: pinned ? KT_COLOR + 'ee' : '#00000099',
              border: `1px solid ${pinned ? KT_COLOR : '#ffffff30'}`,
              color: pinned ? '#080808' : '#fff',
              fontFamily: 'Space Mono, monospace', fontSize: 9, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, letterSpacing: '0.06em',
              transition: 'all 0.2s',
            }}>
            <span>📍</span>
            <span>{pinned ? fmt(pinned.time) : (lang === 'es' ? 'MARCAR' : 'PIN')}</span>
          </button>
        )}
      </div>

      <div style={{ padding: '10px 14px', background: '#0d0d0d' }}>
        {/* Scrub bar with pin marker */}
        <div onClick={seek} style={{
          height: 4, background: '#1a1a1a', borderRadius: 2, cursor: 'pointer', marginBottom: 8,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${progress * 100}%`, background: KT_COLOR, borderRadius: 2,
          }} />
          {pinned && (
            <div style={{
              position: 'absolute', top: -3, left: `${pinned.pct * 100}%`,
              width: 2, height: 10, background: '#fff', borderRadius: 1,
              transform: 'translateX(-50%)',
              boxShadow: '0 0 4px #fff8',
            }} />
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b' }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {pinned && canAnalyze && (
              <button
                onClick={requestAnalysis}
                disabled={analyzing}
                style={{
                  padding: '4px 12px', borderRadius: 4,
                  background: analyzing ? '#1a1a1a' : KT_COLOR,
                  border: 'none', color: analyzing ? KT_COLOR : '#080808',
                  fontFamily: 'Space Mono, monospace', fontSize: 9, cursor: analyzing ? 'wait' : 'pointer',
                  letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.2s',
                }}>
                {analyzing
                  ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span> {lang === 'es' ? 'ANALIZANDO...' : 'ANALYZING...'}</>
                  : <>{lang === 'es' ? '⚡ ANALIZAR FRAME' : '⚡ ANALYZE FRAME'}</>
                }
              </button>
            )}
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#3a3a3a' }}>
              YOLO11n + ByteTrack
            </span>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
          {kart.coaching && !kart.coaching.startsWith('⚠') && (
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

function DriverCoachCard({ coaching, kerb_events, apex_frames, frames_analyzed, lang }) {
  const color = KT_COLOR;
  const kerb_pct = (kerb_events != null && frames_analyzed)
    ? Math.round((kerb_events / frames_analyzed) * 100)
    : null;
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
        <div style={{ textAlign: 'right', display: 'flex', gap: 16 }}>
          {kerb_events != null && (
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 18, color, lineHeight: 1 }}>{kerb_events}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#6b6b6b', marginTop: 2 }}>
                {lang === 'es' ? 'KERB EVENTS' : 'KERB EVENTS'}
              </div>
            </div>
          )}
          {apex_frames != null && (
            <div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 18, color, lineHeight: 1 }}>{apex_frames}</div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#6b6b6b', marginTop: 2 }}>
                {lang === 'es' ? 'FRAMES APEX' : 'APEX FRAMES'}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '16px' }}>
        {coaching && !coaching.startsWith('⚠')
          ? <CoachingText text={coaching} />
          : <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: '#eab30808', border: '1px solid #eab30820', borderRadius: 6 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🔑</span>
              <div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#eab308', letterSpacing: '0.08em', marginBottom: 4 }}>VLM COACHING DESHABILITADO</div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: '#888', lineHeight: 1.5 }}>
                  {lang === 'es'
                    ? <>Agrega tu <code style={{ color: '#eab308', background: '#eab30812', borderRadius: 3, padding: '1px 5px', fontFamily: 'Space Mono, monospace', fontSize: 10 }}>GROQ_API_KEY</code> en <code style={{ color: '#ccc', background: '#1a1a1a', borderRadius: 3, padding: '1px 5px', fontFamily: 'Space Mono, monospace', fontSize: 10 }}>backend/.env</code> para análisis VLM automático.</>
                    : <>Add your <code style={{ color: '#eab308', background: '#eab30812', borderRadius: 3, padding: '1px 5px', fontFamily: 'Space Mono, monospace', fontSize: 10 }}>GROQ_API_KEY</code> in <code style={{ color: '#ccc', background: '#1a1a1a', borderRadius: 3, padding: '1px 5px', fontFamily: 'Space Mono, monospace', fontSize: 10 }}>backend/.env</code> for automatic VLM coaching.</>
                  }
                </div>
              </div>
            </div>
        }
      </div>
      <div style={{ padding: '10px 16px', borderTop: `1px solid #1a1a1a`, display: 'flex', gap: 16 }}>
        {[
          { label: 'RACING LINE', detail: lang === 'es' ? 'punto de fuga' : 'vanishing point' },
          { label: 'TIRES',      detail: lang === 'es' ? 'llantas delanteras' : 'front tires' },
          { label: 'KERB L/R',   detail: lang === 'es' ? 'detección kerb' : 'kerb detection' },
          { label: 'GAP BAR',    detail: lang === 'es' ? 'kart adelante' : 'kart ahead' },
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

// ── Tier 0 analysis panel ─────────────────────────────────────────────────────

const TIER0_FPV = [
  {
    tag: 'LAT POS',
    color: KT_COLOR,
    title: { en: 'Lateral Position', es: 'Posición Lateral' },
    body: {
      en: 'YOLO11n detects the kart every frame and finds its bounding box center (X pixel). That X is divided by the track width — measured from the SAM3 asphalt mask — to produce a value from 0 (far left) to 1 (far right). 0.5 is dead center. The score shown is the average across all detected frames.',
      es: 'YOLO11n detecta el kart en cada frame y encuentra el centro de su bounding box (píxel X). Ese X se divide por el ancho de la pista — medido desde la máscara de asfalto de SAM3 — para producir un valor de 0 (extremo izquierdo) a 1 (extremo derecho). 0.5 es el centro exacto. El score mostrado es el promedio de todos los frames detectados.',
    },
  },
  {
    tag: 'CONSIST.',
    color: KT_COLOR,
    title: { en: 'Line Consistency', es: 'Consistencia de Línea' },
    body: {
      en: 'Measures how repeatable the kart\'s lateral position is frame to frame. Formula: 100 − (std_dev of LAT POS × 300). A score of 100 means the kart holds a perfectly steady line. A low score means the path is erratic — drifting left/right unpredictably through the corner.',
      es: 'Mide qué tan repetible es la posición lateral del kart frame a frame. Fórmula: 100 − (desviación estándar de LAT POS × 300). Un score de 100 significa que el kart mantiene una línea perfectamente constante. Un score bajo significa que la trayectoria es errática — se mueve izquierda/derecha impredeciblemente.',
    },
  },
  {
    tag: 'EDGE USE',
    color: KT_COLOR,
    title: { en: 'Track Width Used', es: 'Uso del Ancho de Pista' },
    body: {
      en: 'Measures how much of the available track width the kart exploits. Formula: mean(|lat − 0.5| × 2) × 100. A score of 100 means the kart always runs at the very edges of the asphalt. A low score means it stays near the center and leaves width unused — a common sign of defensive or under-confident driving.',
      es: 'Mide qué tan bien el kart aprovecha el ancho disponible de la pista. Fórmula: promedio de |lat − 0.5| × 2 × 100. Un score de 100 significa que el kart siempre va por los bordes del asfalto. Un score bajo significa que se queda cerca del centro y deja ancho sin usar — señal común de conducción defensiva o insegura.',
    },
  },
  {
    tag: 'SAM3 + HSV',
    color: '#22c55e',
    title: { en: 'Track Segmentation — SAM3.1', es: 'Segmentación de Pista — SAM3.1' },
    body: {
      en: 'SAM3.1 (Meta, 848M params) runs once on the best calibration frame using a natural-language text prompt (e.g. "asphalt karting track surface" — customizable per session). The resulting mask calibrates the HSV color ranges of the asphalt specific to this lighting and camera. Those calibrated ranges are applied to every frame in ~100 FPS. 12× faster than full SAM3 propagation. Falls back to SAM2 HSV if SAM3 is unavailable.',
      es: 'SAM3.1 (Meta, 848M params) corre una vez sobre el mejor frame de calibración con un text prompt en lenguaje natural (ej. "asphalt karting track surface" — personalizable por sesión). La máscara resultante calibra los rangos de color HSV del asfalto para esta iluminación y cámara específica. Esos rangos se aplican a todos los frames a ~100 FPS. 12× más rápido que la propagación completa de SAM3. Fallback a SAM2 HSV si SAM3 no está disponible.',
    },
  },
  {
    tag: 'LLM',
    color: '#a78bfa',
    title: { en: 'AI Coaching — LLM + VLM (Groq)', es: 'Coaching IA — LLM + VLM (Groq)' },
    body: {
      en: 'Two separate AI calls with distinct roles:\n\n• LLM (automatic, text-only): runs once at end of pipeline using ONLY session metrics — kart scores, kerb rate, consistency, edge use. No image. Gives a general performance summary.\n\n• VLM (on-demand, image + time-window metrics): only activates when the user explicitly pins a timestamp in the review player. Backend extracts that exact annotated frame + telemetry within ±5s of that moment (kerb events, gap, apex markers). The VLM can only comment on visual content when a frame is explicitly pinned.',
      es: 'Dos llamadas IA con roles distintos:\n\n• LLM (automático, solo texto): se ejecuta una vez al final del pipeline usando ÚNICAMENTE las métricas de la sesión — scores de karts, tasa de kerb, consistencia, uso de pista. Sin imagen. Da un resumen general del rendimiento.\n\n• VLM (bajo demanda, imagen + métricas de ventana temporal): solo se activa cuando el usuario ancla explícitamente un timestamp en el reproductor. El backend extrae ese frame anotado exacto + telemetría dentro de ±5s de ese momento (eventos kerb, gap, marcadores de ápex). El VLM solo puede opinar sobre el contenido visual cuando un frame está explícitamente anclado.',
    },
  },
];

const TIER0_ACTION = [
  {
    tag: 'RACING LINE',
    color: '#22c55e',
    title: { en: 'Vanishing Point — Apex Direction', es: 'Punto de Fuga — Dirección de Ápex' },
    body: {
      en: 'SAM3+HSV segments the track surface (asphalt) in each frame. The centerline of that mask is computed by sampling horizontal strips and finding the midpoint of the track width at each row. A line is fitted through those midpoints — where it converges in the upper frame is the vanishing point, which indicates where the racing line is pointing. A green dot marks the apex direction; text shows if you\'re aimed left, center or right.',
      es: 'SAM3+HSV segmenta la superficie de la pista (asfalto) en cada frame. La línea central de esa máscara se calcula muestreando franjas horizontales y encontrando el punto medio del ancho de pista en cada fila. Se ajusta una línea por esos puntos — donde converge en la parte superior del frame es el punto de fuga, que indica hacia dónde apunta la trayectoria. Un punto verde marca la dirección del ápex; el texto indica si estás apuntando izquierda, centro o derecha.',
    },
  },
  {
    tag: 'TIRES',
    color: '#f59e0b',
    title: { en: 'Front Tire Markers (Tier 1)', es: 'Marcadores de Llantas (Tier 1)' },
    body: {
      en: 'Planned for Tier 1. Requires the camera mounted on the front bodywork (not helmet) so the front tires are visible in the lower frame. With that setup, dark elliptical regions (tire rubber) are detected per-frame — their horizontal position combined with the vanishing point gives steering angle as a proxy. With a helmet-mount camera (current setup) the cockpit and steering wheel fill the lower frame, making tire detection unreliable.',
      es: 'Planificado para Tier 1. Requiere cámara montada en la carrocería delantera (no en el casco) para que las llantas delanteras sean visibles. Con ese setup, se detectan regiones elípticas oscuras (caucho) por frame — su posición horizontal combinada con el punto de fuga da el ángulo de dirección como proxy. Con cámara de casco (setup actual) el cockpit y el volante llenan la parte inferior del frame, haciendo la detección poco fiable.',
    },
  },
  {
    tag: 'KERB L / R',
    color: '#22d3ee',
    title: { en: 'Kerb Contact Detection', es: 'Detección de Contacto con Kerb' },
    body: {
      en: 'Detection zones are fixed: left 10% and right 10% of the frame. Each zone is checked per frame for the red/white HSV color pattern typical of karting kerbs. These color ranges are pre-set — red/white kerbs are standard in most kart tracks. Limitation: yellow or blue kerbs are not detected.',
      es: 'Las zonas de detección son fijas: el 10% izquierdo y el 10% derecho del frame. Cada zona se analiza por frame buscando el patrón HSV rojo/blanco típico de kerbs de karting. Limitación: kerbs amarillos o azules no se detectan.',
    },
  },
  {
    tag: 'GAP BAR',
    color: KT_COLOR,
    title: { en: 'Gap to Kart Ahead', es: 'Brecha al Kart Adelante' },
    body: {
      en: 'YOLO11n detects vehicles ahead in the frame. The closest one (largest bbox area, filtered to exclude own kart parts) is used as the reference. Its bbox height is a proxy for distance — bigger = closer. The GAP bar fills proportionally. No bounding box is drawn on screen — the signal is used only for the bar.',
      es: 'YOLO11n detecta vehículos adelante en el frame. El más cercano (mayor área de bbox, filtrado para excluir partes del propio kart) se usa como referencia. La altura de su bbox es un proxy de distancia — mayor = más cerca. La barra GAP se llena proporcionalmente. No se dibuja ningún rectángulo en pantalla — la señal solo se usa para la barra.',
    },
  },
  {
    tag: 'VLM',
    color: '#a78bfa',
    title: { en: 'AI Coaching — Groq llama-4-scout', es: 'Coaching IA — Groq llama-4-scout' },
    body: {
      en: 'Called once automatically (richest frame) and on demand via the 📍 pin button. Receives the annotated frame with track overlay, apex marker and kerb indicators visible. Prompt focuses on: racing line quality, kerb usage, positioning. Also available as Frame Analysis — pause at any moment and get instant VLM feedback on that specific situation.',
      es: 'Se llama una vez automáticamente (frame más rico) y bajo demanda con el botón 📍. Recibe el frame anotado con el overlay de pista, marcador de ápex e indicadores de kerb visibles. El prompt se enfoca en: calidad de trayectoria, uso de kerbs, posicionamiento. También disponible como Análisis de Frame — pausa en cualquier momento y obtén feedback VLM instantáneo de esa situación específica.',
    },
  },
];

function FeatureAnnotations({ mode, lang }) {
  const isActionCam = mode === 'action_cam';
  const features = isActionCam ? TIER0_ACTION : TIER0_FPV;
  const KT_HEX = SPORTS.karting.colorHex;

  const title = isActionCam
    ? { en: 'TIER 0 — ACTION CAM ANALYSIS', es: 'TIER 0 — ANÁLISIS ACTION CAM' }
    : { en: 'TIER 0 — FPV DRONE ANALYSIS', es: 'TIER 0 — ANÁLISIS FPV DRONE' };

  const subtitle = {
    en: 'Zero-shot — no labelled data required. All metrics computed from raw video only.',
    es: 'Zero-shot — sin datos etiquetados. Todas las métricas se calculan solo del video crudo.',
  };

  return (
    <div style={{ border: `1px solid ${KT_HEX}22`, borderRadius: 8, overflow: 'hidden', background: '#0b0e0c' }}>
      {/* Header */}
      <div style={{
        padding: '12px 18px', borderBottom: `1px solid ${KT_HEX}20`,
        background: KT_HEX + '08',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.12em',
            color: KT_HEX, background: KT_HEX + '15', border: `1px solid ${KT_HEX}35`,
            borderRadius: 3, padding: '2px 8px', flexShrink: 0,
          }}>TIER 0</span>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#a0a0a0', letterSpacing: '0.09em' }}>
            {tl(title, lang)}
          </span>
        </div>
        <p style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: '#888', lineHeight: 1.5 }}>
          {tl(subtitle, lang)}
        </p>
      </div>

      {/* Feature cards */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {features.map((f, i) => (
          <div key={i} style={{
            padding: '14px 18px',
            borderBottom: i < features.length - 1 ? '1px solid #141414' : 'none',
          }}>
            {/* Tag + Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <span style={{
                fontFamily: 'Space Mono, monospace', fontSize: 9, whiteSpace: 'nowrap',
                color: f.color, background: f.color + '15', border: `1px solid ${f.color}30`,
                borderRadius: 3, padding: '3px 8px', flexShrink: 0, letterSpacing: '0.05em',
              }}>{f.tag}</span>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 600, color: '#c8c8c8' }}>
                {tl(f.title, lang)}
              </span>
            </div>
            {/* Body */}
            <p style={{
              margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: 12,
              color: '#9a9a9a', lineHeight: 1.7,
            }}>
              {tl(f.body, lang)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function KartingDemoPage({ state, setState }) {
  const { lang } = state;
  const sessionId = state.kartingSessionId || null;   // real backend session
  const video = state.kartingVideo || 'luciano';      // demo static file
  const mode  = state.kartingMode  || 'fpv_follow';
  const isActionCam = mode === 'action_cam';

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedKart, setExpandedKart] = useState(null);
  const [delConfirm, setDelConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [frameAnalysis, setFrameAnalysis] = useState(null);
  const [videoProgress, setVideoProgress] = useState(0); // 0-1 for timeline playhead

  // Seek bridge: VideoPanel registers its seek fn here; TelemetryTimeline calls it
  const seekFnRef = useRef(null);
  const handleRegisterSeek = (fn) => { seekFnRef.current = fn; };
  const handleTimelineSeek = (frac) => { seekFnRef.current?.(frac); };

  // video src: real session annotated video, or static demo file
  const videoSrc = sessionId ? videoUrl(sessionId, 'annotated') : null;

  useEffect(() => {
    setLoading(true);
    setSummary(null);

    const load = sessionId
      ? getKartingSession(sessionId)
      : fetch(`/karting-demo/${video}_summary.json`).then(r => { if (!r.ok) throw new Error('not found'); return r.json(); });

    load
      .then(data => {
        setSummary(data);
        const first = data.top_karts?.[0];
        if (first !== undefined) setExpandedKart(first);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId, video]);

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
                {sessionId ? (lang === 'es' ? 'SESIÓN KARTING' : 'KARTING SESSION') : (lang === 'es' ? 'DEMO KARTING' : 'KARTING DEMO')}
              </span>
              {sessionId && (
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginLeft: 8 }}>
                  {delConfirm && (
                    <button onClick={() => setDelConfirm(false)} style={{
                      padding: '3px 9px', borderRadius: 4, border: '1px solid #333',
                      fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#6b6b6b', cursor: 'pointer', background: '#0d0d0d',
                    }}>{lang === 'es' ? 'cancelar' : 'cancel'}</button>
                  )}
                  <button
                    onClick={() => {
                      if (!delConfirm) { setDelConfirm(true); return; }
                      setDeleting(true);
                      deleteSession(sessionId)
                        .then(() => setState(s => ({ ...s, page: 'sessions', kartingSessionId: null })))
                        .catch(() => { setDeleting(false); setDelConfirm(false); });
                    }}
                    title={delConfirm ? (lang === 'es' ? 'Confirmar eliminación' : 'Confirm delete') : (lang === 'es' ? 'Eliminar sesión' : 'Delete session')}
                    style={{
                      padding: '3px 9px', borderRadius: 4,
                      border: `1px solid ${delConfirm ? '#ef4444' : '#2a2a2a'}`,
                      background: delConfirm ? '#ef444415' : 'transparent',
                      color: delConfirm ? '#ef4444' : '#555',
                      fontFamily: 'Space Mono, monospace', fontSize: 8, cursor: deleting ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                    }}>
                    {deleting ? '…' : delConfirm ? (lang === 'es' ? '✓ ELIMINAR' : '✓ DELETE') : (
                      <><svg width="9" height="10" viewBox="0 0 11 12" fill="none" style={{ flexShrink: 0 }}><path d="M1 3h9M4 3V2h3v1M2 3l.7 7.3a.7.7 0 00.7.7h4.2a.7.7 0 00.7-.7L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>{lang === 'es' ? 'ELIMINAR' : 'DELETE'}</>
                    )}
                  </button>
                </div>
              )}
            </div>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 24, fontWeight: 700, color: '#EDEDE8', margin: '0 0 4px' }}>
              {isActionCam ? 'Kartodromo — GoPro / Action Cam' : 'Kartodromo — FPV Drone Follow'}
            </h2>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b' }}>
              {sessionId ? sessionId : (summary?.date || '2026-04-28')} · {summary?.frames_analyzed || '—'} frames
              {isActionCam
                ? (summary?.kerb_events != null ? ` · ${summary.kerb_events} kerb events` : '')
                : ` · ${summary?.karts_detected || '—'} karts`}
              {isActionCam && summary?.skip_seconds > 0 && (
                <span style={{ color: '#444', marginLeft: 8 }}>· intro skip {summary.skip_seconds}s</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['YOLO11n', 'ByteTrack', 'SAM3 + HSV', 'Groq LLM'].map((b, i) => (
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
            <VideoPanel
              lang={lang} video={video} mode={mode} src={videoSrc}
              sessionId={sessionId}
              onAnalysisResult={r => setFrameAnalysis(r)}
              onRegisterSeek={handleRegisterSeek}
              onProgressChange={setVideoProgress}
            />

            {/* Frame analysis result */}
            {frameAnalysis && (
              <div style={{
                border: `1px solid ${frameAnalysis.error ? '#ef444440' : '#a78bfa40'}`,
                borderRadius: 8, background: frameAnalysis.error ? '#ef444408' : '#a78bfa08',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '8px 14px', borderBottom: `1px solid ${frameAnalysis.error ? '#ef444420' : '#a78bfa20'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12 }}>📍</span>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#a78bfa', letterSpacing: '0.08em' }}>
                      {lang === 'es' ? 'ANÁLISIS DE FRAME' : 'FRAME ANALYSIS'}
                      {frameAnalysis.timestamp_sec !== undefined && (
                        <span style={{ color: '#6b6b6b', marginLeft: 8 }}>
                          @ {Math.floor(frameAnalysis.timestamp_sec / 60)}:{String(Math.floor(frameAnalysis.timestamp_sec % 60)).padStart(2, '0')}
                        </span>
                      )}
                    </span>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#555' }}>
                      Groq / llama-4-scout
                    </span>
                  </div>
                  <button onClick={() => setFrameAnalysis(null)} style={{
                    fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#555', cursor: 'pointer',
                    background: 'none', border: 'none', padding: '2px 6px',
                  }}>✕</button>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  {frameAnalysis.error
                    ? <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, color: '#ef6464', margin: 0 }}>{frameAnalysis.error}</p>
                    : <CoachingText text={frameAnalysis.coaching} />
                  }
                </div>
              </div>
            )}

            {/* Pipeline numbers strip */}
            {summary && (
              <div style={{
                display: 'flex', gap: 0,
                border: '1px solid #222', borderRadius: 8, overflow: 'hidden', background: '#111111',
              }}>
                {[
                  { v: summary.frames_analyzed, k: lang === 'es' ? 'frames' : 'frames' },
                  isActionCam
                    ? { v: summary.kerb_events ?? '—', k: lang === 'es' ? 'eventos kerb' : 'kerb events' }
                    : { v: summary.karts_detected, k: lang === 'es' ? 'karts det.' : 'karts det.' },
                  { v: 'SAM3+HSV',              k: lang === 'es' ? 'segmentación' : 'segmentation' },
                  { v: 'GROQ',                  k: 'llama-4-scout-17b' },
                ].map((s, i, arr) => (
                  <div key={i} style={{
                    flex: 1, padding: '10px 14px', textAlign: 'center',
                    borderRight: i < arr.length - 1 ? '1px solid #1a1a1a' : 'none',
                  }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: KT_COLOR, lineHeight: 1, marginBottom: 3 }}>{s.v}</div>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#666' }}>{s.k}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Telemetry timeline charts */}
            {summary?.frames?.length > 0 && (
              <TelemetryTimeline
                frames={summary.frames} mode={mode} lang={lang}
                onSeek={handleTimelineSeek} progress={videoProgress}
              />
            )}

            {/* Feature annotations — legend for what's in the video */}
            <FeatureAnnotations mode={mode} lang={lang} />
          </div>

          {/* Right: kart analysis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#6b6b6b', letterSpacing: '0.1em', marginBottom: 4 }}>
              {lang === 'es' ? 'ANÁLISIS POR KART' : 'PER-KART ANALYSIS'}
              {summary && <span style={{ color: '#555', marginLeft: 8 }}>— datos reales del pipeline</span>}
            </div>

            {loading && (
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b6b6b', padding: '20px 0', textAlign: 'center' }}>
                {lang === 'es' ? 'Cargando datos...' : 'Loading data...'}
              </div>
            )}

            {!loading && karts.length === 0 && (
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#555', padding: '20px 0', textAlign: 'center' }}>
                {lang === 'es' ? 'Corrá el pipeline para ver análisis real.' : 'Run the pipeline to see real analysis.'}
              </div>
            )}

            {isActionCam ? (
              summary && <DriverCoachCard
                coaching={summary.coaching?.driver}
                kerb_events={summary.kerb_events ?? null}
                apex_frames={summary.apex_frames ?? null}
                frames_analyzed={summary.frames_analyzed}
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
