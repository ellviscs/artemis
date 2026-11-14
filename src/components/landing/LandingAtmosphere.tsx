// Landing-only atmosphere on one fixed, viewport-sized 2D canvas (cheap at any page height):
//  - Embers rise from the footer and thin out upward until "02 Inside Artemis"
//    (from the element marked [data-embers-from] to the bottom of the page).
//  - A faint yellow smoke trail follows the cursor, in the hero only (user request: very low-key).
// Purely decorative. Fine pointers only for the smoke; nothing under reduced motion.
// data-html2canvas-ignore keeps it out of the liquid-glass snapshot.
import { useEffect, useRef } from 'react';

interface Ember {
  x: number;
  y: number; // document coordinates
  vy: number;
  r: number;
  sway: number;
  phase: number;
  age: number;
  life: number;
  hue: number;
}

interface Puff {
  x: number;
  y: number; // document coordinates, so smoke stays where it was left while scrolling
  vx: number;
  vy: number;
  r0: number;
  r1: number;
  age: number;
  life: number;
  tone: number;
}

const MAX_PUFFS = 180;
const PUFF_SPACING = 12;

export function LandingAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    let vw = 0;
    let vh = 0;
    let top = 0; // document y where embers end (top of section 02)
    let bottom = 0; // document height
    let embers: Ember[] = [];
    const puffs: Puff[] = [];
    let last = performance.now();
    let raf = 0;
    let lastPt: { x: number; y: number } | null = null;

    const measure = () => {
      const from = document.querySelector('[data-embers-from]');
      top = from ? from.getBoundingClientRect().top + window.scrollY : 0;
      bottom = document.documentElement.scrollHeight;
    };

    // Denser near the footer, thinning toward section 02.
    const spawn = (ember?: Ember, fresh = false): Ember => {
      const h = Math.max(1, bottom - top);
      const e = ember ?? ({} as Ember);
      e.x = Math.random() * vw;
      e.y = top + h * (1 - Math.pow(Math.random(), 1.7));
      e.vy = 16 + Math.random() * 36;
      e.r = 0.6 + Math.random() * 1.7;
      e.sway = 6 + Math.random() * 20;
      e.phase = Math.random() * Math.PI * 2;
      e.life = 6 + Math.random() * 10;
      e.age = fresh ? Math.random() * e.life : 0;
      e.hue = 20 + Math.random() * 20;
      return e;
    };

    const resize = () => {
      const dpr = Math.min(1.75, window.devicePixelRatio || 1);
      vw = window.innerWidth;
      vh = window.innerHeight;
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      measure();
      const target = Math.round(((bottom - top) * vw) / 22000);
      embers = Array.from({ length: Math.max(60, Math.min(320, target)) }, () => spawn(undefined, true));
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
      // Hero only: outside it the trail stops (puffs already drawn fade out on their own).
      const hero = document.querySelector('[data-hero]')?.getBoundingClientRect();
      if (!hero || ev.clientY < hero.top || ev.clientY > hero.bottom) {
        lastPt = null;
        return;
      }
      const p = { x: ev.clientX, y: ev.clientY + window.scrollY };
      const from = lastPt ?? p;
      const dist = Math.hypot(p.x - from.x, p.y - from.y);
      const steps = Math.min(16, Math.max(1, Math.floor(dist / PUFF_SPACING)));
      for (let i = 1; i <= steps; i++) {
        if (puffs.length >= MAX_PUFFS) puffs.shift();
        const t = i / steps;
        puffs.push({
          x: from.x + (p.x - from.x) * t + (Math.random() - 0.5) * 6,
          y: from.y + (p.y - from.y) * t + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 14,
          vy: -10 - Math.random() * 16,
          r0: 8 + Math.random() * 6,
          r1: 30 + Math.random() * 22,
          age: 0,
          life: 1.3 + Math.random() * 1.1,
          tone: Math.random(),
        });
      }
      lastPt = p;
    };
    const onLeave = () => (lastPt = null);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sy = window.scrollY;
      ctx.clearRect(0, 0, vw, vh);

      // Smoke first, so embers glow through it. Added light, so it reads as a faint glow on the dark hero.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.age += dt;
        if (p.age >= p.life) {
          puffs.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
        const t = p.age / p.life;
        const r = p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - t, 2));
        const a = Math.sin(Math.PI * Math.min(1, t * 1.6 + 0.08)) * (1 - t) * 0.06;
        const y = p.y - sy;
        if (y < -r || y > vh + r) continue;
        // Pale yellow, a touch warmer on some puffs.
        const g = ctx.createRadialGradient(p.x, y, 0, p.x, y, r);
        const c = p.tone > 0.5 ? '255,226,140' : '255,200,96';
        g.addColorStop(0, `rgba(${c},${a})`);
        g.addColorStop(0.5, `rgba(${c},${a * 0.45})`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Embers, only where the range overlaps the viewport.
      if (sy + vh > top && sy < bottom) {
        ctx.globalCompositeOperation = 'lighter';
        const span = Math.max(1, bottom - top);
        for (const e of embers) {
          e.age += dt;
          e.y -= e.vy * dt;
          e.phase += dt * 0.9;
          if (e.age >= e.life || e.y < top) {
            spawn(e);
            continue;
          }
          const y = e.y - sy;
          if (y < -10 || y > vh + 10) continue;
          const x = e.x + Math.sin(e.phase) * e.sway;
          const lifeT = e.age / e.life;
          // Fade in and out over the ember's life, and thin out toward section 02.
          const depth = Math.min(1, ((e.y - top) / span) * 5);
          const a = Math.sin(Math.PI * lifeT) * depth * (0.6 + 0.4 * Math.sin(e.phase * 5));
          if (a <= 0.01) continue;
          const rr = e.r * 4;
          const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
          g.addColorStop(0, `hsla(${e.hue},100%,70%,${a})`);
          g.addColorStop(0.35, `hsla(${e.hue},95%,52%,${a * 0.5})`);
          g.addColorStop(1, `hsla(${e.hue},90%,42%,0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, rr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const onVis = () => (document.visibilityState === 'visible' ? start() : cancelAnimationFrame(raf));

    resize();
    start();
    window.addEventListener('resize', resize);
    // Late content (news, charts) changes the page height: re-measure the ember range.
    const ro = new ResizeObserver(() => measure());
    ro.observe(document.body);
    document.addEventListener('visibilitychange', onVis);
    if (finePointer) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden data-html2canvas-ignore className="pointer-events-none fixed inset-0 z-[15] h-full w-full" />;
}
