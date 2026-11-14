// Kept apart from EarthHero so importing the defaults does not pull three.js into
// the main bundle (EarthHero is lazy-loaded).
export interface EarthTuning {
  /** Auto-rotation speed, radians per second. */
  spin: number;
  /** How strongly the globe leans toward the pointer (radians at the screen edge). */
  tiltFollow: number;
}

// Spin and lean picked by the team in the ?tune=1 panel (Nov 2026).
export const DEFAULT_EARTH: EarthTuning = { spin: 0.245, tiltFollow: 0.02 };
