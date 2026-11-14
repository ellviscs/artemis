import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchDiscoveredCampaigns,
  fetchGlobalNonprofits,
  resolveCampaignLocation,
  type DonationCampaign,
} from '@/data/donationApi';
import { BADGE_RULE, rankFireCampaigns } from '@/data/fireCampaigns';
import { reverseGeocodeAdmin, type AdminArea } from '@/data/locationApi';
import { DonationCard } from '@/components/DonationCard';
import { FireCampaignCard } from '@/components/FireCampaignCard';

interface DonationWidgetProps {
  /** Selected spot: campaigns are matched to its country and region, ranked by distance. */
  lat: number;
  lng: number;
  /** Indonesian province from the archive cell (English name), if known. */
  province: string | null;
  /** Place label for the optional campaign discovery feed. */
  currentLocation: string;
  /** Omit where there is no map to fly to (e.g. the standalone Impact page). */
  onViewLocation?: (latitude: number, longitude: number, zoom: number) => void;
}

/**
 * Impact Hub donation list for the selected spot:
 *  1. groups checked by hand (src/data/fireCampaigns.ts), matched to the spot's country
 *     and province / state, nearest first, with the "Verified by Artemis" badge where
 *     they meet the rule;
 *  2. outside Indonesia, Every.org wildfire nonprofits whose own name or description
 *     names the spot's state or country (no badge: not checked by Artemis);
 *  3. the optional discovery feed when VITE_DONATION_DISCOVERY_URL is set.
 * Scrolls inside its card.
 */
export function DonationWidget({ lat, lng, province, currentLocation, onViewLocation }: DonationWidgetProps) {
  const [admin, setAdmin] = useState<AdminArea | null>(null);
  const [adminState, setAdminState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [everyOrg, setEveryOrg] = useState<DonationCampaign[]>([]);
  const [everyOrgLoading, setEveryOrgLoading] = useState(false);
  const [discovered, setDiscovered] = useState<DonationCampaign[]>([]);

  // Country and state of the spot. An archive province means Indonesia even if the lookup fails.
  useEffect(() => {
    const controller = new AbortController();
    setAdminState('loading');
    reverseGeocodeAdmin(lat, lng, controller.signal)
      .then((a) => {
        setAdmin(a);
        setAdminState('ready');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAdmin(null);
        setAdminState('failed');
      });
    return () => controller.abort();
  }, [lat, lng]);

  // Wait for the lookup: the archive province is a bounding-box guess near borders (e.g. Sarawak).
  const country = adminState === 'loading' ? null : (admin?.countryCode ?? (province ? 'id' : null));
  const region = country === 'id' ? (province ?? admin?.state ?? null) : (admin?.state ?? null);
  const placeName = country === 'id' ? (region ?? 'Indonesia') : [admin?.state, admin?.country].filter(Boolean).join(', ') || 'this area';
  const ranked = useMemo(() => rankFireCampaigns(lat, lng, country, region), [lat, lng, country, region]);
  const localOrgs = ranked.filter((c) => c.inProvince && c.kind === 'organization').length;
  const coveringCampaigns = ranked.filter((c) => c.inProvince && c.kind === 'platform').length;

  // Outside Indonesia: Every.org nonprofits that name this state or country.
  useEffect(() => {
    setEveryOrg([]);
    if (!admin || admin.countryCode === 'id') return;
    const controller = new AbortController();
    setEveryOrgLoading(true);
    fetchGlobalNonprofits([admin.state, admin.country].filter(Boolean).join('|'), controller.signal)
      .then(setEveryOrg)
      .catch(() => !controller.signal.aborted && setEveryOrg([]))
      .finally(() => !controller.signal.aborted && setEveryOrgLoading(false));
    return () => controller.abort();
  }, [admin]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDiscoveredCampaigns(currentLocation, controller.signal)
      .then(setDiscovered)
      .catch(() => !controller.signal.aborted && setDiscovered([]));
    return () => controller.abort();
  }, [currentLocation]);

  const total = ranked.length + everyOrg.length + discovered.length;
  const viewArea = onViewLocation ? (la: number, ln: number) => onViewLocation(la, ln, 9) : undefined;
  const viewCampaign = onViewLocation
    ? async (campaign: DonationCampaign) => {
        const location = await resolveCampaignLocation(campaign);
        onViewLocation(location.latitude, location.longitude, 8);
      }
    : undefined;

  return (
    <section>
      <p className="text-[11px] leading-4 text-white/60">
        {adminState === 'loading' ? (
          'Finding groups that work in this area…'
        ) : localOrgs > 0 ? (
          <>{localOrgs} organization{localOrgs === 1 ? '' : 's'} with sourced fire work in <strong className="font-medium text-white/85">{placeName}</strong>, nearest first{coveringCampaigns > 0 ? ', then campaigns covering it' : ''}.</>
        ) : (
          <>No organization with sourced fire work in <strong className="font-medium text-white/85">{placeName}</strong> yet.{coveringCampaigns > 0 ? ` Showing ${coveringCampaigns} campaign${coveringCampaigns === 1 ? '' : 's'} covering it first, then the nearest groups.` : ranked.length > 0 ? ' Showing the nearest groups.' : ''}</>
        )}
      </p>
      <details className="mt-1.5 text-[11px] leading-4 text-white/60">
        <summary className="cursor-pointer text-white/75 underline decoration-dotted underline-offset-2 hover:text-white">What “Verified by Artemis” means</summary>
        <p className="mt-1">{BADGE_RULE} Checked by hand; sources are linked on every card. Cards without the badge were not checked by Artemis.</p>
      </details>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-white/55">
        {total} option{total === 1 ? '' : 's'}{total > 2 ? ' · scroll for more' : ''}
      </p>
      <div
        className="scroll-fade mt-2 grid max-h-[26rem] gap-3 overflow-y-auto overscroll-contain rounded-[4px] py-2 pr-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-400"
        tabIndex={0}
        role="region"
        aria-label="Donation campaigns"
      >
        {ranked.map((c) => <FireCampaignCard key={c.id} campaign={c} onViewMap={viewArea} />)}
        {(everyOrg.length > 0 || everyOrgLoading) && (
          <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-white/55">On Every.org · names {placeName} · not checked by Artemis</p>
        )}
        {everyOrgLoading && <p className="flex items-center gap-2 text-xs text-white/55"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Searching Every.org…</p>}
        {everyOrg.map((campaign) => <DonationCard key={campaign.id} campaign={campaign} currentLocation={placeName} onViewMap={viewCampaign} />)}
        {discovered.length > 0 && (
          <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-white/55">Automatically discovered · not checked by Artemis</p>
        )}
        {discovered.map((campaign) => <DonationCard key={campaign.id} campaign={campaign} currentLocation={placeName} onViewMap={viewCampaign} />)}
        {adminState !== 'loading' && !everyOrgLoading && total === 0 && (
          <p className="py-4 text-xs leading-5 text-white/60">
            No fire organization or campaign found for {placeName}. Artemis only lists groups it could tie to the affected area.
          </p>
        )}
      </div>
    </section>
  );
}
