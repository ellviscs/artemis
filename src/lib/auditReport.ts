// Exports for the /audit portal: a printable EUDR due-diligence supporting statement
// (save as PDF) and a 20-year audit log CSV.
import { EUDR_CUTOFF, type AuditResult } from '@/lib/audit';
import { toCsv } from '@/lib/csvExport';
import { barsSvg, esc } from '@/lib/dossier';

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export function auditSlug(r: AuditResult): string {
  const [lat, lng] = r.plot.ring[0];
  return `artemis_eudr_${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

export function auditCsv(r: AuditResult): string {
  const rows: unknown[][] = r.monthly.map((m) => [
    'month', `${m.year}-${String(m.month).padStart(2, '0')}`, m.value, '', '', '', '', '', '', '',
  ]);
  for (const d of r.post.detections ?? []) {
    rows.push(['detection', d.date, '', d.time, d.lat.toFixed(5), d.lng.toFixed(5), d.sensor, d.satellite, d.confidence, d.frp]);
  }
  const head = [
    `# ARTEMIS 20-year audit log · ${r.plot.name}`,
    `# Plot vertices (lat lon): ${r.plot.ring.map(([a, b]) => `${a.toFixed(5)} ${b.toFixed(5)}`).join('; ')}`,
    `# Verdict: ${r.verdict} (EUDR post-${EUDR_CUTOFF} zero-burn screen, ${r.verdictBasis}-level evidence)`,
    `# month rows: MODIS-equivalent fire cell-days in ${r.cells.length} H3 res-7 cells overlapping the plot (static heat masked)`,
    `# detection rows: NASA FIRMS detections inside the exact polygon after ${EUDR_CUTOFF}${r.post.detections ? '' : ' (no detection archive for this province: none listed)'}`,
  ].join('\n');
  return `${head}\n${toCsv(['record_type', 'period', 'cell_days', 'time_utc', 'lat', 'lon', 'sensor', 'satellite', 'confidence', 'frp_mw'], rows)}`;
}

