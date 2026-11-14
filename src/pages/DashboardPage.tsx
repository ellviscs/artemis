import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Flame, ExternalLink, Database } from 'lucide-react';
import artemisWordmark from '@/logo/artemis-wordmark-light.png';

import {
  createLiveDailySummary,
  createLiveEarlyWarning,
  fetchLiveFirmsData,
  type LiveFireData,
} from '@/data/firmsApi';
import type { FireHotspot } from '@/types';
import { aoiContains, aoiToRegion, archiveCell, encodeAoi, type Aoi } from '@/lib/aoi';
import { FiltersProvider, useFilters } from '@/state/filters';
import { ControlBar } from '@/components/ControlBar';
import { BurningCalendar } from '@/components/BurningCalendar';

import { ArchiveMapLayers } from '@/components/ArchiveMapLayers';
import { HotspotInspector, type InspectTarget } from '@/components/HotspotInspector';
import { MONTH_LABELS } from '@/data/historyApi';
import { currentYearMonth, ymKey } from '@/state/yearMonth';
import { LiveEarlyWarningPanel } from '@/components/LiveEarlyWarningPanel';
import { FireMap } from '@/components/FireMap';
import { AboutModal } from '@/components/AboutModal';
import { ImpactHub } from '@/components/impact/ImpactHub';
import { HazeConeLayer } from '@/components/impact/HazeConeLayer';
import type { HazeConeGeometry } from '@/lib/hazeCone';
import type { Map as LeafletMap } from 'leaflet';

export function DashboardPage() {
  return (
    <FiltersProvider>
      <Dashboard />
    </FiltersProvider>
  );
}

