// Evidence dossier for Gakkum KLHK / SP4N-LAPOR! review: a printable HTML report
// (save as PDF from the print dialog) and a detection-level CSV. Neutral, scientific
// wording only: the report describes satellite observations, not people.
import { fetchArchiveHotspots, MONTH_LABELS, type ForensicCell, type MonthRecord } from '@/data/historyApi';
import { archiveCell, haversineKm } from '@/lib/aoi';
import { toCsv } from '@/lib/csvExport';
import type { FireHotspot } from '@/types';

const ARCHIVE_POINT_REGIONS = new Set(['id-riau', 'id-jambi', 'id-south-sumatra', 'id-west-kalimantan', 'id-central-kalimantan']);
const LIVE_RADIUS_KM = 2;
/** FIRMS satellite codes in the archive files. */
const PLATFORM: Record<string, string> = { N: 'S-NPP', N20: 'NOAA-20', N21: 'NOAA-21', T: 'Terra', A: 'Aqua', Terra: 'Terra', Aqua: 'Aqua' };

export interface DossierInput {
  lat: number;
  lng: number;
  cell: string;
  place: string | null;
  regionId: string;
  regionName: string;
  forensic: ForensicCell;
  months: MonthRecord[];
  liveHotspots: FireHotspot[];
}

export interface DossierDetection {
  date: string;
  time: string;
  lat: number;
  lng: number;
  sensor: string;
  satellite: string;
  confidence: number;
  frp: number;
  dayNight: string;
  origin: 'live NRT' | 'archive';
}

export async function collectDetections(input: DossierInput): Promise<{ rows: DossierDetection[]; archiveYear: number | null }> {
  const live: DossierDetection[] = input.liveHotspots
    .filter((h) => haversineKm(input.lat, input.lng, h.lat, h.lng) <= LIVE_RADIUS_KM)
    .map((h) => ({
      date: h.date, time: h.acqTime, lat: h.lat, lng: h.lng, sensor: h.source, satellite: h.satellite ?? '',
      confidence: h.confidence, frp: h.frp, dayNight: h.dayNight ?? '', origin: 'live NRT' as const,
    }));
  const archiveYear = Number(input.forensic.lastActive.slice(0, 4)) || null;
  let archive: DossierDetection[] = [];
  if (archiveYear && ARCHIVE_POINT_REGIONS.has(input.regionId)) {
    const points = await fetchArchiveHotspots(input.regionId, archiveYear);
    archive = points
      .filter((p) => !p.static && archiveCell(p.lat, p.lon) === input.cell)
      .map((p) => ({
        date: p.date, time: p.time, lat: p.lat, lng: p.lon, sensor: p.sensor === 'MODIS' ? 'MODIS' : 'VIIRS',
        satellite: PLATFORM[p.satellite] ?? p.satellite, confidence: p.conf, frp: p.frp, dayNight: p.dn, origin: 'archive' as const,
      }));
  }
  return { rows: [...live, ...archive].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)), archiveYear };
}

