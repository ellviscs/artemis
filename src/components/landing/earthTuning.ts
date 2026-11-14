// Kept apart from EarthHero so importing the defaults does not pull three.js into
// the main bundle (EarthHero is lazy-loaded).
export interface EarthTuning {
  /** Auto-rotation speed, radians per second. */
  spin: number;
  /** How strongly the globe leans toward the pointer (radians at the screen edge). */
  tiltFollow: number;
}

export const DEFAULT_EARTH: EarthTuning = { spin: 0.045, tiltFollow: 0.22 };
