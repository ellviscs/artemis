// Colorblind-safe sequential ramps for every quantitative encoding (DESIGN.md: Safe Ramp Rule).
// Stops are sampled from matplotlib's viridis / cividis and ColorBrewer YlOrRd.

export type RampId = 'viridis' | 'cividis' | 'ylorrd';

export const RAMPS: Record<RampId, { label: string; stops: string[] }> = {
  viridis: {
    label: 'Viridis',
    stops: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'],
  },
  cividis: {
    label: 'Cividis',
    stops: ['#00224e', '#123570', '#3b496c', '#575d6d', '#707173', '#8a8678', '#a59c74', '#c3b369', '#e1cc55', '#fee838'],
  },
  // Reversed for the dark surface so the highest values are the brightest (like Viridis/Cividis).
  ylorrd: {
    label: 'YlOrRd',
    stops: ['#800026', '#bd0026', '#e31a1c', '#fc4e2a', '#fd8d3c', '#feb24c', '#fed976', '#ffeda0', '#ffffcc'],
  },
};

export const RAMP_IDS = Object.keys(RAMPS) as RampId[];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Color at t ∈ [0, 1] along the ramp, linearly interpolated in sRGB. */
export function rampColor(ramp: RampId, t: number): string {
  const stops = RAMPS[ramp].stops;
  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  const a = hexToRgb(stops[i]);
  const b = hexToRgb(stops[i + 1]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function rampGradient(ramp: RampId, direction = 'to right'): string {
  return `linear-gradient(${direction}, ${RAMPS[ramp].stops.join(', ')})`;
}
