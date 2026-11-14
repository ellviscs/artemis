// Decorative background for dark/orange landing sections: embers drifting upward on a
// canvas, with soft smoke plumes (CSS) behind them. Purely atmospheric, not data.
// Pauses when off screen or the tab is hidden; renders nothing under reduced motion.
import { useEffect, useRef } from 'react';

interface Ember {
  x: number;
  y: number;
  r: number;
  vy: number;
  sway: number;
  phase: number;
  life: number;
  hue: number;
}

/** sparks=false keeps only the smoke plumes (the page-wide LandingAtmosphere draws the embers). */
export function EmberField({ density = 1, className = '', sparks = true }: { density?: number; className?: string; sparks?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!sparks || !canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let embers: Ember[] = [];
    let raf = 0;
    let running = false;
    let last = performance.now();

    const spawn = (anywhere: boolean): Ember => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      r: 0.6 + Math.random() * 1.8,
      vy: 14 + Math.random() * 34,
      sway: 6 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
      life: Math.random(),
      hue: 22 + Math.random() * 18,
    });

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round((w * h) / 16000 * density);
      embers = Array.from({ length: Math.min(160, Math.max(24, target)) }, () => spawn(true));
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        e.y -= e.vy * dt;
        e.phase += dt * 0.9;
        e.life += dt * 0.12;
        const x = e.x + Math.sin(e.phase) * e.sway;
        // Fade in near the bottom, out near the top.
        const t = 1 - e.y / h;
        const alpha = Math.max(0, Math.min(1, t * 4) * (1 - t) * (0.55 + 0.45 * Math.sin(e.life * 6)));
        const g = ctx.createRadialGradient(x, e.y, 0, x, e.y, e.r * 4);
        g.addColorStop(0, `hsla(${e.hue}, 100%, 72%, ${alpha})`);
        g.addColorStop(0.35, `hsla(${e.hue}, 95%, 55%, ${alpha * 0.5})`);
        g.addColorStop(1, `hsla(${e.hue}, 90%, 45%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, e.y, e.r * 4, 0, Math.PI * 2);
        ctx.fill();
        if (e.y < -10) Object.assign(e, spawn(false));
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    let onScreen = false;
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen && document.visibilityState === 'visible') start();
      else stop();
    });
    io.observe(canvas);
    const onVis = () => (onScreen && document.visibilityState === 'visible' ? start() : stop());
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [density, sparks]);

  return (
    <div aria-hidden data-html2canvas-ignore className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="smoke-plume smoke-plume-a" />
      <div className="smoke-plume smoke-plume-b" />
      <div className="smoke-plume smoke-plume-c" />
      {sparks && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />}
    </div>
  );
}
