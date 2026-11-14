import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, CloudSun, HeartHandshake, Newspaper, Satellite, ShieldCheck } from 'lucide-react';

import { FeaturePreviews, TelemetryStrip, TuningPanel } from '@/components/LandingExtras';
import { DEFAULT_EARTH, type EarthTuning } from '@/components/landing/earthTuning';
import artemisWordmark from '@/logo/artemis-wordmark-ink.png';
import artemisWordmarkLight from '@/logo/artemis-wordmark-light.png';
import { cn } from '@/lib/utils';

// three.js is large: load the globe as its own chunk after first paint.
const EarthHero = lazy(() => import('@/components/landing/EarthHero'));

interface ArtemisLandingProps {
  onEnterConsole: () => void;
  onOpenAbout: () => void;
  onOpen: (path: string) => void;
  news?: ReactNode;
}

const solutionCards = [
  { icon: Satellite, title: 'Signals arrive fragmented', description: 'Artemis combines MODIS and VIIRS observations into one comparable 26-year record of fire activity.' },
  { icon: CloudSun, title: 'Hotspots lack context', description: 'Select a hotspot to see its 20-year history, current wind, and where its smoke will drift.' },
  { icon: Newspaper, title: 'Response information is scattered', description: 'Satellite signals, field reports and wildfire news sit side by side, so teams see the same picture.' },
  { icon: HeartHandshake, title: 'Relief access is difficult to find', description: 'Every hotspot leads to an action: prevention funds, ground truth, haze warnings or verified relief campaigns.' },
];

const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-[6px] bg-accent-500 px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] text-karhutla-ink shadow-[0_10px_30px_-10px_rgba(158,67,36,0.6)] transition-colors hover:bg-accent-400';
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-[6px] border border-neutral-900/25 px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-neutral-900 transition-colors hover:border-neutral-900/60 hover:bg-white/50';

