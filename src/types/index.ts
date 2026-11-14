// ─── Core Types ───────────────────────────────────────────────────────────────

export type SatelliteSource = 'MODIS' | 'VIIRS';

export type FireIntensityLevel =
  | 'low'
  | 'moderate'
  | 'high'
  | 'very-high'
  | 'extreme';

// A single raw fire hotspot as received from NASA FIRMS
export interface FireHotspot {
  id: string;
  source: SatelliteSource;
  // Platform that made the detection, e.g. 'Terra', 'Aqua', 'NOAA-20', 'NOAA-21'
  satellite?: string;
  // 'D' day or 'N' night overpass
  dayNight?: 'D' | 'N';
  date: string; // ISO yyyy-mm-dd
  lat: number;
  lng: number;
  brightness: number; // Kelvin — MODIS uses 310-500K, VIIRS 300-450K
  confidence: number; // 0-100
  frp: number; // Fire Radiative Power (MW)
  scan: number; // pixel size
  track: number; // pixel size
  acqTime: string; // HH:mm UTC
}

// Harmonized daily aggregate for a region
export interface DailyFireSummary {
  date: string; // yyyy-mm-dd
  dayOfYear: number;
  month: number; // 1-12
  day: number; // 1-31
  year: number;

  // Raw counts per satellite
  modisCount: number;
  viirsCount: number;

  // Harmonized metrics
  harmonizedCount: number; // deduplicated / scaled composite
  totalFRP: number; // total fire radiative power (MW)
  meanBrightness: number; // mean brightness temp (K)
  meanConfidence: number;

  // Intensity classification
  intensity: FireIntensityLevel;
  intensityScore: number; // 0-100

  // High-confidence hotspot ratio
  highConfidenceRatio: number;
}

// ─── Regions ──────────────────────────────────────────────────────────────────

export interface Region {
  id: string;
  name: string;
  country: string;
  scope: 'world' | 'continent' | 'country' | 'province';
  bbox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  // Center point for map view (latitude, longitude)
  center: [number, number];
  // Recommended Leaflet zoom level for this region
  zoom: number;
  // Bounds array for Leaflet rectangle overlay [[minLat, minLng], [maxLat, maxLng]]
  bounds: [[number, number], [number, number]];
  fireSeason: {
    startMonth: number;
    endMonth: number;
  };
  description: string;
}

// ─── Early Warning ────────────────────────────────────────────────────────────

export type WarningLevel = 'normal' | 'advisory' | 'watch' | 'warning' | 'extreme';

export interface EarlyWarning {
  level: WarningLevel;
  title: string;
  message: string;
  region: string;
  date: string;
  metrics: {
    recentAvg: number;
    historicalAvg: number;
    deviation: number;
    trend: 'rising' | 'declining' | 'stable';
  };
  recommendations: string[];
}
