import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, CheckCircle2, FileDown, FileText, FileUp, Info, ShieldAlert, ShieldCheck } from 'lucide-react';

import {
  cellOutline, DEMO_PLOTS, EUDR_CUTOFF, parseCsvRing, parseGeoJson, runAudit, validatePlot,
  type AuditPlot, type AuditResult,
} from '@/lib/audit';
import { auditCsv, auditSlug, auditStatementHtml } from '@/lib/auditReport';
import { downloadText } from '@/lib/csvExport';
import { addCartoBasemap } from '@/lib/basemap';
import { useInView } from '@/lib/useInView';
import { decodeAoi, type LatLng } from '@/lib/aoi';
import { cn } from '@/lib/utils';
import { btnGhost, btnPrimary } from '@/components/impact/shared';

const DEMO_KEYS = ['a', 'b'] as const;
const pct = (v: number) => `${Math.round(v * 100)}%`;

function plotFromParams(params: URLSearchParams): AuditPlot | null {
  const demo = params.get('demo');
  const di = DEMO_KEYS.indexOf(demo as (typeof DEMO_KEYS)[number]);
  if (di >= 0) return DEMO_PLOTS[di];
  const aoi = decodeAoi(params);
  if (aoi?.kind === 'polygon') return { name: 'Polygon drawn on the dashboard', source: 'dashboard', ring: aoi.points };
  const cell = params.get('cell');
  if (cell && /^[0-9a-f]{15}$/.test(cell)) {
    return { name: `Archive cell ${cell}`, source: 'dashboard', ring: cellOutline(cell), note: 'The ~5 km² H3 cell opened in the hotspot inspector.' };
  }
  return null;
}

function Section({ title, children, tag }: { title: string; children: React.ReactNode; tag?: React.ReactNode }) {
  return (
    <section className="rounded-[4px] border border-white/[0.12] bg-[#0f0f0f]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-2.5">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/85">{title}</h2>
        {tag}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function AuditMap({ result }: { result: AuditResult }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false });
    // The map needs a view before vector layers are added (Leaflet clips against it).
    const outlines = result.cells.map(cellOutline);
    map.fitBounds(L.latLngBounds([...result.plot.ring, ...outlines.flat()]), { padding: [12, 12] });
    addCartoBasemap(map);
    outlines.forEach((o) => L.polygon(o, { color: '#9ca3af', weight: 1, dashArray: '3 3', fill: false, interactive: false }).addTo(map));
    L.polygon(result.plot.ring, { color: '#d9831c', weight: 2, fillColor: '#d9831c', fillOpacity: 0.12 }).bindTooltip(result.plot.name).addTo(map);
    (result.post.detections ?? []).forEach((d) =>
      L.circleMarker([d.lat, d.lng], { radius: 3.5, color: '#000', weight: 1, fillColor: '#e31a1c', fillOpacity: 1 })
        .bindTooltip(`${d.date} ${d.time} UTC · ${d.satellite} · ${d.frp.toFixed(1)} MW`)
        .addTo(map),
    );
    return () => {
      map.remove();
    };
  }, [result]);
  return <div ref={ref} className="h-64 w-full rounded-[4px] border border-white/[0.12] bg-[#0a0a0a] sm:h-72" role="img" aria-label={`Map of ${result.plot.name}, its ${result.cells.length} overlapping archive cells and detections since 2021`} />;
}

