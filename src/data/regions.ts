import type { Region } from '@/types';

type RegionDefinition = Omit<Region, 'scope'> & {
  scope: Region['scope'];
};

const country = (
  id: string,
  name: string,
  bbox: Region['bbox'],
  center: Region['center'],
  zoom: number,
  fireSeason: Region['fireSeason'],
  description: string,
): RegionDefinition => ({
  id,
  name,
  country: name,
  scope: 'country',
  bbox,
  center,
  zoom,
  bounds: [[bbox.minLat, bbox.minLng], [bbox.maxLat, bbox.maxLng]],
  fireSeason,
  description,
});

const continent = (
  id: string,
  name: string,
  bbox: Region['bbox'],
  center: Region['center'],
  zoom: number,
  fireSeason: Region['fireSeason'],
  description: string,
): RegionDefinition => ({
  id,
  name,
  country: 'Continent',
  scope: 'continent',
  bbox,
  center,
  zoom,
  bounds: [[bbox.minLat, bbox.minLng], [bbox.maxLat, bbox.maxLng]],
  fireSeason,
  description,
});

const province = (
  id: string,
  name: string,
  bbox: Region['bbox'],
  center: Region['center'],
  zoom: number,
  fireSeason: Region['fireSeason'],
  description: string,
): RegionDefinition => ({
  id,
  name,
  country: 'Indonesia',
  scope: 'province',
  bbox,
  center,
  zoom,
  bounds: [[bbox.minLat, bbox.minLng], [bbox.maxLat, bbox.maxLng]],
  fireSeason,
  description,
});

// Indonesia's main peat and forest fire provinces. Bounding boxes are the extents of the
// geoBoundaries IDN ADM1 polygons used by the pipeline (exact membership is polygon-based).
// These are the regions processed by the 20-year harmonization pipeline.
export const INDONESIA_PROVINCES: Region[] = [
  province('id-riau', 'Riau', { minLat: -1.12, maxLat: 2.556, minLng: 100.072, maxLng: 103.814 }, [0.72, 101.94], 7, { startMonth: 2, endMonth: 9 }, 'Deep peatland on the east coast of Sumatra; burning peaks in Feb–Mar and again in the Jul–Sep dry season.'),
  province('id-jambi', 'Jambi', { minLat: -2.77, maxLat: -0.746, minLng: 101.123, maxLng: 104.489 }, [-1.76, 102.81], 7, { startMonth: 7, endMonth: 10 }, 'Lowland peat domes and plantations in central Sumatra with strong El Niño-year fire spikes.'),
  province('id-south-sumatra', 'South Sumatra', { minLat: -4.92, maxLat: -1.63, minLng: 102.063, maxLng: 106.097 }, [-3.27, 104.08], 7, { startMonth: 7, endMonth: 10 }, 'Extensive coastal peatlands (OKI, Banyuasin) that drive major transboundary haze events.'),
  province('id-west-kalimantan', 'West Kalimantan', { minLat: -3.042, maxLat: 2.081, minLng: 108.599, maxLng: 114.207 }, [-0.48, 111.4], 7, { startMonth: 7, endMonth: 10 }, 'Peat swamp and plantation frontier along the Kapuas basin with recurrent dry-season fires.'),
  province('id-central-kalimantan', 'Central Kalimantan', { minLat: -3.544, maxLat: 0.795, minLng: 110.731, maxLng: 115.849 }, [-1.37, 113.29], 7, { startMonth: 7, endMonth: 10 }, 'Former Mega Rice Project peatlands; among the most fire-prone landscapes in Indonesia.'),
];