function Dashboard() {
  const { aoi, setFilters, drawMode, setDrawMode, focus } = useFilters();
  const region = useMemo(() => aoiToRegion(aoi), [aoi]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [liveData, setLiveData] = useState<LiveFireData | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [, setCurrentLocation] = useState('Indonesia');
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLiveFirmsData()
      .then((data) => {
        if (!cancelled) {
          setLiveData(data);
          setLiveError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLiveError(error instanceof Error ? error.message : 'Unable to load NASA FIRMS data.');
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!liveData) return;
    setSelectedDate(liveData.date);
  }, [liveData]);

  const handleAoiDrawn = useCallback((next: Aoi) => setFilters({ aoi: next }), [setFilters]);
  const [inspect, setInspect] = useState<InspectTarget | null>(null);
  const inspectLive = useCallback((h: FireHotspot) => {
    setInspect({ lat: h.lat, lng: h.lng, cell: archiveCell(h.lat, h.lng), live: h });
  }, []);
  const closeInspector = useCallback(() => setInspect(null), []);
  const [impactTarget, setImpactTarget] = useState<InspectTarget | null>(null);
  const [impactOrigin, setImpactOrigin] = useState<DOMRect | null>(null);
  const [hazeCone, setHazeCone] = useState<HazeConeGeometry | null>(null);
  const closeImpact = useCallback(() => setImpactTarget(null), []);
  const showCone = useCallback((cone: HazeConeGeometry) => {
    setHazeCone(cone);
    setImpactTarget(null);
    setInspect(null);
  }, []);

  const handleMapReady = useCallback((map: LeafletMap) => {
    setMapInstance(map);
  }, []);

  const handleViewDonationLocation = useCallback((latitude: number, longitude: number, zoom: number) => {
    setImpactTarget(null);
    mapInstance?.flyTo([latitude, longitude], zoom, { duration: 1.5 });
  }, [mapInstance]);

  const liveSummary = useMemo(
    () => liveData
      ? createLiveDailySummary(liveData, region, (h: FireHotspot) => aoiContains(aoi, h.lat, h.lng))
      : null,
    [liveData, region, aoi],
  );
  // A past calendar month replaces the live layer; the current month keeps live points on top.
  const archiveFocus = focus && ymKey(focus) !== ymKey(currentYearMonth()) ? focus : null;
  const liveInAoi = useMemo(
    () => (liveData?.viirsHotspots ?? []).concat(liveData?.modisHotspots ?? []).filter((h) => aoiContains(aoi, h.lat, h.lng)),
    [liveData, aoi],
  );
  const liveWarning = useMemo(
    () => liveSummary ? createLiveEarlyWarning(liveSummary, region) : null,
    [liveSummary, region],
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white/90 font-sans">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.1] bg-[#0c0c0c]/95 shadow-[0_8px_30px_rgba(0,0,0,0.2)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-5 px-4 py-3 sm:px-6 lg:py-3.5">
          <Link
            to="/"
            className="group flex min-w-0 items-center gap-3 text-left transition-opacity hover:opacity-85"
          >
            <h1 className="shrink-0">
              <img src={artemisWordmark} alt="Artemis" width={1200} height={326} className="h-7 w-auto sm:h-8" />
            </h1>
            <div className="min-w-0 border-l border-white/[0.12] pl-3">
              <div className="flex items-center gap-2">
                <span className="hidden rounded border border-white/[0.16] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-white/70 sm:inline">
                  Monitor
                </span>
              </div>
              <p className="truncate font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-white/55 sm:text-[10px]">
                Satellite fire intelligence
              </p>
            </div>
          </Link>

          <div className="hidden min-w-0 items-center gap-3 lg:flex">
            <div className="border-l border-white/[0.12] pl-4">
              <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">Operational console</div>
              <div className="mt-0.5 text-xs text-white/65">Global fire monitoring desk</div>
            </div>
            <div className="h-8 w-px bg-white/[0.1]" />
            <div className="flex items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.03] px-3 py-2">
              <Database className="h-3.5 w-3.5 text-white/60" />
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">Sensors</div>
                <div className="font-mono text-[10px] font-semibold text-white/75">MODIS + VIIRS</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2">
              <span className={`h-2 w-2 rounded-full ${liveData ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-amber-400'}`} />
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">Feed status</div>
                <div className="font-mono text-[10px] font-semibold text-emerald-200/80">{liveData ? 'NASA FIRMS live' : 'Connecting'}</div>
              </div>
            </div>
            <a
              href="https://firms.modaps.eosdis.nasa.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md px-2 py-2 font-mono text-[10px] font-semibold text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white/85"
            >
              Source
              <ExternalLink className="h-3 w-3" />
            </a>
            <Link
              to={aoi.kind === 'polygon' ? `/audit?poly=${encodeAoi(aoi).poly}` : '/audit'}
              title={aoi.kind === 'polygon' ? 'Audit the drawn polygon' : 'Open the EUDR audit portal'}
              className="rounded-md border border-white/[0.14] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60 transition-colors hover:border-accent-400/40 hover:text-accent-200"
            >
              EUDR Audit
            </Link>
            <button
              onClick={() => setIsAboutOpen(true)}
              className="rounded-md border border-white/[0.16] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/75 transition-colors hover:bg-white/[0.06]"
            >
              About Artemis
            </button>
          </div>

          <button
            onClick={() => setIsAboutOpen(true)}
            className="rounded-md border border-white/[0.16] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/75 transition-colors hover:bg-white/[0.06] lg:hidden"
          >
            About
          </button>
        </div>
      </header>
      <ControlBar />

      {/* ─── Main Content ─── */}
      <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 sm:py-5">
        {/* Page context */}
        <section className="mb-4 flex flex-col justify-between gap-4 border-b border-[#a3a3a3]/20 pb-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="terminal-label mb-2 flex items-center gap-2 text-xs font-semibold text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500 shadow-[0_0_10px_rgba(217,131,28,0.8)]" />
              Fire intelligence desk
            </div>
            <h2 className="font-mono text-xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
              LIVE FIRE INTELLIGENCE // EARLY WARNING
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
              Monitor live satellite fire hotspots, understand wildfire conditions, follow relevant
              reports, and access direct relief campaigns matched to the selected disaster area.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-white/55 sm:gap-3">
            <span className="rounded border border-white/[0.12] bg-[#151515] px-3 py-1.5 font-mono text-xs text-white/60">
              Live observation · browser date
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${liveData ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {liveData ? `MODIS + VIIRS NRT · ${liveData.date}` : 'Loading today’s data'}
            </span>
          </div>
        </section>

        <div className="mt-3">
          {liveWarning && liveSummary ? (
            <LiveEarlyWarningPanel warning={liveWarning} summary={liveSummary} />
          ) : (
            <div className="rounded-xl border border-accent-400/20 bg-accent-400/5 p-5 text-sm text-accent-100/70">
              Waiting for NASA FIRMS live observations before issuing an early-warning signal.
            </div>
          )}
        </div>

        {/* Interactive Fire Map — primary workspace */}
        <section className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <div>
            <FireMap
              region={region}
              aoi={aoi}
              drawMode={drawMode}
              onAoiDrawn={handleAoiDrawn}
              onDrawModeChange={setDrawMode}
              selectedDate={archiveFocus ? null : selectedDate}
              statusLabel={archiveFocus ? `Harmonized archive · ${MONTH_LABELS[archiveFocus.month - 1]} ${archiveFocus.year}` : undefined}
              liveModisHotspots={liveData?.modisHotspots ?? []}
              liveViirsHotspots={liveData?.viirsHotspots ?? []}
              liveHarmonizedHotspots={liveData?.harmonizedHotspots ?? []}
              liveDate={liveData?.date ?? null}
              showAllRegions={showAllRegions}
              onToggleAllRegions={() => setShowAllRegions(!showAllRegions)}
              onLocationChange={setCurrentLocation}
              onMapReady={handleMapReady}
              onInspect={inspectLive}
            >
              <ArchiveMapLayers map={mapInstance} liveHotspots={archiveFocus ? [] : liveInAoi} onInspect={setInspect} />
              {hazeCone && <HazeConeLayer map={mapInstance} cone={hazeCone} onClear={() => setHazeCone(null)} />}
            </FireMap>
          </div>
          <aside className="space-y-3">
            <div className="terminal-surface rounded-[4px] p-4">
              <h3 className="font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-white/90">{region.name}</h3>
              <p className="mt-2 text-sm leading-6 text-white/60">{region.description}</p>
              <div className="mt-4 flex items-center justify-between border-t border-white/[0.1] pt-3 text-xs">
                <span className="text-white/50">Fire season</span>
                <span className="font-medium text-white/85">
                  {region.fireSeason.startMonth === 1 && region.fireSeason.endMonth === 12
                    ? 'Year-round'
                    : `${getMonthAbbr(region.fireSeason.startMonth)} – ${getMonthAbbr(region.fireSeason.endMonth)}`}
                </span>
              </div>
            </div>
            <div className="grid gap-px overflow-hidden rounded-xl border border-white/[0.1] bg-white/[0.1]">
              <div className="bg-[#0b0b0b] px-4 py-3">
                <div className="font-mono text-xs uppercase tracking-[0.14em] text-white/55">Sensor fusion</div>
                <div className="mt-1 text-sm font-medium text-white/85">MODIS 1 km + VIIRS 375 m</div>
              </div>
              <div className="bg-[#0b0b0b] px-4 py-3">
                <div className="font-mono text-xs uppercase tracking-[0.14em] text-white/55">Data status</div>
                <div className={`mt-1 text-sm font-medium ${liveData ? 'text-emerald-300' : 'text-accent-300'}`}>
                  {liveSummary ? `${liveSummary.harmonizedCount.toLocaleString()} harmonized detections` : 'Waiting for NASA FIRMS'}
                </div>
                <div className="mt-1 text-xs text-white/55">Current browser-date observation.</div>
              </div>
            </div>
          </aside>
        </section>

        {liveError && (
          <div className="mb-3 rounded-sm border border-red-400/30 bg-red-400/5 px-4 py-3 text-xs text-red-200">
            <strong>NASA FIRMS unavailable:</strong> {liveError} Live observations are unavailable until the connection is restored.
          </div>
        )}

        <div className="mt-3">
          <BurningCalendar />
        </div>


        {/* Donations live in the Impact Hub (Branch 1); the news feed is on the landing page. */}

        {/* Footer */}
        <footer className="mt-12 border-t border-white/[0.04] pt-6 pb-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2 text-xs text-white/55">
              <Flame className="h-3.5 w-3.5 text-amber-500/60" />
              <span className="font-semibold text-white/55">Artemis</span>
              <span className="text-white/55">·</span>
              <span>Harmonized Active Fire Hotspot Analysis</span>
            </div>
            <p className="max-w-2xl text-[10px] leading-relaxed text-white/55">
              Current-day data is fetched from NASA FIRMS MODIS NRT and VIIRS NRT
              (NOAA-20 and NOAA-21). Harmonization is calculated in the browser from those
              live detections; no simulated historical values are shown in this dashboard.
            </p>
            <div className="flex items-center gap-3 text-[10px] text-white/55">
              <span>MODIS Collection 6.1</span>
              <span>·</span>
              <span>VIIRS NOAA-20/21 I-band</span>
              <span>·</span>
              <span>NASA FIRMS NRT</span>
            </div>
          </div>
        </footer>
      </main>

      {inspect && (
        <HotspotInspector
          target={inspect}
          onClose={closeInspector}
          todayHotspots={liveInAoi}
          previousDayHotspots={liveData?.previousDayHotspots ?? []}
          onOpenImpact={(origin) => {
            setImpactOrigin(origin);
            setImpactTarget(inspect);
          }}
        />
      )}
      {impactTarget && (
        <ImpactHub
          variant="modal"
          target={impactTarget}
          origin={impactOrigin}
          liveHotspots={(liveData?.viirsHotspots ?? []).concat(liveData?.modisHotspots ?? [])}
          onClose={closeImpact}
          onShowCone={showCone}
          onViewLocation={handleViewDonationLocation}
        />
      )}
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}

function getMonthAbbr(month: number): string {
  if (month < 1) month = 12 + month;
  if (month > 12) month = month - 12;
  const names = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return names[month - 1] ?? '';
}

