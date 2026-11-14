// Landing scroll choreography. Loaded as its own chunk by ArtemisLanding, so GSAP never
// reaches the dashboard bundle.
//
// Markers in the landing markup:
//   [data-hero]          hero section; scroll range for the globe hand-off
//   [data-split-hero]    hero headline line(s): masked line reveal on load
//   [data-hero-sweep]    the ember-sweep line: wipes up after the headline
//   [data-hero-fade]     hero copy, buttons and stats: staggered fade-up on load
//   [data-earth-intro]   globe: scales in on load
//   [data-earth]         globe: sinks, shrinks and dims into the ticker as you scroll
//   [data-heat]          overlay that warms its section while it crosses the viewport
//   [data-split]         section titles: masked line reveal each time they enter
//   [data-reveal]        blocks that fade up each time they enter (batched)
//   [data-rule]          section border: its hairline draws in and labels fade as it arrives
//
// Smooth scrolling: Lenis (inertial, on native scroll, so position: fixed and the
// liquid-glass snapshot stay correct) drives ScrollTrigger through the GSAP ticker.
// Desktop pointers only; touch keeps native scrolling. Off under reduced motion.
//
// Nothing is pinned or scroll-jacked. Everything is visible without this module, and
// prefers-reduced-motion skips it (gsap.matchMedia reverts all of it on change).
// The liquid-glass cards are deliberately not animated: their refraction comes from a
// one-time page snapshot, so moving them would misalign the glass.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

export function initLandingMotion(root: HTMLElement): () => void {
  const q = gsap.utils.selector(root);
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const splits: SplitText[] = [];

    // ── Smooth scroll ────────────────────────────────────────────────────────
    let lenis: Lenis | null = null;
    const lenisTick = (time: number) => lenis?.raf(time * 1000);
    if (window.matchMedia('(pointer: fine)').matches) {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(lenisTick);
      gsap.ticker.lagSmoothing(0);
    }

    // ── Hero entrance ─────────────────────────────────────────────────────────
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.15 });
    intro.from(q('[data-earth-intro]'), { autoAlpha: 0, yPercent: 18, duration: 2.2, ease: 'power3.out' }, 0);
    q('[data-split-hero]').forEach((el) => {
      splits.push(
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          // Standalone tween: autoSplit re-runs this after layout changes, and a tween added to the
          // finished intro timeline would never play (lines stayed hidden).
          onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1, stagger: 0.09, ease: 'power3.out', delay: 0.25 }),
        }),
      );
    });
    intro.from(q('[data-hero-sweep]'), { clipPath: 'inset(0 0 100% 0)', yPercent: 30, duration: 0.9 }, 0.45);
    intro.from(q('[data-hero-fade]'), { autoAlpha: 0, y: 18, duration: 0.8, stagger: 0.07 }, 0.55);

    // ── Globe hands off into the ticker ───────────────────────────────────────
    const hero = q('[data-hero]')[0];
    if (hero) {
      gsap.to(q('[data-earth]'), {
        yPercent: 14,
        autoAlpha: 0.45,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.8 },
      });
    }

    // ── Sections warm up as they pass ─────────────────────────────────────────
    q('[data-heat]').forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top 70%', end: 'bottom 30%', scrub: true },
      });
    });

    // ── Section titles: masked line reveal ────────────────────────────────────
    q('[data-split]').forEach((el) => {
      splits.push(
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 110,
              duration: 0.95,
              stagger: 0.09,
              ease: 'power3.out',
              // Replays each time the title scrolls back in, from above or below.
              scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom top', toggleActions: 'play reset play reset' },
            }),
        }),
      );
    });

    // ── Section borders: the hairline draws across as the section arrives ─────
    q('[data-rule]').forEach((rule) => {
      gsap
        .timeline({ scrollTrigger: { trigger: rule, start: 'top 92%', end: 'top 62%', scrub: 0.6 } })
        .fromTo(rule.querySelector('[data-rule-line]'), { scaleX: 0 }, { scaleX: 1, ease: 'none' }, 0)
        .fromTo(rule.querySelectorAll('[data-rule-text]'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, ease: 'power2.out', stagger: 0.15 }, 0);
    });

    // ── Blocks: batched fade-up ───────────────────────────────────────────────
    const blocks = q('[data-reveal]');
    gsap.set(blocks, { autoAlpha: 0, y: 32 });
    // Replays on every entry; resets only once the block is fully off screen.
    const show = (els: Element[]) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.12, ease: 'expo.out', overwrite: true });
    const hide = (els: Element[]) => gsap.set(els, { autoAlpha: 0, y: 32, overwrite: true });
    ScrollTrigger.batch(blocks, {
      start: 'top 94%',
      end: 'bottom top',
      onEnter: show,
      onEnterBack: show,
      onLeave: hide,
      onLeaveBack: hide,
    });

    // Late content (news, live counts) changes the page height: re-measure triggers.
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    });
    ro.observe(root);

    return () => {
      gsap.ticker.remove(lenisTick);
      lenis?.destroy();
      ro.disconnect();
      cancelAnimationFrame(raf);
      splits.forEach((s) => s.revert());
    };
  });

  return () => mm.revert();
}
