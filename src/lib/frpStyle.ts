// Live detection dots: colour = fire radiative power (FRP) on the selected colorblind-safe
// ramp, log scale; shape = sensor (VIIRS filled dot, MODIS ring), so colour stays free
// for intensity. Fixed domain (1–500 MW) keeps colours comparable from day to day.
import { rampColor, type RampId } from '@/lib/colorRamps';

export const FRP_MIN = 1;
export const FRP_MAX = 500;
/** Legend ticks, MW. */
export const FRP_TICKS = [1, 10, 100, 500] as const;

/** Position of an FRP value on the log ramp, 0–1. */
export function frpT(frp: number): number {
  const v = Math.min(Math.max(frp, FRP_MIN), FRP_MAX);
  return Math.log10(v / FRP_MIN) / Math.log10(FRP_MAX / FRP_MIN);
}

/** Ramp colour for an FRP value. The darkest 12% is skipped: it vanishes on the dark basemap. */
export function frpColor(ramp: RampId, frp: number): string {
  return rampColor(ramp, 0.12 + 0.88 * frpT(frp));
}

/** Legend gradient sampled the same way as the dots. */
export function frpGradient(ramp: RampId): string {
  const stops = Array.from({ length: 10 }, (_, i) => rampColor(ramp, 0.12 + 0.88 * (i / 9)));
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
