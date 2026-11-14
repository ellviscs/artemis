import { geocodeLocation, type LocationResult } from '@/data/locationApi';

export interface LocalCampaign {
  id: string;
  title: string;
  organization: string;
  description: string;
  regionTags: string[];
  donationUrl: string | null;
  latitude: number;
  longitude: number;
  source?: 'curated' | 'automated-discovery' | 'verified-partner' | 'verified-wildfire';
  confidence?: number;
  validatedAt?: string;
}

export interface GlobalNonprofit {
  id: string;
  title: string;
  organization: string;
  description: string;
  regionTags: string[];
  donationUrl: string;
  latitude: number;
  longitude: number;
  source?: 'every.org';
}

export type DonationCampaign = LocalCampaign | GlobalNonprofit;

const DISCOVERY_URL = import.meta.env.VITE_DONATION_DISCOVERY_URL;
export async function fetchDiscoveredCampaigns(
  location: string,
  signal?: AbortSignal,
): Promise<LocalCampaign[]> {
  if (!DISCOVERY_URL) return [];
  const url = new URL('/campaigns', DISCOVERY_URL);
  url.searchParams.set('location', location);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Donation discovery request failed (${response.status}).`);
  const data = await response.json() as LocalCampaign[];
  return data.map((campaign) => ({ ...campaign, source: 'automated-discovery' }));
}

interface EveryOrgResponse {
  nonprofits?: Array<{
    id?: unknown;
    name?: unknown;
    slug?: unknown;
    description?: unknown;
    logoUrl?: unknown;
    profileUrl?: unknown;
  }>;
  data?: Array<{
    id?: unknown;
    name?: unknown;
    slug?: unknown;
    description?: unknown;
    logoUrl?: unknown;
    profileUrl?: unknown;
  }>;
}

const EVERY_ORG_URL = 'https://partners.every.org/v0.2/search';
const EVERY_ORG_API_KEY = import.meta.env.VITE_EVERY_ORG_API_KEY;

/**
 * Every.org wildfire nonprofits that name the affected place. `locationKeyword` holds
 * one or more place names separated by "|" (state first, then country).
 */
export async function fetchGlobalNonprofits(
  locationKeyword: string,
  signal?: AbortSignal,
): Promise<GlobalNonprofit[]> {
  if (!EVERY_ORG_API_KEY) throw new Error('Every.org API key is not configured.');
  const request = async (searchTerm: string): Promise<EveryOrgResponse> => {
    const params = new URLSearchParams({
      apiKey: EVERY_ORG_API_KEY,
      take: '4',
      causes: 'wildfires',
    });
    const response = await fetch(`${EVERY_ORG_URL}/${encodeURIComponent(searchTerm)}?${params.toString()}`, { signal });
    if (!response.ok) throw new Error(`Every.org request failed (${response.status}).`);
    return response.json() as Promise<EveryOrgResponse>;
  };
  // Search the state first, then the country, and keep only nonprofits whose own name or
  // description mentions that place: a bare keyword match (e.g. a US county fire council
  // for a fire in Brazil) is not related to the affected area. No generic fallback.
  const places = [...new Set(locationKeyword.split('|').map((p) => p.trim()).filter(Boolean))];
  const seen = new Set<string>();
  const nonprofits: NonNullable<EveryOrgResponse['nonprofits']> = [];
  for (const place of places) {
    const payload = await request(`wildfire ${place}`);
    for (const item of payload.nonprofits ?? payload.data ?? []) {
      const key = String(item.slug ?? item.id ?? item.name);
      const text = `${typeof item.name === 'string' ? item.name : ''} ${typeof item.description === 'string' ? item.description : ''}`.toLowerCase();
      if (seen.has(key) || !places.some((pl) => text.includes(pl.toLowerCase()))) continue;
      seen.add(key);
      nonprofits.push(item);
    }
  }

  return nonprofits.flatMap((item, index) => {
    if (typeof item.name !== 'string' || !item.name.trim()) return [];
    const identifier = typeof item.slug === 'string' ? item.slug : String(item.id ?? index);
    return [{
      id: `every-${identifier}`,
      title: item.name,
      organization: 'Every.org nonprofit directory',
      description: typeof item.description === 'string' && item.description
        ? item.description
        : `Support wildfire relief and humanitarian work related to ${locationKeyword}.`,
      // Kept only because its own name or description names one of these places.
      regionTags: places,
      source: 'every.org' as const,
      donationUrl: `https://www.every.org/${identifier}/donate`,
      latitude: 0,
      longitude: 0,
    }];
  });
}

export async function resolveCampaignLocation(campaign: DonationCampaign): Promise<LocationResult> {
  if (campaign.latitude !== 0 || campaign.longitude !== 0) {
    return {
      displayName: campaign.regionTags[0] ?? 'Disaster area',
      latitude: campaign.latitude,
      longitude: campaign.longitude,
    };
  }
  return geocodeLocation(campaign.regionTags[0] ?? 'Indonesia');
}
