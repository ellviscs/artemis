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
//   [data-split]         section titles: masked line reveal when they enter
//   [data-reveal]        blocks that fade up when they enter (batched)
//
// Nothing is pinned or scroll-jacked. Everything is visible without this module, and
// prefers-reduced-motion skips it (gsap.matchMedia reverts all of it on change).
// The liquid-glass cards are deliberately not animated: their refraction comes from a
// one-time page snapshot, so moving them would misalign the glass.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

export function initLandingMotion(root: HTMLElement): () => void {
  const q = gsap.utils.selector(root);
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const splits: SplitText[] = [];

    // ── Hero entrance ─────────────────────────────────────────────────────────
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.15 });
    intro.from(q('[data-earth-intro]'), { autoAlpha: 0, scale: 0.86, duration: 1.8, ease: 'power2.out' }, 0);
    q('[data-split-hero]').forEach((el) => {
      splits.push(
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) => intro.from(self.lines, { yPercent: 110, duration: 1, stagger: 0.09 }, 0.1),
        }),
      );
    });
    intro.from(q('[data-hero-sweep]'), { clipPath: 'inset(0 0 100% 0)', yPercent: 30, duration: 0.9 }, 0.45);
    intro.from(q('[data-hero-fade]'), { autoAlpha: 0, y: 18, duration: 0.8, stagger: 0.07 }, 0.55);

    // ── Globe hands off into the ticker ───────────────────────────────────────
    const hero = q('[data-hero]')[0];
    if (hero) {
      gsap.to(q('[data-earth]'), {
        yPercent: 16,
        scale: 0.84,
        rotate: -4,
        autoAlpha: 0.35,
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
              scrollTrigger: { trigger: el, start: 'top 85%', once: true },
            }),
        }),
      );
    });

    // ── Blocks: batched fade-up ───────────────────────────────────────────────
    const blocks = q('[data-reveal]');
    gsap.set(blocks, { autoAlpha: 0, y: 32 });
    ScrollTrigger.batch(blocks, {
      start: 'top 88%',
      once: true,
      onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', overwrite: true }),
    });

    // Late content (news, live counts) changes the page height: re-measure triggers.
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    });
    ro.observe(root);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      splits.forEach((s) => s.revert());
    };
  });

  return () => mm.revert();
}