export function dossierCsv(input: DossierInput, rows: DossierDetection[]): string {
  const f = input.forensic;
  return toCsv(
    ['date', 'time_utc', 'lat', 'lon', 'sensor', 'satellite', 'confidence', 'frp_mw', 'day_night', 'origin', 'h3_cell', 'signature_score', 'national_percentile'],
    rows.map((r) => [r.date, r.time, r.lat.toFixed(5), r.lng.toFixed(5), r.sensor, r.satellite, r.confidence, r.frp, r.dayNight, r.origin, input.cell, f.score, f.percentile]),
  );
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

function barsSvg(values: number[], labels: string[], opts: { title: string; signed?: boolean; unit: string }): string {
  const w = 640;
  const h = 170;
  const pad = { l: 36, r: 8, t: 10, b: 26 };
  const max = Math.max(1e-9, ...values.map((v) => Math.abs(v)));
  const lo = opts.signed ? -max : 0;
  const y = (v: number) => pad.t + ((max - v) / (max - lo)) * (h - pad.t - pad.b);
  const bw = (w - pad.l - pad.r) / values.length;
  const bars = values
    .map((v, i) => {
      const y0 = y(0);
      const y1 = y(v);
      const fill = opts.signed ? (v >= 1.5 ? '#b10026' : v >= 0 ? '#fd8d3c' : '#7f7f7f') : '#fd8d3c';
      return `<rect x="${(pad.l + i * bw + 1).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.max(bw - 2, 1).toFixed(1)}" height="${Math.max(Math.abs(y1 - y0), 0.5).toFixed(1)}" fill="${fill}"><title>${labels[i]}: ${v.toFixed(2)} ${opts.unit}</title></rect>`;
    })
    .join('');
  const ticks = labels
    .map((l, i) => (i % 5 === 0 || i === labels.length - 1 ? `<text x="${(pad.l + i * bw + bw / 2).toFixed(1)}" y="${h - 8}" font-size="10" text-anchor="middle" fill="#333">${l}</text>` : ''))
    .join('');
  const ref = opts.signed ? `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(1.5)}" y2="${y(1.5)}" stroke="#b10026" stroke-dasharray="4 3"/><text x="${w - pad.r}" y="${y(1.5) - 3}" font-size="9" text-anchor="end" fill="#b10026">+1.5σ</text>` : '';
  return `<figure><figcaption>${esc(opts.title)}</figcaption><svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(opts.title)}">
<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(0)}" y2="${y(0)}" stroke="#999"/>${ref}${bars}${ticks}
<text x="4" y="${pad.t + 8}" font-size="9" fill="#333">${opts.signed ? `+${max.toFixed(1)}` : max.toFixed(0)}</text>
</svg></figure>`;
}

export function dossierHtml(input: DossierInput, rows: DossierDetection[], archiveYear: number | null): string {
  const f = input.forensic;
  const generated = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const monthFocus = rows[0] ? Number(rows[0].date.slice(5, 7)) : new Date().getUTCMonth() + 1;
  const sameMonth = input.months.filter((m) => m.month === monthFocus && m.year >= 2001);
  const features: [string, number, number | null, string][] = [
    ['Off-season burning', 0.3, f.offSeason, `Share of detections in ${f.province}'s low-fire months (drought-anomaly months weighted half).`],
    ['Geometric regularity', 0.2, f.geometry, 'Linearity of same-day VIIRS detection clusters (0 round, 1 straight).'],
    ['Afternoon timing', 0.15, f.timing, `Afternoon-overpass share, ranked within ${f.province}. Afternoon share ${Math.round(f.afternoonShare * 100)}%, night ${Math.round(f.nightShare * 100)}%.`],
    ['Multi-year recurrence', 0.35, f.recurrence, `Active in ${f.activeYears} of ${f.years.length} years; ${Math.round(f.cycleShare * 100)}% of gaps are 3–5 years.`],
  ];
  const detRows = rows
    .slice(0, 200)
    .map((r) => `<tr><td>${r.date}</td><td>${esc(r.time)}</td><td>${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}</td><td>${r.sensor} ${esc(r.satellite)}</td><td>${r.confidence}</td><td>${r.frp.toFixed(1)}</td><td>${r.dayNight}</td><td>${r.origin}</td></tr>`)
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ARTEMIS evidence dossier ${input.cell}</title>
<style>
body{font:13px/1.5 Inter,system-ui,sans-serif;color:#111;max-width:760px;margin:24px auto;padding:0 16px;background:#fff}
h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:22px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px;text-transform:uppercase;letter-spacing:.04em}
.meta{color:#444;font-size:12px}table{border-collapse:collapse;width:100%;font-size:11px}td,th{border:1px solid #ccc;padding:3px 5px;text-align:left}th{background:#f2f2f2}
dl{display:grid;grid-template-columns:180px 1fr;gap:2px 12px;margin:0}dt{color:#555}dd{margin:0;font-variant-numeric:tabular-nums}
figure{margin:10px 0}figcaption{font-size:12px;font-weight:600;margin-bottom:4px}.note{border:1px solid #bbb;background:#f7f7f7;padding:8px 10px;font-size:12px}
.bar{display:flex;gap:8px;margin:12px 0}.bar button{font:inherit;padding:6px 12px;border:1px solid #111;background:#111;color:#fff;border-radius:3px;cursor:pointer}
@media print{.bar{display:none}body{margin:0}h2{break-after:avoid}table,figure{break-inside:avoid}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Print / save as PDF</button></div>
<h1>Satellite Thermal Anomaly Evidence Dossier</h1>
<p class="meta">Prepared for review by Gakkum KLHK or submission via SP4N-LAPOR!. Generated ${generated} by ARTEMIS (NASA Space Apps 2026) from NASA FIRMS MODIS and VIIRS records.</p>

<h2>1. Location</h2>
<dl>
<dt>Coordinates (WGS84)</dt><dd>${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}</dd>
<dt>Place (OpenStreetMap)</dt><dd>${esc(input.place ?? 'not resolved')}</dd>
<dt>Province</dt><dd>${esc(f.province)}</dd>
<dt>Analysis cell</dt><dd>H3 resolution 7 (~5 km²) ${input.cell}</dd>
<dt>Last fire activity</dt><dd>${f.lastActive} · max FRP ${f.maxFrp.toFixed(1)} MW</dd>
</dl>

<h2>2. Anthropogenic thermal signature</h2>
<dl>
<dt>Signature score</dt><dd>${f.score.toFixed(1)} / 100 (rule-based score, not a probability)</dd>
<dt>National percentile</dt><dd>${f.percentile.toFixed(1)} (higher than ${Math.round(f.percentile)}% of Indonesian fire cells)</dd>
</dl>
<table style="margin-top:8px"><tr><th>Feature</th><th>Weight</th><th>Value (0–1)</th><th>Definition</th></tr>
${features.map(([n, w, v, d]) => `<tr><td>${n}</td><td>${w.toFixed(2)}</td><td>${v === null ? 'n/a' : v.toFixed(3)}</td><td>${esc(d)}</td></tr>`).join('')}
</table>
<p class="meta">Score = 100 × (0.30 off-season + 0.20 geometry + 0.15 timing + 0.35 recurrence), computed from 2001–2026 detections with volcanoes, gas flares and persistent industrial heat removed.</p>

<h2>3. Twenty-year record</h2>
${barsSvg(f.yearly, f.years.map(String), { title: `Fire cell-days per year in this cell, ${f.years[0]}–${f.years[f.years.length - 1]}`, unit: 'cell-days' })}
${sameMonth.length ? barsSvg(sameMonth.map((m) => m.z ?? 0), sameMonth.map((m) => String(m.year)), { title: `${input.regionName}: ${MONTH_LABELS[monthFocus - 1]} anomaly by year (median/IQR, 2001–2025 baseline)`, signed: true, unit: 'σ' }) : ''}

<h2>4. Detections</h2>
<p class="meta">${rows.length} detections: live NRT within ${LIVE_RADIUS_KM} km of the location${archiveYear && ARCHIVE_POINT_REGIONS.has(input.regionId) ? ` and archive detections in this cell during ${archiveYear}` : ''}. ${rows.length > 200 ? 'First 200 shown; the CSV has all rows.' : ''} Pixel footprints are 375 m (VIIRS) to 1 km (MODIS) at nadir and grow toward the swath edge, so positions carry that uncertainty.</p>
${rows.length ? `<table><tr><th>Date</th><th>UTC</th><th>Lat, lon</th><th>Sensor</th><th>Conf.</th><th>FRP MW</th><th>D/N</th><th>Origin</th></tr>${detRows}</table>` : '<p>No detection rows are available for this location.</p>'}

<h2>5. Limitations</h2>
<p class="note">This dossier reports satellite thermal observations and a statistical pattern score. It does not identify who started any fire or why, and it is not a legal finding. Detections can include cloud-edge and sun-glint artefacts; the score flags patterns typical of managed land clearing but has not been validated against field labels. Field verification by the competent authority is required before any action.</p>
<p class="meta">Data: NASA FIRMS (MODIS C6.1, VIIRS S-NPP / NOAA-20 / NOAA-21), geoBoundaries, OpenStreetMap contributors.</p>
</body></html>`;
}
