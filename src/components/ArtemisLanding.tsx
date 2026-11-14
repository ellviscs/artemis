import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import { ArrowRight, CloudSun, HeartHandshake, Newspaper, Satellite, ShieldCheck } from 'lucide-react';

import { FeaturePreviews, TelemetryStrip, TuningPanel } from '@/components/LandingExtras';
import { DEFAULT_EARTH, type EarthTuning } from '@/components/landing/earthTuning';
import artemisWordmark from '@/logo/artemis-wordmark-ink.png';
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

  return (
    <div className="min-h-screen overflow-hidden bg-karhutla-paper text-neutral-900">
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
        <section className="grain relative">
          {/* A faint thermal haze behind the globe window. */}
          <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[42rem] w-[42rem] rounded-full opacity-70 blur-3xl" style={{ background: 'radial-gradient(circle, rgba(230,148,48,0.45), rgba(198,116,56,0.18) 45%, transparent 70%)' }} />
          <div className="relative z-[2] mx-auto grid max-w-[1440px] gap-10 px-5 pb-14 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.95fr)] lg:items-center lg:gap-14 lg:pb-20 lg:pt-16">
            <div>
              <div className="mb-5 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700">
                From detection to informed action
              </div>
              <h1 className="max-w-3xl font-display text-5xl leading-[0.98] tracking-[-0.01em] text-neutral-950 sm:text-7xl">
                Wildfire signals are everywhere.
                <span
                  className="block bg-clip-text italic text-transparent"
                  style={{ backgroundImage: 'linear-gradient(100deg, #c67438 0%, #9e4324 55%, #612c25 100%)' }}
                >
                  Clarity is not.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-neutral-700 sm:text-lg sm:leading-8">
                Twenty-six years of NASA fire detections over Indonesia, put on one scale. Artemis shows which months
                are unusual, which places burn again and again, and what anyone can do about a hotspot today.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button onClick={onEnterConsole} className={primaryBtn}>
                  Launch command center <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={() => onOpen('/audit')} className={secondaryBtn}>
                  <ShieldCheck className="h-4 w-4" /> Enterprise EUDR audit
                </button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-700">
                <span>NASA FIRMS MODIS + VIIRS · 2000–2026</span>
                <span>Harmonized burning calendar</span>
                <button onClick={onOpenAbout} className="uppercase underline-offset-4 hover:text-neutral-950 hover:underline">How Artemis works</button>
              </div>
            </div>

            {/* The 3D moment: a dark window onto Earth, lit by today's real fire detections. */}
            <div className="relative aspect-square w-full overflow-hidden rounded-[6px] bg-[#0b0908] shadow-[0_40px_90px_-30px_rgba(97,44,37,0.65)] ring-1 ring-black/40 lg:aspect-[1/1.02]">
              <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(70% 60% at 50% 60%, rgba(198,116,56,0.22), transparent 70%)' }} />
              <Suspense fallback={<div aria-hidden className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_40%_35%,#2a1a14,#0b0908_70%)] shadow-[0_0_80px_rgba(230,148,48,0.35)]" />}>
                <div className="absolute inset-0">
                  <EarthHero tuning={earth} onCount={onCount} />
                </div>
              </Suspense>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12 sm:p-5">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">NASA FIRMS · today</div>
                  <div className="mt-1 font-display text-2xl text-white sm:text-3xl">
                    {liveCount === null ? 'Reading the sky…' : `${liveCount.toLocaleString()} fire detections`}
                  </div>
                </div>
                <div className="hidden text-right font-mono text-[10px] uppercase leading-4 tracking-[0.12em] text-white/60 sm:block">
                  Each light is a<br />real detection
                </div>
              </div>
            </div>
          </div>
        </section>

        <TelemetryStrip />
        <FeaturePreviews onOpen={onOpen} />

        <section className="grain relative">
          <div className="relative z-[2] mx-auto max-w-[1440px] px-5 py-14 sm:px-8 lg:py-20">
            <div className="mb-8">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-700">What Artemis solves</div>
              <h2 className="mt-2 font-display text-4xl leading-[1.05] text-neutral-950 sm:text-5xl">A connected picture for wildfire response</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
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
                    <h3 key={selected.title} className="tab-panel-in mt-3 font-display text-3xl leading-tight text-neutral-950">{selected.title}</h3>
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
          <section aria-labelledby="field-reporting" className="bg-karhutla-ink text-white">
            <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8">
              <div className="mb-6">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Field reporting</div>
                <h2 id="field-reporting" className="mt-2 font-display text-4xl text-white">Wildfire news</h2>
              </div>
              {news}
            </div>
          </section>
        )}
      </main>

      <footer className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <img src={artemisWordmark} alt="Artemis" width={1200} height={326} className="h-6 w-auto opacity-80" />
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-700">NASA Space Apps 2026 · ITS Surabaya</p>
        <button onClick={onEnterConsole} className="inline-flex items-center gap-2 self-start font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-900 underline-offset-4 hover:underline sm:self-auto">
          Open live console <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </footer>

      {tuning && <TuningPanel earth={earth} onEarth={setEarth} />}
    </div>
  );
}
