import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { SPORTS, Nav } from './core.jsx';
import { OverviewPage, AnalyzePage, SessionsPage, DemosPage, MethodPage } from './pages.jsx';
import { SessionReviewPage } from './review.jsx';
import { LivePage } from './live.jsx';
import { KartingDemoPage } from './karting.jsx';
import { checkHealth } from './api.js';

const STORAGE_KEY = 'drcoach-v3';
const VALID_PAGES = new Set(['overview', 'analyze', 'demos', 'sessions', 'review', 'method', 'karting-demo']);
const VALID_KARTING_MODES = new Set(['fpv_follow', 'action_cam']);

function defaultAppState() {
  return {
    sport: 'downhill',
    page: 'overview',
    lang: 'en',
    demo: true,
    reviewSessionId: null,
    kartingSessionId: null,
    kartingVideo: null,
    kartingMode: null,
    backendOnline: false,
  };
}

function sanitizePersistedState(raw) {
  const fallback = defaultAppState();
  if (!raw || typeof raw !== 'object') return fallback;

  const state = {
    sport: SPORTS[raw.sport] ? raw.sport : fallback.sport,
    page: fallback.page,
    lang: raw.lang === 'es' ? 'es' : 'en',
    demo: typeof raw.demo === 'boolean' ? raw.demo : fallback.demo,
    reviewSessionId: typeof raw.reviewSessionId === 'string' && raw.reviewSessionId.trim() ? raw.reviewSessionId : null,
    kartingSessionId: typeof raw.kartingSessionId === 'string' && raw.kartingSessionId.trim() ? raw.kartingSessionId : null,
    kartingVideo: typeof raw.kartingVideo === 'string' && raw.kartingVideo.trim() ? raw.kartingVideo : null,
    kartingMode: VALID_KARTING_MODES.has(raw.kartingMode) ? raw.kartingMode : null,
    backendOnline: false,
  };

  if (state.page === 'review' && !state.reviewSessionId) {
    state.page = 'overview';
  }

  if (state.page === 'karting-demo') {
    state.sport = 'karting';
    if (!state.kartingSessionId && !state.kartingVideo) {
      state.kartingVideo = 'luciano';
      state.kartingMode = state.kartingMode || 'fpv_follow';
    }
  }

  return state;
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    return { hasError: true };
  }

  handleReset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#080808',
          color: '#EDEDE8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            width: '100%',
            maxWidth: 520,
            border: '1px solid #1f1f1f',
            borderRadius: 10,
            background: '#0d0d0d',
            padding: '24px 22px',
          }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#22c55e', letterSpacing: '0.12em', marginBottom: 12 }}>
              DRIVERCOACH RESET
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Reiniciamos el estado local del navegador.
            </div>
            <div style={{ fontSize: 14, color: '#8a8a8a', lineHeight: 1.6, marginBottom: 18 }}>
              Había un estado guardado incompatible con esta versión del frontend. Ya lo limpié para que puedas entrar de nuevo.
            </div>
            <button onClick={this.handleReset} style={{
              background: '#111',
              border: '1px solid #22c55e55',
              color: '#22c55e',
              borderRadius: 6,
              padding: '10px 14px',
              cursor: 'pointer',
              fontFamily: 'Space Mono, monospace',
              fontSize: 11,
              letterSpacing: '0.08em',
            }}>
              RECARGAR LIMPIO
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wake backend bar — visible when backend is offline
function WakeBar({ onWake, wakeState }) {
  const labels = {
    sleeping: { en: 'BACKEND SLEEPING', es: 'BACKEND DORMIDO' },
    waking:   { en: 'WAKING SYSTEM…',  es: 'INICIANDO SISTEMA…' },
    degraded: { en: 'DEGRADED — RETRY?', es: 'DEGRADADO — ¿REINTENTAR?' },
  };
  const colors = { sleeping: '#555', waking: '#eab308', degraded: '#ef4444' };
  const st = wakeState || 'sleeping';
  const col = colors[st] || '#555';

  return (
    <div style={{
      position: 'fixed', top: 52, left: 0, right: 0, zIndex: 190,
      background: '#0d0d0d', borderBottom: '1px solid #1a1a1a',
      padding: '7px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: col,
          boxShadow: st === 'waking' ? `0 0 6px ${col}` : 'none',
          flexShrink: 0,
          animation: st === 'waking' ? 'pulse 1s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: col, letterSpacing: '0.1em' }}>
          {labels[st]?.en || 'BACKEND OFFLINE'}
        </span>
        {st === 'waking' && (
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#3a3a3a', letterSpacing: '0.06em' }}>
            · cold start ~40s
          </span>
        )}
      </div>
      {st !== 'waking' && (
        <button onClick={onWake} style={{
          background: 'none', border: `1px solid ${col}40`,
          borderRadius: 3, padding: '3px 12px', cursor: 'pointer',
          fontFamily: 'Space Mono, monospace', fontSize: 9,
          color: col, letterSpacing: '0.1em',
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = col + '15'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          WAKE SYSTEM
        </button>
      )}
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
      `}</style>
    </div>
  );
}

function App() {
  const [state, setState] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return sanitizePersistedState(s);
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      return defaultAppState();
    }
  });
  const [wakeState, setWakeState] = useState('sleeping'); // sleeping | waking | degraded
  const wakeTimerRef = useRef(null);

  // Persist nav state (exclude transient fields)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sport: state.sport,
      lang: state.lang,
      demo: state.demo,
      reviewSessionId: state.reviewSessionId || null,
      kartingSessionId: state.kartingSessionId || null,
      kartingVideo: state.kartingVideo || null,
      kartingMode: state.kartingMode || null,
    }));
  }, [state.sport, state.page, state.lang, state.demo, state.reviewSessionId, state.kartingSessionId, state.kartingVideo, state.kartingMode]);

  // Health check on mount and every 30s
  useEffect(() => {
    async function poll() {
      const result = await checkHealth();
      const online = result && result.status === 'ok';
      // When backend comes online → clear demo automatically; when offline → force demo
      setState(s => ({ ...s, backendOnline: online, demo: !online }));
      if (online) setWakeState('live');
    }
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  function handleWake() {
    if (wakeTimerRef.current) clearInterval(wakeTimerRef.current);
    setWakeState('waking');
    let attempts = 0;
    const max = 30; // 30 × 2s = 60s timeout
    wakeTimerRef.current = setInterval(async () => {
      attempts++;
      const result = await checkHealth();
      if (result && result.status === 'ok') {
        clearInterval(wakeTimerRef.current);
        setWakeState('live');
        setState(s => ({ ...s, backendOnline: true, demo: s.demo }));
      } else if (attempts >= max) {
        clearInterval(wakeTimerRef.current);
        setWakeState('degraded');
      }
    }, 2000);
  }

  const sc = SPORTS[state.sport] || SPORTS.downhill;

  const PAGES = {
    overview:       OverviewPage,
    analyze:        AnalyzePage,
    demos:          DemosPage,
    sessions:       SessionsPage,
    review:         SessionReviewPage,
    method:         MethodPage,
    'karting-demo': KartingDemoPage,
  };
  const Page = PAGES[state.page] || OverviewPage;

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#EDEDE8' }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { max-width: 100%; overflow-x: hidden; }
        body { margin: 0; font-family: 'Space Grotesk', sans-serif; background: #080808; }
        body * { min-width: 0; }
        button { outline: none; font-family: inherit; }
        button:focus-visible { outline: 2px solid ${sc.color}; outline-offset: 2px; }
        ::selection { background: ${sc.color}35; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #080808; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
        @media (max-width: 768px) {
          nav {
            height: auto !important;
            min-height: 52px !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            padding: 8px 12px !important;
          }
          nav > div:nth-child(2) {
            order: 3 !important;
            width: 100% !important;
            flex: 1 0 100% !important;
            justify-content: flex-start !important;
            overflow-x: auto !important;
            padding-bottom: 2px !important;
          }
          nav > div:nth-child(2) button {
            flex: 0 0 auto !important;
            padding: 6px 12px !important;
          }
          nav > div:nth-child(3) {
            margin-left: auto !important;
            gap: 5px !important;
          }
          nav > div:nth-child(3) a {
            display: none !important;
          }
        }
      `}</style>

      <Nav state={state} setState={setState} />
      {wakeState !== 'live' && !state.backendOnline && (
        <WakeBar onWake={handleWake} wakeState={wakeState} />
      )}
      <div style={{ paddingTop: wakeState !== 'live' && !state.backendOnline ? 32 : 0 }}>
        <Page state={state} setState={setState} />
      </div>
      <footer style={{
        borderTop: '1px solid #1a1a1a',
        padding: '18px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <a href="https://vectorridgelabs.com/en" target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            textDecoration: 'none', opacity: 0.25, transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.6'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.25'}>
          <svg width="16" height="16" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 22L14 6L22 22" stroke="#EDEDE8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.2 22L14 11.3L17.8 22" stroke="#EDEDE8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.38"/>
          </svg>
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: 9,
            color: '#EDEDE8', letterSpacing: '0.14em',
          }}>
            VECTOR RIDGE LABS
          </span>
        </a>
      </footer>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