export function auditStatementHtml(r: AuditResult): string {
  const generated = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const years = r.yearly.map((y) => String(y.year));
  const cutIdx = r.yearly.findIndex((y) => y.year >= 2021);
  const dets = r.post.detections;
  const ins = r.insurance;
  const pass = r.verdict === 'PASS';
  const detRows = (dets ?? [])
    .slice(0, 150)
    .map((d) => `<tr><td>${d.date}</td><td>${esc(d.time)}</td><td>${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}</td><td>${d.sensor} ${esc(d.satellite)}</td><td>${d.confidence}</td><td>${d.frp.toFixed(1)}</td></tr>`)
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EUDR due diligence statement · ${esc(r.plot.name)}</title>
<style>
body{font:13px/1.5 Inter,system-ui,sans-serif;color:#111;max-width:760px;margin:24px auto;padding:0 16px;background:#fff}
h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:22px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px;text-transform:uppercase;letter-spacing:.04em}
.meta{color:#444;font-size:12px}table{border-collapse:collapse;width:100%;font-size:11px}td,th{border:1px solid #ccc;padding:3px 5px;text-align:left}th{background:#f2f2f2}
dl{display:grid;grid-template-columns:200px 1fr;gap:2px 12px;margin:0}dt{color:#555}dd{margin:0;font-variant-numeric:tabular-nums}
figure{margin:10px 0}figcaption{font-size:12px;font-weight:600;margin-bottom:4px}.note{border:1px solid #bbb;background:#f7f7f7;padding:8px 10px;font-size:12px}
.verdict{display:inline-block;padding:6px 14px;border:2px solid ${pass ? '#1a7f37' : '#b10026'};color:${pass ? '#1a7f37' : '#b10026'};font-weight:700;letter-spacing:.08em;border-radius:3px}
.bar{display:flex;gap:8px;margin:12px 0}.bar button{font:inherit;padding:6px 12px;border:1px solid #111;background:#111;color:#fff;border-radius:3px;cursor:pointer}
@media print{.bar{display:none}body{margin:0}h2{break-after:avoid}table,figure{break-inside:avoid}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Print / save as PDF</button></div>
<h1>EUDR Due Diligence: Satellite Burn Screening Statement</h1>
<p class="meta">Supporting evidence for a due diligence statement under Regulation (EU) 2023/1115. Generated ${generated} by ARTEMIS from the harmonized NASA FIRMS MODIS + VIIRS archive (Nov 2000 – present).</p>

<h2>1. Plot</h2>
<dl>
<dt>Plot</dt><dd>${esc(r.plot.name)}</dd>
<dt>Area</dt><dd>${r.areaKm2 < 1 ? `${(r.areaKm2 * 100).toFixed(1)} ha` : `${r.areaKm2.toFixed(2)} km² (${Math.round(r.areaKm2 * 100).toLocaleString()} ha)`}</dd>
<dt>Province</dt><dd>${esc(r.post.province?.name ?? 'Outside the five detection-archive provinces')}</dd>
<dt>Vertices (lat, lon, WGS84)</dt><dd>${r.plot.ring.map(([a, b]) => `${a.toFixed(5)}, ${b.toFixed(5)}`).join('<br>')}</dd>
</dl>

<h2>2. Post-${EUDR_CUTOFF} zero-burn screen</h2>
<p><span class="verdict">${pass ? 'PASS · no burning detected' : 'FLAGGED · burning detected'}</span></p>
<p><strong>Rule:</strong> the plot passes when no satellite fire detection (static industrial and volcanic heat removed) falls ${r.verdictBasis === 'detection' ? 'inside the plot polygon' : 'in any ~5 km² archive cell overlapping the plot'} after ${EUDR_CUTOFF}.</p>
<dl>
<dt>Evidence level</dt><dd>${r.verdictBasis === 'detection' ? 'Detection level: 375 m VIIRS / 1 km MODIS points tested against the exact polygon' : 'Cell level: H3 resolution-7 cells (~5 km²) overlapping the plot. Conservative: fires near but outside the plot also count.'}</dd>
<dt>Detections in plot since 2021</dt><dd>${dets ? `${dets.length} on ${new Set(dets.map((d) => d.date)).size} days` : 'not available for this province'}</dd>
<dt>Cell-days in overlapping cells since 2021</dt><dd>${r.post.cellDays.toFixed(1)} across ${r.cells.length} cells</dd>
</dl>

<h2>3. Twenty-year burn history</h2>
${barsSvg(r.yearly.map((y) => y.value), years, { title: 'MODIS-equivalent fire cell-days per year in cells overlapping the plot (dark = after the EUDR cutoff)', unit: 'cell-days', markFrom: cutIdx })}

<h2>4. Indicative burn frequency</h2>
<dl>
<dt>Years with burning</dt><dd>${ins.burnYears} of ${ins.years} complete years (2001–2025)</dd>
<dt>Annualized burn rate</dt><dd>${pct(ins.rate)} per year (95% Wilson interval ${pct(ins.ci[0])}–${pct(ins.ci[1])})</dd>
<dt>Mean return interval</dt><dd>${ins.meanReturnYears ? `${ins.meanReturnYears.toFixed(1)} years` : 'n/a'}</dd>
<dt>Last burn year</dt><dd>${ins.lastBurnYear ?? 'none in archive'}</dd>
</dl>
<p class="meta">Indicative statistics at cell level, not an underwriting decision.</p>

${dets && dets.length ? `<h2>5. Detections inside the plot since 2021</h2><table><tr><th>Date</th><th>UTC</th><th>Lat, lon</th><th>Sensor</th><th>Conf.</th><th>FRP MW</th></tr>${detRows}</table>${dets.length > 150 ? '<p class="meta">First 150 shown; the audit log CSV has all.</p>' : ''}` : ''}

<h2>${dets && dets.length ? '6' : '5'}. Limitations</h2>
<p class="note">EUDR requires deforestation-free and legally produced commodities. This statement screens one indicator only: satellite-detected burning. A PASS does not prove the absence of deforestation by other means (clearing without fire, logging), and fires under persistent cloud or smaller than the sensor detection limit can be missed. A FLAG means thermal anomalies were observed; it does not establish cause or responsibility and needs field and land-cover verification. Detection positions carry pixel-size uncertainty (375 m to 1 km at nadir, larger at swath edges).</p>
<p class="meta">Data: NASA FIRMS (MODIS C6.1; VIIRS S-NPP, NOAA-20, NOAA-21), geoBoundaries. Method: VIIRS cell-days scaled to MODIS-equivalent with a per-month calibration factor (log R² 0.97).</p>
</body></html>`;
}
