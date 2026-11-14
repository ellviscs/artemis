// Landing footer: brand block and link columns over a darkened Kalimantan rainforest
// (photo supplied by the team), warmed toward the KARHUTLA oranges, with drifting smoke
// and embers, and a giant "ALL EYES ON KARHUTLA" set into the bottom edge.
import { ArrowRight, ArrowUpRight } from 'lucide-react';

import artemisWordmarkLight from '@/logo/artemis-wordmark-light.png';
import { EmberField } from '@/components/landing/EmberField';

/**
 * Team members, shown under "Team". Fill in names and roles when the team sends them;
 * while empty, only the team name is shown (no placeholder text on the public page).
 */
const TEAM: { name: string; role: string }[] = [];

interface Props {
  onEnterConsole: () => void;
  onOpenAbout: () => void;
  onOpen: (path: string) => void;
}

const linkCls = 'text-[15px] text-white/80 transition-colors hover:text-white';

export function LandingFooter({ onEnterConsole, onOpenAbout, onOpen }: Props) {
  const year = new Date().getFullYear();
  const explore: [string, () => void][] = [
    ['Home', () => window.scrollTo({ top: 0, behavior: 'smooth' })],
    ['Command center', onEnterConsole],
    ['EUDR audit', () => onOpen('/audit')],
    ['Impact hub', () => onOpen('/impact?lat=-2.2100&lng=113.9200')],
    ['How Artemis works', onOpenAbout],
  ];
  const data: [string, string][] = [
    ['NASA FIRMS', 'https://firms.modaps.eosdis.nasa.gov/'],
    ['MODIS C6.1 · VIIRS 375 m', 'https://www.earthdata.nasa.gov/data/tools/firms'],
    ['Black Marble (Earth at night)', 'https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/'],
    ['OpenStreetMap', 'https://www.openstreetmap.org/copyright'],
  ];

  return (
    <footer className="relative isolate overflow-hidden bg-karhutla-smoke text-white">
      {/* Kalimantan rainforest, darkened and warmed so it reads as smoke-hazed forest at dusk. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <img
          src="/footer-kalimantan.webp"
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-x-0 bottom-0 h-[78%] w-full object-cover object-[50%_35%]"
          style={{ filter: 'brightness(0.5) saturate(0.75) sepia(0.45) contrast(1.05)' }}
        />
        {/* Ember wash, then blend the top into the news section's smoke. */}
        <div className="absolute inset-0 mix-blend-color" style={{ background: 'linear-gradient(180deg, rgba(158,67,36,0.55), rgba(198,116,56,0.45) 55%, rgba(97,44,37,0.6))' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #1a1210 0%, rgba(26,18,16,0.92) 28%, rgba(26,18,16,0.35) 55%, rgba(26,18,16,0.15) 72%, rgba(26,18,16,0.7) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 45% at 70% 70%, rgba(230,148,48,0.28), transparent 70%)' }} />
      </div>
      <EmberField density={0.6} sparks={false} className="-z-[5]" />
      <div aria-hidden className="footer-smoke -z-[4]" />

      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 pb-10 pt-20 sm:px-8 lg:grid-cols-[1.25fr_0.75fr_0.75fr_0.85fr] lg:gap-10 lg:pt-28">
        <div className="max-w-md">
          <img src={artemisWordmarkLight} alt="Artemis" width={1200} height={326} className="h-9 w-auto object-contain" />
          <p className="mt-6 font-display text-lg font-bold leading-snug">Fire intelligence for Indonesia</p>
          <p className="mt-3 text-[15px] leading-7 text-white/75">
            Twenty-six years of NASA MODIS and VIIRS fire detections on one scale: a burning calendar, hotspot
            forensics, an EUDR audit and an impact hub that turns every hotspot into an action.
          </p>
          <button
            type="button"
            onClick={onEnterConsole}
            className="mt-7 inline-flex items-center gap-2 rounded-[6px] bg-accent-500 px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] text-karhutla-smoke transition-colors hover:bg-accent-400"
          >
            Launch command center <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-8 text-[13px] text-white/60">© {year} Artemis · NASA Space Apps Challenge 2026</p>
          <p className="mt-2 text-[13px] text-white/75">
            Built by <strong className="font-semibold text-white">Team ITS Surabaya</strong>
          </p>
        </div>

        <nav aria-label="Explore">
          <h2 className="font-semibold text-white">Explore</h2>
          <ul className="mt-5 space-y-3.5">
            {explore.map(([label, go]) => (
              <li key={label}><button type="button" onClick={go} className={linkCls}>{label}</button></li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Data sources">
          <h2 className="font-semibold text-white">Data</h2>
          <ul className="mt-5 space-y-3.5">
            {data.map(([label, href]) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer" className={`${linkCls} inline-flex items-center gap-1`}>
                  {label} <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="footer-team">
          <h2 id="footer-team" className="font-semibold text-white">Team</h2>
          <ul className="mt-5 space-y-3.5">
            <li className="text-[15px] text-white/80">Team ITS Surabaya</li>
            <li className="text-[15px] text-white/80">Institut Teknologi Sepuluh Nopember</li>
            {TEAM.map((m) => (
              <li key={m.name} className="text-[15px] text-white/80">
                {m.name} <span className="text-white/55">· {m.role}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* The giant line, set into the bottom edge and fading into the forest like the reference. */}
      <div aria-hidden className="footer-mega pointer-events-none mx-auto max-w-[1600px] select-none px-3 sm:px-6">
        <div className="pl-[0.4vw] font-display text-[min(4.2vw,70px)] font-bold leading-none tracking-[0.02em] text-[#efe7dc]/85">All eyes on</div>
        <div className="-mb-[min(2.4vw,40px)] font-display text-[min(12.6vw,210px)] font-bold leading-[0.92] text-[#efe7dc]/90">Karhutla</div>
      </div>
      <p className="sr-only">All eyes on Karhutla.</p>
    </footer>
  );
}