export const REGIONS: Region[] = [
  {
    id: 'global',
    name: 'World',
    country: 'All monitored land',
    scope: 'world',
    bbox: { minLat: -60, maxLat: 75, minLng: -180, maxLng: 180 },
    center: [20, 0],
    zoom: 2,
    bounds: [[-60, -180], [75, 180]],
    fireSeason: { startMonth: 1, endMonth: 12 },
    description:
      'Global view of satellite-detected burning activity, combining seasonal fire regimes across every monitored continent.',
  },

  ...INDONESIA_PROVINCES,

  continent('cont-africa', 'Africa', { minLat: -35, maxLat: 37, minLng: -17, maxLng: 51 }, [0, 20], 3, { startMonth: 5, endMonth: 10 }, 'The most active fire continent by hotspot count, driven by savanna and agricultural burning.'),
  continent('cont-asia', 'Asia', { minLat: -10, maxLat: 75, minLng: 40, maxLng: 150 }, [34, 100], 3, { startMonth: 3, endMonth: 10 }, 'A continental view spanning boreal forests, temperate grasslands, agricultural regions, and tropical peatlands.'),
  continent('cont-europe', 'Europe', { minLat: 35, maxLat: 71, minLng: -10, maxLng: 40 }, [54, 15], 4, { startMonth: 6, endMonth: 9 }, 'Fire activity is concentrated in the Mediterranean during hot, dry summer conditions.'),
  continent('cont-namerica', 'North America', { minLat: 15, maxLat: 72, minLng: -168, maxLng: -52 }, [45, -100], 3, { startMonth: 5, endMonth: 10 }, 'Boreal Canada, the western United States, Mexico, and their contrasting fire seasons.'),
  continent('cont-samerica', 'South America', { minLat: -55, maxLat: 12, minLng: -81, maxLng: -34 }, [-20, -60], 3, { startMonth: 6, endMonth: 11 }, 'Amazonian deforestation, Cerrado burning, and dry-season fire activity across the continent.'),
  continent('cont-oceania', 'Oceania', { minLat: -50, maxLat: 0, minLng: 110, maxLng: 180 }, [-24, 145], 3, { startMonth: 5, endMonth: 10 }, 'Australia and the Pacific, with intense dry-season savanna and bushfire activity.'),

  country('argentina', 'Argentina', { minLat: -55, maxLat: -21, minLng: -73, maxLng: -53 }, [-34, -64], 4, { startMonth: 8, endMonth: 12 }, 'Grassland, agricultural, and dry-forest burning across the Pampas, Chaco, and Patagonia.'),
  country('australia', 'Australia', { minLat: -44, maxLat: -10, minLng: 113, maxLng: 154 }, [-25, 134], 4, { startMonth: 5, endMonth: 10 }, 'Savanna and bushfire activity, with dry-season burning in the north and summer fires in the southeast.'),
  country('brazil', 'Brazil', { minLat: -34, maxLat: 5, minLng: -74, maxLng: -34 }, [-10, -52], 4, { startMonth: 6, endMonth: 11 }, 'Amazon and Cerrado burning linked to land clearing, drought, and agricultural activity.'),
  country('canada', 'Canada', { minLat: 42, maxLat: 83, minLng: -141, maxLng: -52 }, [57, -106], 3, { startMonth: 5, endMonth: 9 }, 'Boreal and prairie fires with a strong summer peak and long-range smoke impacts.'),
  country('china', 'China', { minLat: 18, maxLat: 54, minLng: 73, maxLng: 135 }, [35, 104], 4, { startMonth: 3, endMonth: 10 }, 'Agricultural burning and grassland fires across a wide range of climate zones.'),
  country('france', 'France', { minLat: 42, maxLat: 51, minLng: -5, maxLng: 9 }, [46.5, 2], 6, { startMonth: 6, endMonth: 9 }, 'Mediterranean and Atlantic fire regimes, including high-risk conditions in southern France.'),
  country('germany', 'Germany', { minLat: 47, maxLat: 55, minLng: 5, maxLng: 15 }, [51, 10], 6, { startMonth: 4, endMonth: 9 }, 'Temperate forest and agricultural fires influenced by heatwaves and drought.'),
  country('india', 'India', { minLat: 6, maxLat: 36, minLng: 68, maxLng: 97 }, [22, 79], 4, { startMonth: 3, endMonth: 6 }, 'Seasonal crop-residue and forest burning, especially during the pre-monsoon period.'),
  country('indonesia', 'Indonesia', { minLat: -11, maxLat: 6, minLng: 95, maxLng: 141 }, [-2, 118], 4, { startMonth: 7, endMonth: 10 }, 'Tropical peatland and forest fires linked to drought, land clearing, and El Niño conditions.'),
  country('italy', 'Italy', { minLat: 36, maxLat: 47, minLng: 6, maxLng: 19 }, [42.5, 12.5], 5, { startMonth: 6, endMonth: 9 }, 'Mediterranean wildfires driven by heat, dry vegetation, and seasonal winds.'),
  country('japan', 'Japan', { minLat: 24, maxLat: 46, minLng: 129, maxLng: 146 }, [36, 138], 5, { startMonth: 3, endMonth: 5 }, 'Seasonal vegetation and forest fire activity across a densely monitored island chain.'),
  country('mexico', 'Mexico', { minLat: 14, maxLat: 33, minLng: -118, maxLng: -86 }, [23, -102], 5, { startMonth: 3, endMonth: 6 }, 'Dry-season agricultural and forest fires across tropical, arid, and highland ecosystems.'),
  country('russia', 'Russia', { minLat: 41, maxLat: 82, minLng: 19, maxLng: 180 }, [61, 100], 3, { startMonth: 4, endMonth: 9 }, 'Extensive boreal fire activity, especially across Siberia, with increasing climate-driven severity.'),
  country('saudi-arabia', 'Saudi Arabia', { minLat: 16, maxLat: 33, minLng: 34, maxLng: 56 }, [24, 45], 5, { startMonth: 1, endMonth: 12 }, 'Sparse but operationally important detections across arid and agricultural landscapes.'),
  country('south-africa', 'South Africa', { minLat: -35, maxLat: -22, minLng: 16, maxLng: 33 }, [-30, 25], 5, { startMonth: 5, endMonth: 10 }, 'Grassland, savanna, and agricultural burning during the dry winter season.'),
  country('south-korea', 'South Korea', { minLat: 33, maxLat: 39, minLng: 126, maxLng: 130 }, [36.2, 128], 6, { startMonth: 3, endMonth: 5 }, 'Seasonal forest and grassland fire risk during dry spring conditions.'),
  country('turkey', 'Türkiye', { minLat: 35, maxLat: 43, minLng: 25, maxLng: 45 }, [39, 35], 5, { startMonth: 6, endMonth: 9 }, 'Mediterranean and Anatolian fires amplified by summer heat and drought.'),
  country('united-kingdom', 'United Kingdom', { minLat: 49, maxLat: 59, minLng: -8, maxLng: 2 }, [54, -2], 5, { startMonth: 3, endMonth: 6 }, 'Moorland and grassland fires that peak during dry spring and early summer periods.'),
  country('united-states', 'United States', { minLat: 24, maxLat: 50, minLng: -125, maxLng: -66 }, [39, -98], 4, { startMonth: 5, endMonth: 10 }, 'Wildfire and agricultural burning across western forests, plains, and southern ecosystems.'),
];

export const getRegionById = (id: string): Region =>
  REGIONS.find((r) => r.id === id) ?? REGIONS[0];