export function ArtemisLanding({ onEnterConsole, onOpenAbout, onOpen, news }: ArtemisLandingProps) {
  const [activeSolution, setActiveSolution] = useState(0);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [earth, setEarth] = useState<EarthTuning>(DEFAULT_EARTH);
  const tuning = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('tune');
  const onCount = useCallback((n: number) => setLiveCount(n), []);
  const selected = solutionCards[activeSolution];
  const rootRef = useRef<HTMLDivElement>(null);

  // Scroll choreography (GSAP + ScrollTrigger + SplitText) loads as its own chunk once
  // fonts are ready, so line splits match the final type. Content is fully visible
  // without it; reduced motion skips it entirely (handled inside initLandingMotion).
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    Promise.all([import('@/components/landing/landingMotion'), document.fonts?.ready])
      .then(([m]) => {
        if (!cancelled && rootRef.current) cleanup = m.initLandingMotion(rootRef.current);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen overflow-hidden bg-karhutla-paper text-neutral-900">
      <header className="relative z-20 border-b border-neutral-900/10 bg-karhutla-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8">
          <button onClick={onOpenAbout} className="flex items-center gap-3 text-left" aria-label="About Artemis">
            <img src={artemisWordmark} alt="Artemis" width={1200} height={326} className="h-8 w-auto sm:h-9" />
          </button>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
            <button onClick={() => onOpen('/audit')} className="hidden rounded-[6px] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-700 transition-colors hover:text-neutral-950 sm:block">
              EUDR audit
            </button>
            <button onClick={onOpenAbout} className="rounded-[6px] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-700 transition-colors hover:text-neutral-950">
              About
            </button>
            <button onClick={onEnterConsole} className="ml-1 rounded-[6px] bg-karhutla-ink px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-neutral-800">
              Console
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section data-hero className="flow-hero grain relative overflow-hidden">
          <div data-heat aria-hidden className="pointer-events-none absolute inset-0 opacity-0" style={{ background: 'radial-gradient(60% 45% at 70% 100%, rgba(217,131,28,0.75), transparent 70%)' }} />
          <div className="relative z-[2] mx-auto max-w-[1440px] px-5 pt-12 sm:px-8 lg:flex lg:min-h-[50rem] lg:items-center lg:pb-40 lg:pt-10">
            <div className="lg:max-w-[46%]">
              <div data-hero-fade className="mb-5 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700">
                From detection to informed action
              </div>
              <h1 className="font-display text-[1.7rem] font-bold leading-[1.12] text-neutral-950 sm:text-4xl lg:text-[3.1rem] lg:leading-[1.08]">
                <span data-split-hero className="block">Wildfire signals are everywhere.</span>
                <span data-hero-sweep className="display-sweep mt-2 block">Clarity is not.</span>
              </h1>
              <p data-hero-fade className="mt-6 max-w-xl text-base leading-7 text-neutral-700 sm:text-lg sm:leading-8">
                Twenty-six years of NASA fire detections over Indonesia, put on one scale. Artemis shows which months
                are unusual, which places burn again and again, and what anyone can do about a hotspot today.
              </p>
              <div data-hero-fade className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button onClick={onEnterConsole} className={primaryBtn}>
                  Launch command center <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={() => onOpen('/audit')} className={secondaryBtn}>
                  <ShieldCheck className="h-4 w-4" /> Enterprise EUDR audit
                </button>
              </div>
              <div data-hero-fade className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
                <span className="font-display text-lg font-bold tabular-nums text-karhutla-char sm:text-xl">
                  {liveCount === null ? 'Reading the sky…' : liveCount.toLocaleString('en-US')}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-700">
                  {liveCount === null ? 'NASA FIRMS · today' : 'fire detections today · NASA FIRMS · each light on the globe is one'}
                </span>
              </div>
              <div data-hero-fade className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-700">
                <span>NASA FIRMS MODIS + VIIRS · 2000–2026</span>
                <span>Harmonized burning calendar</span>
                <button onClick={onOpenAbout} className="uppercase underline-offset-4 hover:text-neutral-950 hover:underline">How Artemis works</button>
              </div>
            </div>
          </div>

          {/* The 3D moment: Earth sits straight on the page, lit by today's real fire detections,
              its orange atmosphere bleeding into the hero gradient. Below the text on phones,
              cropped by the right edge on desktop. Outer div positions, inner divs animate. */}
          <div aria-hidden className="pointer-events-none relative z-[1] mx-auto -mt-6 mb-[-18%] aspect-square w-[128%] -translate-x-[11%] sm:w-[105%] sm:-translate-x-[2.5%] lg:absolute lg:right-[-13%] lg:top-1/2 lg:m-0 lg:w-[min(70rem,64vw)] lg:-translate-y-[54%] lg:translate-x-0">
            <div data-earth className="absolute inset-0">
              <div data-earth-intro className="absolute inset-0">
                <div className="absolute inset-[4%] rounded-full" style={{ background: 'radial-gradient(circle, rgba(230,148,48,0.55) 30%, rgba(198,116,56,0.22) 52%, transparent 68%)' }} />
                <Suspense fallback={<div className="absolute inset-[24%] rounded-full bg-[radial-gradient(circle_at_40%_35%,#2a1a14,#0b0908_70%)]" />}>
                  <div className="absolute inset-0">
                    <EarthHero tuning={earth} onCount={onCount} />
                  </div>
                </Suspense>
              </div>
            </div>
          </div>
        </section>

        <TelemetryStrip />
        <FeaturePreviews onOpen={onOpen} />

        <section className="flow-solves grain relative">
          <div data-heat aria-hidden className="pointer-events-none absolute inset-0 opacity-0" style={{ background: 'radial-gradient(70% 40% at 30% 100%, rgba(230,148,48,0.7), transparent 70%)' }} />
          <div className="relative z-[2] mx-auto max-w-[1440px] px-5 pb-28 pt-14 sm:px-8 lg:pb-36 lg:pt-20">
            <div className="mb-8">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-700">What Artemis solves</div>
              <h2 data-split className="mt-3 max-w-4xl font-display text-2xl font-bold leading-[1.15] text-neutral-950 sm:text-4xl">A connected picture for wildfire response</h2>
            </div>
            <div data-reveal className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="grid gap-px overflow-hidden rounded-[6px] border border-neutral-900/15 bg-neutral-900/15 sm:grid-cols-2">
                {solutionCards.map(({ icon: Icon, title }, index) => (
                  <button
                    key={title}
                    onClick={() => setActiveSolution(index)}
                    aria-pressed={activeSolution === index}
                    className={cn('group min-h-32 p-5 text-left transition-colors', activeSolution === index ? 'bg-white' : 'bg-karhutla-paper hover:bg-white/70')}
                  >
                    <Icon className={cn('h-5 w-5', activeSolution === index ? 'text-neutral-950' : 'text-neutral-600 group-hover:text-neutral-900')} />
                    <h3 className="mt-5 font-semibold text-neutral-900">{title}</h3>
                    <span className="mt-2 block font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-600">
                      {activeSolution === index ? 'Selected' : 'Explore'}
                    </span>
                  </button>
                ))}
              </div>
              {/* Fluted glass over the thermal gradient. */}
              <div className="thermal-gradient grain relative overflow-hidden rounded-[6px]">
                <div className="fluted-glass relative z-[2] flex h-full flex-col justify-between p-6 sm:p-8">
                  <div className="rounded-[4px] bg-karhutla-paper/85 p-5 backdrop-blur-sm sm:p-6">
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-700">Why it matters</div>
                    <h3 key={selected.title} className="tab-panel-in mt-3 font-display text-lg font-bold leading-snug text-neutral-950 sm:text-xl">{selected.title}</h3>
                    <p key={`${selected.title}-d`} className="tab-panel-in mt-3 max-w-xl text-sm leading-7 text-neutral-800">{selected.description}</p>
                  </div>
                  <div className="mt-6 grid gap-2 sm:grid-cols-3">
                    {['Observe', 'Contextualize', 'Respond'].map((step, index) => (
                      <div key={step} className="rounded-[4px] bg-black/35 p-3 backdrop-blur-sm">
                        <div className="font-mono text-[9px] text-white/75">0{index + 1}</div>
                        <div className="mt-2 text-xs font-medium text-white">{step}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {news && (
          <section aria-labelledby="field-reporting" className="flow-news grain relative text-white">
            <div className="relative z-[2] mx-auto max-w-[1440px] px-5 pb-20 pt-6 sm:px-8 lg:pb-28">
              <div className="mb-8">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-karhutla-smoke/80">Field reporting</div>
                <h2 data-split id="field-reporting" className="mt-3 font-display text-2xl font-bold text-karhutla-smoke sm:text-4xl">Wildfire news</h2>
              </div>
              <div data-reveal>{news}</div>
            </div>
          </section>
        )}
      </main>

      <footer className="grain relative bg-karhutla-smoke">
        <div className="relative z-[2] mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <img src={artemisWordmarkLight} alt="Artemis" width={1200} height={326} className="h-6 w-auto self-start object-contain opacity-85 sm:self-auto" />
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/60">NASA Space Apps 2026 · ITS Surabaya</p>
        <button onClick={onEnterConsole} className="inline-flex items-center gap-2 self-start font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-300 underline-offset-4 hover:underline sm:self-auto">
          Open live console <ArrowRight className="h-3.5 w-3.5" />
        </button>
        </div>
      </footer>

      {tuning && <TuningPanel earth={earth} onEarth={setEarth} />}
    </div>
  );
}
