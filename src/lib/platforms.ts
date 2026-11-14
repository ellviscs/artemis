// Display names for FIRMS satellite codes found in archive and NRT files.
const PLATFORMS: Record<string, string> = {
  N: 'S-NPP',
  N20: 'NOAA-20',
  N21: 'NOAA-21',
  T: 'Terra',
  A: 'Aqua',
  Terra: 'Terra',
  Aqua: 'Aqua',
};

export function platformName(code: string): string {
  return PLATFORMS[code] ?? code;
}