function Timeline({ result }: { result: AuditResult }) {
  const max = Math.max(1, ...result.yearly.map((y) => y.value));
  const burned = result.yearly.filter((y) => y.value > 0).map((y) => y.year);
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <div>
      <div ref={ref} className={cn('grow-bars relative flex h-36 items-end gap-[3px]', inView && 'is-visible')} role="img" aria-label={`Fire cell-days per year, 2000–2026. Burning in ${burned.length ? burned.join(', ') : 'no year'}.`}>
        {result.yearly.map((y, i) => (
          <div key={y.year} className="group relative flex h-full flex-1 items-end" title={`${y.year}: ${y.value.toFixed(1)} cell-days`}>
            <div
              data-bar
              className={cn('w-full rounded-t-[1px]', y.value === 0 ? 'bg-white/[0.07]' : y.year >= 2021 ? 'bg-[#e31a1c]' : 'bg-[#fdba74]')}
              style={{ height: y.value === 0 ? 2 : `${Math.max(6, (y.value / max) * 100)}%`, ['--i' as string]: i }}
            />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-y-0 border-l border-dashed border-white/60" style={{ left: `${(21 / 27) * 100}%` }}>
          <span className="absolute -top-0.5 left-1 whitespace-nowrap font-mono text-[10px] text-white/75">EUDR cutoff</span>
        </div>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-white/55">
        <span>2000</span><span>2010</span><span>2020</span><span>2026</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/60">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[1px] bg-[#fdba74]" /> before 2021</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[1px] bg-[#e31a1c]" /> after the cutoff</span>
        <span>Peak {max.toFixed(1)} cell-days</span>
      </div>
    </div>
  );
}

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const [plot, setPlot] = useState<AuditPlot | null>(() => plotFromParams(params));
  const [state, setState] = useState<{ status: 'idle' | 'running' | 'done' | 'error'; result?: AuditResult; error?: string; progress?: number }>({ status: 'idle' });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!plot) return;
    const problem = validatePlot(plot.ring);
    if (problem) {
      setState({ status: 'error', error: problem });
      return;
    }
    let cancelled = false;
    setState({ status: 'running', progress: 0 });
    runAudit(plot, (d, t) => !cancelled && setState((s) => ({ ...s, progress: d / t })))
      .then((result) => !cancelled && setState({ status: 'done', result }))
      .catch((e: unknown) => !cancelled && setState({ status: 'error', error: e instanceof Error ? e.message : 'The audit failed.' }));
    return () => {
      cancelled = true;
    };
  }, [plot]);

  const chooseDemo = (i: number) => {
    setPlot(DEMO_PLOTS[i]);
    setUploadError(null);
    setParams({ demo: DEMO_KEYS[i] }, { replace: true });
  };

  const readFile = useCallback(async (file: File) => {
    setUploadError(null);
    try {
      const text = await file.text();
      const lower = file.name.toLowerCase();
      let ring: LatLng[];
      let name = file.name;
      let note: string | undefined;
      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        ring = parseCsvRing(text);
      } else if (lower.endsWith('.zip') || lower.endsWith('.shp')) {
        throw new Error('Shapefiles are not supported yet. Export the boundary as GeoJSON (QGIS: Export → Save Features As → GeoJSON).');
      } else {
        const g = parseGeoJson(text);
        ring = g.ring;
        if (g.name) name = `${g.name} (${file.name})`;
        if (g.parts > 1) note = `The file has ${g.parts} polygons; the largest was audited.`;
      }
      const problem = validatePlot(ring);
      if (problem) throw new Error(problem);
      setPlot({ name, source: 'upload', ring, note });
      setParams({}, { replace: true });
    } catch (e: unknown) {
      setUploadError(e instanceof SyntaxError ? 'The file is not valid GeoJSON.' : e instanceof Error ? e.message : 'Could not read the file.');
    }
  }, [setParams]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const r = state.result;
  const pass = r?.verdict === 'PASS';
  const dets = r?.post.detections;
  const detDays = useMemo(() => (dets ? new Set(dets.map((d) => d.date)).size : 0), [dets]);

  const openStatement = () => {
    if (!r) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(auditStatementHtml(r));
    win.document.close();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white/90">
      <header className="border-b border-white/[0.1] bg-[#0c0c0c]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white/70 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Command center
          </Link>
          <span className="font-mono text-sm font-bold tracking-[0.08em] text-white">ARTEMIS <span className="text-white/55">· Audit</span></span>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">EUDR & burn-risk audit</p>
            <h1 className="mt-1 font-mono text-xl font-semibold text-white">20-year zero-burn verification</h1>
            <p className="mt-2 text-[13px] leading-5 text-white/65">
              Check a plot boundary against 26 years of harmonized MODIS + VIIRS fire detections and the EUDR cutoff of {EUDR_CUTOFF}.
            </p>
          </div>

          <Section title="Demo plots">
            <div className="space-y-2">
              {DEMO_PLOTS.map((d, i) => (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => chooseDemo(i)}
                  aria-pressed={plot?.name === d.name}
                  className={cn('w-full rounded-[4px] border px-3 py-2.5 text-left transition-colors', plot?.name === d.name ? 'border-accent-400/60 bg-accent-400/[0.08]' : 'border-white/[0.12] hover:border-white/30')}
                >
                  <span className="block text-[13px] font-semibold text-white/90">{d.name.replace('Demo plot ', 'Plot ')}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-white/60">{d.note}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Upload a boundary">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn('rounded-[4px] border border-dashed px-3 py-5 text-center', dragging ? 'border-accent-400 bg-accent-400/[0.06]' : 'border-white/[0.2]')}
            >
              <FileUp className="mx-auto h-5 w-5 text-white/60" />
              <p className="mt-2 text-[12px] text-white/70">Drop a GeoJSON or CSV file here</p>
              <button type="button" className={cn(btnGhost, 'mt-3')} onClick={() => fileRef.current?.click()}>Choose file</button>
              <input ref={fileRef} type="file" accept=".geojson,.json,.csv,.txt" className="sr-only" aria-label="Upload plot boundary" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ''; }} />
            </div>
            <p className="mt-2 text-[11px] leading-4 text-white/55">
              GeoJSON Polygon or MultiPolygon (largest part is used), or CSV with lat and lon columns, one vertex per row. Files are read in your browser and never uploaded. Shapefile: export to GeoJSON first.
            </p>
            {uploadError && <p role="alert" className="mt-2 text-[12px] text-[#fca5a5]">{uploadError}</p>}
          </Section>

          {plot && (
            <Section title="Plot under audit">
              <p className="text-[13px] font-medium text-white/85">{plot.name}</p>
              {r && <p className="mt-1 font-mono text-[11px] tabular-nums text-white/60">{r.areaKm2 < 1 ? `${(r.areaKm2 * 100).toFixed(1)} ha` : `${r.areaKm2.toFixed(2)} km²`} · {plot.ring.length} vertices · {r.cells.length} archive cells</p>}
              {plot.note && <p className="mt-1.5 text-[11px] leading-4 text-white/55">{plot.note}</p>}
            </Section>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {!plot && (
            <div className="flex h-full min-h-[20rem] items-center justify-center rounded-[4px] border border-dashed border-white/[0.14] px-6 text-center">
              <p className="max-w-sm text-[13px] leading-5 text-white/60">Pick a demo plot or upload a boundary. You can also draw a polygon on the dashboard and use its EUDR Audit link.</p>
            </div>
          )}
          {state.status === 'running' && (
            <div className="rounded-[4px] border border-white/[0.12] bg-[#0f0f0f] px-4 py-6">
              <p className="text-[13px] text-white/70">Reading 26 years of archive for this plot… {Math.round((state.progress ?? 0) * 100)}%</p>
              <div className="mt-3 h-1 overflow-hidden rounded-[1px] bg-white/[0.08]"><div className="h-full bg-accent-500 transition-all" style={{ width: `${(state.progress ?? 0) * 100}%` }} /></div>
            </div>
          )}
          {state.status === 'error' && <p role="alert" className="rounded-[4px] border border-[#fca5a5]/30 bg-[#fca5a5]/[0.05] px-4 py-3 text-[13px] text-[#fca5a5]">{state.error}</p>}

          {r && state.status === 'done' && (
            <>
              <section aria-label="EUDR verdict" className={cn('rounded-[4px] border px-4 py-4', pass ? 'border-[#6ee7b7]/35 bg-[#6ee7b7]/[0.05]' : 'border-[#fca5a5]/40 bg-[#fca5a5]/[0.06]')}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {pass ? <ShieldCheck className="mt-0.5 h-8 w-8 shrink-0 text-[#6ee7b7]" /> : <ShieldAlert className="mt-0.5 h-8 w-8 shrink-0 text-[#fca5a5]" />}
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">EUDR post-2020 zero-burn screen</p>
                      <p className={cn('mt-0.5 font-mono text-2xl font-bold tracking-[0.04em]', pass ? 'text-[#6ee7b7]' : 'text-[#fca5a5]')}>{pass ? 'PASS' : 'FLAGGED'}</p>
                      <p className="mt-1 max-w-xl text-[13px] leading-5 text-white/75">
                        {r.verdictBasis === 'detection'
                          ? pass
                            ? `No fire detection inside the plot since ${EUDR_CUTOFF}.`
                            : `${dets?.length} detections inside the plot on ${detDays} days since ${EUDR_CUTOFF}.`
                          : pass
                            ? `No fire activity in the ${r.cells.length === 1 ? 'archive cell' : `${r.cells.length} archive cells`} overlapping the plot since ${EUDR_CUTOFF}.`
                            : `${r.post.cellDays.toFixed(1)} fire cell-days in the cells overlapping the plot since ${EUDR_CUTOFF}.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnPrimary} onClick={openStatement}><FileText className="h-3.5 w-3.5" /> Due diligence statement (PDF)</button>
                    <button type="button" className={btnGhost} onClick={() => downloadText(`${auditSlug(r)}_audit_log.csv`, auditCsv(r))}><FileDown className="h-3.5 w-3.5" /> 20-year audit log (CSV)</button>
                  </div>
                </div>
                <p className="mt-3 flex gap-2 border-t border-white/[0.1] pt-3 text-[12px] leading-5 text-white/65">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong className="font-semibold text-white/80">Rule:</strong> pass when no satellite fire detection (static industrial and volcanic heat removed) falls{' '}
                    {r.verdictBasis === 'detection'
                      ? 'inside the exact polygon after 31 Dec 2020, using 375 m VIIRS and 1 km MODIS detections.'
                      : `in any ~5 km² archive cell overlapping the plot after 31 Dec 2020. This province has no detection-level archive, so the screen is conservative: fires near the plot count too.`}{' '}
                    Burning is one deforestation indicator, not proof either way.
                  </span>
                </p>
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                <Section title="Plot and archive cells">
                  <AuditMap result={r} />
                  <p className="mt-2 text-[11px] leading-4 text-white/55">Orange outline: plot. Dashed: ~5 km² archive cells overlapping it. Red dots: detections inside the plot since 2021.</p>
                </Section>
                <Section title="20-year harmonized burn history">
                  <Timeline result={r} />
                  <p className="mt-2 text-[11px] leading-4 text-white/55">MODIS-equivalent fire cell-days in the overlapping cells, VIIRS calibrated to MODIS so 2000–2011 and 2012–2026 compare directly.</p>
                </Section>
              </div>

              <Section title="Burn-risk indicators" tag={<span className="rounded-[2px] border border-white/[0.2] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/65">Indicative</span>}>
                <dl className="grid gap-px overflow-hidden rounded-[4px] border border-white/[0.1] bg-white/[0.08] sm:grid-cols-4">
                  {[
                    ['Annual burn rate', `${pct(r.insurance.rate)} / yr`, `95% CI ${pct(r.insurance.ci[0])}–${pct(r.insurance.ci[1])}`],
                    ['Years with burning', `${r.insurance.burnYears} of ${r.insurance.years}`, 'complete years 2001–2025'],
                    ['Mean return interval', r.insurance.meanReturnYears ? `${r.insurance.meanReturnYears.toFixed(1)} yr` : '—', r.insurance.lastBurnYear ? `last burn ${r.insurance.lastBurnYear}` : 'no burns on record'],
                    ['Recurrence tier', r.insurance.tier, r.insurance.tier === 'High' ? '≥ 30% of years' : r.insurance.tier === 'Moderate' ? '10–30% of years' : '< 10% of years'],
                  ].map(([label, value, sub]) => (
                    <div key={label} className="bg-[#0d0d0d] px-3 py-3">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/55">{label}</dt>
                      <dd className={cn('mt-1 font-mono text-lg font-semibold tabular-nums text-white', label === 'Recurrence tier' && (r.insurance.tier === 'High' ? 'text-[#fca5a5]' : r.insurance.tier === 'Moderate' ? 'text-[#fdba74]' : 'text-[#6ee7b7]'))}>{value}</dd>
                      <dd className="mt-0.5 text-[11px] text-white/55">{sub}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[11px] leading-4 text-white/55">
                  Share of years with any fire in the overlapping cells, with a Wilson 95% interval. For insurers and lenders as a screening input only, not an underwriting decision.
                </p>
              </Section>

              {dets && dets.length > 0 && (
                <Section title={`Detections inside the plot since 2021 · ${dets.length}`}>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-left font-mono text-[11px] tabular-nums">
                      <thead className="sticky top-0 bg-[#0f0f0f] text-white/60">
                        <tr><th className="py-1.5 pr-3 font-medium">Date</th><th className="pr-3 font-medium">UTC</th><th className="pr-3 font-medium">Lat, lon</th><th className="pr-3 font-medium">Satellite</th><th className="pr-3 font-medium">Conf.</th><th className="font-medium">FRP MW</th></tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06] text-white/80">
                        {dets.map((d, i) => (
                          <tr key={i}><td className="py-1.5 pr-3">{d.date}</td><td className="pr-3">{d.time}</td><td className="pr-3">{d.lat.toFixed(4)}, {d.lng.toFixed(4)}</td><td className="pr-3">{d.satellite}</td><td className="pr-3">{d.confidence}</td><td>{d.frp.toFixed(1)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}
              {pass && r.verdictBasis === 'detection' && r.post.cellDays > 0 && (
                <p className="flex gap-2 text-[12px] leading-5 text-white/65">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6ee7b7]" />
                  Fires were detected in the surrounding cells since 2021 ({r.post.cellDays.toFixed(1)} cell-days) but none inside the plot itself.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
