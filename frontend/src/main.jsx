import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { SPORTS, Nav } from './core.jsx';
import { OverviewPage, AnalyzePage, SessionsPage, MethodPage } from './pages.jsx';
import { SessionReviewPage } from './review.jsx';
import { LivePage } from './live.jsx';
import { KartingDemoPage } from './karting.jsx';
import { checkHealth } from './api.js';

const STORAGE_KEY = 'drcoach-v2';

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
      return {
        sport: s.sport || 'downhill',
        page: s.page || 'overview',
        lang: s.lang || 'en',
        demo: s.demo !== undefined ? s.demo : true,
        reviewSessionId: null,
        backendOnline: false,
      };
    } catch {
      return { sport: 'downhill', page: 'overview', lang: 'en', demo: true, reviewSessionId: null, backendOnline: false };
    }
  });
  const [wakeState, setWakeState] = useState('sleeping'); // sleeping | waking | degraded
  const wakeTimerRef = useRef(null);

  // Persist nav state (exclude transient fields)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sport: state.sport,
      page: state.page,
      lang: state.lang,
      demo: state.demo,
    }));
  }, [state.sport, state.page, state.lang, state.demo]);

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
    overview:      OverviewPage,
    analyze:       AnalyzePage,
    live:          LivePage,
    sessions:      SessionsPage,
    review:        SessionReviewPage,
    method:        MethodPage,
    'karting-demo': KartingDemoPage,
  };
  const Page = PAGES[state.page] || OverviewPage;

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#EDEDE8' }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; font-family: 'Space Grotesk', sans-serif; background: #080808; }
        button { outline: none; font-family: inherit; }
        button:focus-visible { outline: 2px solid ${sc.color}; outline-offset: 2px; }
        ::selection { background: ${sc.color}35; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #080808; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
        @media (max-width: 768px) {
          nav { padding: 0 12px !important; }
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
root.render(<App />);
