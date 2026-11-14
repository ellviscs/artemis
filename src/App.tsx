import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AuditPage } from '@/pages/AuditPage';
import { ImpactPage } from '@/pages/ImpactPage';
import { cn } from '@/lib/utils';

const EXIT_MS = 320;
const ENTER_MS = 760;

/**
 * Page transitions: on a path change the old page lifts and blurs out under a wisp of
 * ember smoke, then the new page rises in as the smoke clears. Query-string changes
 * (the dashboard syncs its filters to the URL) swap instantly.
 */
function TransitionRoutes() {
  const location = useLocation();
  const [shown, setShown] = useState<Location>(location);
  const [stage, setStage] = useState<'idle' | 'exit' | 'enter'>('idle');

  useEffect(() => {
    if (location.pathname === shown.pathname) {
      if (location !== shown) setShown(location);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(location);
      return;
    }
    setStage('exit');
    const t = window.setTimeout(() => {
      setShown(location);
      setStage('enter');
      window.scrollTo(0, 0);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [location, shown]);

  useEffect(() => {
    if (stage !== 'enter') return;
    const t = window.setTimeout(() => setStage('idle'), ENTER_MS);
    return () => window.clearTimeout(t);
  }, [stage]);

  return (
    <>
      {/* The animation class is removed when idle: a transformed ancestor would break position: fixed modals. */}
      <div className={cn(stage !== 'idle' && 'page-stage', stage === 'exit' && 'is-exiting')}>
        <Routes location={shown}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/impact" element={<ImpactPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {stage !== 'idle' && <div aria-hidden className={cn('smoke-veil', stage === 'exit' ? 'is-exiting' : 'is-entering')} />}
    </>
  );
}

function App() {
  return <TransitionRoutes />;
}

export default App;
