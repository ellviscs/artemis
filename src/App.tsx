import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { cn } from '@/lib/utils';

// The app routes (Leaflet, H3, satellite.js, audit and hub code) load as their own chunks,
// so the landing page does not download them. Each import starts as the smoke veil rises
// (and the dashboard's on idle after landing), so the chunk is usually ready by the time
// the veil clears.
const loaders = {
  '/dashboard': () => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
  '/audit': () => import('@/pages/AuditPage').then((m) => ({ default: m.AuditPage })),
  '/impact': () => import('@/pages/ImpactPage').then((m) => ({ default: m.ImpactPage })),
} as const;
const DashboardPage = lazy(loaders['/dashboard']);
const AuditPage = lazy(loaders['/audit']);
const ImpactPage = lazy(loaders['/impact']);
const preload = (path: string) => (loaders as Record<string, (() => Promise<unknown>) | undefined>)[path]?.().catch(() => undefined);

function RouteFallback() {
  return <div className="min-h-screen bg-[#0a0a0a]" aria-busy="true" aria-label="Loading" />;
}

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

  // Warm the dashboard chunk once the landing page is idle.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    idle(() => preload('/dashboard'));
  }, []);

  useEffect(() => {
    if (location.pathname === shown.pathname) {
      if (location !== shown) setShown(location);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(location);
      return;
    }
    preload(location.pathname);
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
        <Suspense fallback={<RouteFallback />}>
          <Routes location={shown}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/impact" element={<ImpactPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
      {stage !== 'idle' && <div aria-hidden className={cn('smoke-veil', stage === 'exit' ? 'is-exiting' : 'is-entering')} />}
    </>
  );
}

function App() {
  return <TransitionRoutes />;
}

export default App;
