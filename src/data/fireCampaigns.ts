// Organizations and campaigns doing fire prevention, firefighting or fire response,
// for the Impact Hub's donation list (Indonesia first; other countries Artemis covers
// where a group could be verified). Every field was checked by hand on
// 14 Nov 2026 against the organization's own website or the campaign page itself
// (sources in docs/u4-campaign-research.md). Social accounts are only the ones the
// organization's own site links to. Nothing here is generated or guessed: when a
// field could not be sourced it is null.
//
// Verified badge rule (shown in the UI):
//   1. the organization's own site, or the campaign page, documents fire work in that area; and
//   2. the donate link goes to the organization's own donate page, or to a platform
//      campaign whose organizer identity the platform verified, or to a registered
//      national zakat body.
import { haversineKm } from '@/lib/geo';

export const BADGE_RULE =
  'Verified by Artemis: the organization’s own site (or the campaign page) documents fire work in this area, and the donate link goes to its own donate channel or to a platform-verified organizer.';

export const CAMPAIGNS_CHECKED = '2026-11-14';

export type SocialPlatform = 'facebook' | 'instagram' | 'x' | 'youtube' | 'tiktok' | 'linkedin';

export interface FireCampaign {
  id: string;
  name: string;
  /** Legal or registered name, when the site states it. */
  legalName: string | null;
  kind: 'organization' | 'platform';
  /** ISO 3166-1 alpha-2 country code, lower case. */
  country: string;
  /** Provinces / states the source names for its fire work or the campaign's coverage (English names). */
  provinces: string[];
  /** Works across the whole country (matches any spot in it). */
  nationwide?: boolean;
  /** Approximate centre of the field work area (null for multi-province platform campaigns). */
  workArea: { label: string; lat: number; lng: number } | null;
  /** What it does about fire, in one line, as the source states it. */
  fireWork: string;
  /** Page that documents the fire work. */
  fireSource: string;
  website: string;
  donateUrl: string | null;
  /** Organizer as shown on a platform campaign page. */
  organizer?: string;
  socials: { platform: SocialPlatform; url: string }[];
  verified: boolean;
  /** Why there is no badge, when verified is false. */
  unverifiedReason?: string;
}

export const FIRE_CAMPAIGNS: FireCampaign[] = [
  {
    id: 'bnf',
    name: 'Borneo Nature Foundation',
    legalName: 'Indonesian registration AHU-000405.AH.01.05',
    kind: 'organization',
    country: 'id',
    provinces: ['Central Kalimantan'],
    workArea: { label: 'Sebangau peat-swamp forest, near Palangka Raya', lat: -2.32, lng: 113.9 },
    fireWork: 'Supports 11 community firefighting and patrol teams protecting the Sebangau peat-swamp forest.',
    fireSource: 'https://borneonaturefoundation.org/firefighting-and-prevention/the-first-fire-has-been-fought/',
    website: 'https://borneonaturefoundation.org/',
    donateUrl: 'https://borneonaturefoundation.org/campaigns/emergency-firefighting-prevention/',
    socials: [
      { platform: 'facebook', url: 'https://www.facebook.com/BorneoNatureFoundation' },
      { platform: 'instagram', url: 'https://www.instagram.com/borneo.nature/' },
      { platform: 'youtube', url: 'https://www.youtube.com/user/OrangutanTrop' },
      { platform: 'linkedin', url: 'https://www.linkedin.com/company/borneo-nature-foundation-international/' },
    ],
    verified: true,
  },
  {
    id: 'bos',
    name: 'BOS Foundation',
    legalName: 'Borneo Orangutan Survival Foundation',
    kind: 'organization',
    country: 'id',
    provinces: ['Central Kalimantan'],
    workArea: { label: 'Nyaru Menteng, Palangka Raya', lat: -2.03, lng: 113.75 },
    fireWork: 'Runs a fire appeal and smoke-protection work around its Nyaru Menteng rehabilitation centre.',
    fireSource: 'https://www.orangutan.or.id/fightfires',
    website: 'https://www.orangutan.or.id/',
    donateUrl: 'https://www.orangutan.or.id/donate',
    socials: [
      { platform: 'facebook', url: 'https://facebook.com/BOSFoundation' },
      { platform: 'instagram', url: 'https://instagram.com/bosfoundation' },
      { platform: 'x', url: 'https://twitter.com/bornean_ou' },
      { platform: 'youtube', url: 'https://youtube.com/channel/UCIKyUhySXh0UBV5iRdWgeww' },
      { platform: 'tiktok', url: 'https://tiktok.com/@bos_foundation' },
    ],
    verified: true,
  },
  {
    id: 'yiari',
    name: 'YIARI (IAR Indonesia)',
    legalName: 'Yayasan Inisiasi Alam Rehabilitasi Indonesia',
    kind: 'organization',
    country: 'id',
    provinces: ['West Kalimantan'],
    workArea: { label: 'Ketapang and Kayong Utara', lat: -1.85, lng: 110.0 },
    fireWork: 'Wildlife rescue and response during the 2026 fires in Ketapang and Kayong Utara, with BKSDA West Kalimantan.',
    fireSource: 'https://yiari.or.id/update-situasi-kebakaran/',
    website: 'https://yiari.or.id/',
    donateUrl: 'https://yiari.or.id/donasi/',
    socials: [
      { platform: 'facebook', url: 'https://www.facebook.com/IARIndonesia' },
      { platform: 'instagram', url: 'https://www.instagram.com/iar_indonesia/' },
      { platform: 'x', url: 'https://twitter.com/IAR_Indonesia' },
      { platform: 'youtube', url: 'https://www.youtube.com/@IARIndonesia' },
    ],
    verified: true,
  },
  {
    id: 'yayasan-palung',
    name: 'Yayasan Palung',
    legalName: null,
    kind: 'organization',
    country: 'id',
    provinces: ['West Kalimantan'],
    workArea: { label: 'Kayong Utara villages near Gunung Palung National Park', lat: -1.25, lng: 110.1 },
    fireWork: 'Joint post-fire patrols across six villages in Kayong Utara (Oct 2026) and village-forest protection.',
    fireSource: 'https://yayasanpalung.com/2026/10/30/sinergi-patroli-gabungan-pasca-karhutla-di-enam-desa-wilayah-kayong-utara/',
    website: 'https://yayasanpalung.com/',
    donateUrl: null,
    socials: [
      { platform: 'facebook', url: 'https://www.facebook.com/Yayasan-Palung-Gunung-Palung-Orangutan-Conservation-Program-280961206284/' },
      { platform: 'tiktok', url: 'https://www.tiktok.com/@yayasan_palung' },
    ],
    verified: false,
    unverifiedReason: 'No donation page on its own site. Follow or contact it directly.',
  },
  {
    id: 'kki-warsi',
    name: 'KKI Warsi',
    legalName: 'Komunitas Konservasi Indonesia WARSI',
    kind: 'organization',
    country: 'id',
    provinces: ['West Sumatra'],
    workArea: { label: 'Karhutla prevention cited on its site', lat: -0.95, lng: 100.35 },
    fireWork: 'Community conservation group based in Jambi; its site cites forest and land fire prevention in West Sumatra.',
    fireSource: 'https://warsi.or.id/',
    website: 'https://warsi.or.id/',
    donateUrl: null,
    socials: [
      { platform: 'facebook', url: 'https://www.facebook.com/warsi.kki' },
      { platform: 'instagram', url: 'https://www.instagram.com/kki_warsi/' },
      { platform: 'x', url: 'https://x.com/KKIWarsi' },
      { platform: 'youtube', url: 'https://www.youtube.com/kkiwarsi' },
    ],
    verified: false,
    unverifiedReason: 'No donation page on its own site. Follow only.',
  },
  {
    id: 'kitabisa-urgentkarhutla',
    name: 'Urgent! Bantu Warga Terdampak Karhutla',
    legalName: null,
    kind: 'platform',
    country: 'id',
    organizer: 'Simpul Setara (identity verified on Kitabisa)',
    provinces: ['West Kalimantan', 'Central Kalimantan', 'South Kalimantan', 'Jambi', 'South Sumatra', 'Papua'],
    workArea: null,
    fireWork: 'Kitabisa campaign for residents affected by forest and land fires in the provinces listed on the page.',
    fireSource: 'https://kitabisa.com/campaign/urgentkarhutla',
    website: 'https://kitabisa.com/campaign/urgentkarhutla',
    donateUrl: 'https://kitabisa.com/campaign/urgentkarhutla',
    socials: [],
    verified: true,
  },
  {
    id: 'kitabisa-patungan-untuk-hutan',
    name: 'Patungan untuk Hutan',
    legalName: null,
    kind: 'platform',
    country: 'id',
    organizer: 'Patungan Untuk Hutan (verified on Kitabisa)',
    provinces: ['Sumatra', 'Kalimantan', 'Papua'],
    workArea: null,
    fireWork: 'Kitabisa forest fund covering Sumatra, Kalimantan and Papua.',
    fireSource: 'https://kitabisa.com/campaign/patunganuntukhutan',
    website: 'https://kitabisa.com/campaign/patunganuntukhutan',
    donateUrl: 'https://kitabisa.com/campaign/patunganuntukhutan',
    socials: [],
    verified: true,
  },
  {
    id: 'rumah-zakat-karhutla',
    name: 'Indonesia Darurat Karhutla',
    legalName: null,
    kind: 'platform',
    country: 'id',
    organizer: 'Rumah Zakat',
    provinces: ['Kalimantan', 'Sumatra', 'Papua'],
    workArea: null,
    fireWork: 'Protective equipment, masks, fuel and supplies for fire volunteers and affected residents; Central, West and South Kalimantan named as worst hit.',
    fireSource: 'https://rumahzakat.org/donasi/Indonesia-Darurat-Karhutla',
    website: 'https://rumahzakat.org/donasi/Indonesia-Darurat-Karhutla',
    donateUrl: 'https://rumahzakat.org/donasi/Indonesia-Darurat-Karhutla',
    socials: [],
    verified: true,
  },
  // ── Outside Indonesia ────────────────────────────────────────────────────────
  {
    id: 'nsw-rfs',
    name: 'NSW Rural Fire Service brigades',
    legalName: 'NSW Rural Fire Service (state agency)',
    kind: 'organization',
    country: 'au',
    provinces: ['New South Wales'],
    workArea: { label: 'Volunteer brigades across NSW', lat: -32.5, lng: 147.0 },
    fireWork: 'Lead agency for bush and grass fires across NSW, with more than 70,000 volunteers; donations go to a local brigade.',
    fireSource: 'https://www.rfs.nsw.gov.au/',
    website: 'https://www.rfs.nsw.gov.au/',
    donateUrl: 'https://www.rfs.nsw.gov.au/volunteer/support-your-local-brigade',
    socials: [
      { platform: 'facebook', url: 'https://www.facebook.com/nswrfs' },
      { platform: 'x', url: 'https://twitter.com/NSWRFS' },
      { platform: 'youtube', url: 'https://www.youtube.com/user/NSWRFS' },
    ],
    verified: true,
  },
  {
    id: 'cfa-victoria',
    name: 'CFA (Country Fire Authority)',
    legalName: 'Country Fire Authority, Victoria',
    kind: 'organization',
    country: 'au',
    provinces: ['Victoria'],
    workArea: { label: 'Volunteer fire brigades across Victoria', lat: -37.0, lng: 144.5 },
    fireWork: 'Fire service for regional Victoria: fire danger periods, permits, preparedness and community fire safety across the state.',
    fireSource: 'https://www.cfa.vic.gov.au/',
    website: 'https://www.cfa.vic.gov.au/',
    donateUrl: 'https://www.cfa.vic.gov.au/about-us/supporting-cfa/donate-to-cfa',
    socials: [
      { platform: 'facebook', url: 'https://www.facebook.com/cfavic/' },
      { platform: 'instagram', url: 'https://www.instagram.com/cfavic' },
      { platform: 'x', url: 'https://twitter.com/CFA_Updates' },
      { platform: 'youtube', url: 'https://www.youtube.com/user/cfavic' },
      { platform: 'linkedin', url: 'https://au.linkedin.com/company/cfavic' },
    ],
    verified: true,
  },
  {
    id: 'canadian-red-cross-bc',
    name: 'Canadian Red Cross · 2026 British Columbia Wildfires Appeal',
    legalName: 'Canadian Red Cross (charity reg. 119219814RR0001)',
    kind: 'organization',
    country: 'ca',
    provinces: ['British Columbia'],
    workArea: { label: 'Wildfire-affected communities in British Columbia', lat: 53.7, lng: -127.6 },
    fireWork: 'Runs the 2026 British Columbia Wildfires Appeal and a guide to wildfire recovery for returning residents.',
    fireSource: 'https://www.redcross.ca/',
    website: 'https://www.redcross.ca/',
    donateUrl: 'https://give.redcross.ca/page/26BCF',
    socials: [
      { platform: 'facebook', url: 'https://www.facebook.com/canadianredcross' },
      { platform: 'instagram', url: 'https://instagram.com/redcrosscanada/' },
      { platform: 'youtube', url: 'https://www.youtube.com/channel/UCrWdm3Wfqpb7BYx0N_zg1rA' },
      { platform: 'tiktok', url: 'https://www.tiktok.com/@redcrosscanada' },
      { platform: 'linkedin', url: 'https://ca.linkedin.com/company/redcrosscanada' },
    ],
    verified: true,
  },
  {
    id: 'ipam',
    name: 'IPAM Amazônia',
    legalName: 'Instituto de Pesquisa Ambiental da Amazônia',
    kind: 'organization',
    country: 'br',
    provinces: ['Mato Grosso', 'Pará'],
    workArea: { label: 'Xingu Indigenous Territory and the Amazon arc of fire', lat: -11.8, lng: -53.3 },
    fireWork: 'Fire research and integrated fire management in the Amazon: smoke monitoring for Indigenous brigades in the Xingu and state fire-management diagnostics.',
    fireSource: 'https://ipam.org.br/apos-seculos-de-manejo-bem-sucedido-regime-de-fogo-no-xingu-esta-mudando/',
    website: 'https://ipam.org.br/',
    donateUrl: 'https://ipam.org.br/doe/',
    socials: [
      { platform: 'facebook', url: 'https://www.facebook.com/IPAMAmazonia/' },
      { platform: 'instagram', url: 'https://www.instagram.com/ipam_amazonia/' },
      { platform: 'x', url: 'https://twitter.com/ipam_amazonia' },
      { platform: 'linkedin', url: 'https://www.linkedin.com/company/ipam-amazonia/' },
    ],
    verified: true,
  },
  {
    id: 'fundacion-bomberos-argentina',
    name: 'Fundación Bomberos de Argentina',
    legalName: null,
    kind: 'organization',
    country: 'ar',
    provinces: ['Río Negro', 'Chubut', 'Neuquén', 'La Pampa', 'Córdoba', 'Corrientes'],
    workArea: { label: 'Volunteer fire brigades in northern Patagonia', lat: -41.5, lng: -69.0 },
    fireWork: 'Equipped more than 200 volunteer firefighters in Chubut, Río Negro, Neuquén and La Pampa for the 2026 Patagonia forest fires (Puentes de la Prevención).',
    fireSource: 'https://fundacionbomberos.org.ar/dona',
    website: 'https://fundacionbomberos.org.ar/',
    donateUrl: 'https://donaronline.org/fundacion-bomberos-de-argentina/colabora-con-fundacion-bomberos-de-argentina',
    socials: [
      { platform: 'facebook', url: 'https://www.facebook.com/FundacionBomberosArg/' },
      { platform: 'instagram', url: 'https://www.instagram.com/bomberosfund/' },
      { platform: 'x', url: 'https://twitter.com/BomberosFund' },
      { platform: 'youtube', url: 'https://www.youtube.com/c/Fundaci%C3%B3nBomberosdeArgentina' },
      { platform: 'linkedin', url: 'https://ar.linkedin.com/company/bomberosfund' },
    ],
    verified: true,
  },
  {
    id: 'gec-malaysia',
    name: 'Global Environment Centre',
    legalName: 'Global Environment Centre (199801016929 / 473058-T)',
    kind: 'organization',
    country: 'my',
    provinces: ['Selangor', 'Pahang', 'Johor', 'Sabah'],
    workArea: { label: 'Raja Musa Forest Reserve peatland, Kuala Selangor', lat: 3.45, lng: 101.25 },
    fireWork: 'Trains and supports community peat-fire prevention patrols (Selangor, Pahang, Johor, Sabah) and runs fire-danger early-warning boards.',
    fireSource: 'https://gec.org.my/news/preventing-peat-fires/',
    website: 'https://gec.org.my/',
    donateUrl: 'https://gec.org.my/donation/',
    socials: [
      { platform: 'facebook', url: 'https://www.facebook.com/globalenvironmentcentre/' },
      { platform: 'instagram', url: 'https://www.instagram.com/globalenvironmentcentre/' },
      { platform: 'x', url: 'https://twitter.com/gectalks' },
      { platform: 'youtube', url: 'https://www.youtube.com/channel/UCFQNBgr41VZ9z5wAQ16cQpA' },
      { platform: 'linkedin', url: 'https://www.linkedin.com/company/global-environment-centre/' },
    ],
    verified: true,
  },
  {
    id: 'tema-turkiye',
    name: 'TEMA Foundation',
    legalName: 'Türkiye Erozyonla Mücadele, Ağaçlandırma ve Doğal Varlıkları Koruma Vakfı',
    kind: 'organization',
    country: 'tr',
    provinces: [],
    nationwide: true,
    workArea: { label: 'Burned forest areas, e.g. İzmir Karabağlar', lat: 38.42, lng: 27.14 },
    fireWork: 'Restores burned forest areas with the General Directorate of Forestry; donated seedlings are monitored for three years.',
    fireSource: 'https://www.tema.org.tr/yanan-orman-alanlarinda-yapilan-calismalar',
    website: 'https://www.tema.org.tr/',
    donateUrl: 'https://www.tema.org.tr/bagislar',
    socials: [
      { platform: 'facebook', url: 'https://www.facebook.com/temavakfi' },
      { platform: 'instagram', url: 'https://www.instagram.com/temavakfi/' },
      { platform: 'x', url: 'https://twitter.com/temavakfi' },
      { platform: 'youtube', url: 'https://www.youtube.com/temavakfi' },
      { platform: 'linkedin', url: 'https://linkedin.com/company/temavakfi' },
    ],
    verified: true,
  },
];

/** Island group for an Indonesian province, so "Kalimantan" / "Sumatra" coverage matches it. */
function islandOf(province: string): string | null {
  const p = province.toLowerCase();
  if (p.includes('kalimantan')) return 'kalimantan';
  if (['riau', 'jambi', 'south sumatra', 'west sumatra', 'north sumatra', 'aceh', 'bengkulu', 'lampung', 'bangka belitung', 'riau islands'].some((s) => p === s)) return 'sumatra';
  if (p.includes('papua')) return 'papua';
  return null;
}

/** Lower case without accents, so "Neuquén Province" matches "Neuquen". */
const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export interface RankedCampaign extends FireCampaign {
  /** Distance from the selected spot to the work-area centre, km (null for platform campaigns). */
  distanceKm: number | null;
  /** Same country and the source names this province / state (or island, or the whole country). */
  inProvince: boolean;
}

/**
 * Orders campaigns for a selected spot, by country first so a fire abroad never gets an
 * Indonesian appeal: organizations in this province / state (nearest first), then
 * campaigns covering it, then same-country organizations elsewhere (within 1,500 km),
 * then the country's other campaigns, then organizations across a border within 300 km.
 */
export function rankFireCampaigns(lat: number, lng: number, country: string | null, province: string | null): RankedCampaign[] {
  const prov = province ? norm(province).replace(/ (province|state|region)$/, '') : '';
  const island = country === 'id' && province ? islandOf(province) : null;
  const ranked = FIRE_CAMPAIGNS.map((c): RankedCampaign => {
    const sameCountry = !!country && c.country === country;
    const named = c.provinces.map(norm);
    const inProvince = sameCountry && (!!c.nationwide || (!!prov && (named.some((n) => n === prov || prov.includes(n)) || (!!island && named.includes(island)))));
    const distanceKm = c.workArea ? haversineKm(lat, lng, c.workArea.lat, c.workArea.lng) : null;
    return { ...c, distanceKm, inProvince };
  });
  const tier = (c: RankedCampaign) => {
    const sameCountry = !!country && c.country === country;
    if (c.kind === 'organization' && c.inProvince) return 0;
    if (c.kind === 'platform' && c.inProvince) return 1;
    if (sameCountry && c.kind === 'organization' && (c.distanceKm ?? Infinity) <= 1500) return 2;
    if (sameCountry && c.kind === 'platform') return 3;
    if (!sameCountry && c.kind === 'organization' && (c.distanceKm ?? Infinity) <= 300) return 4;
    return 9;
  };
  return ranked
    .filter((c) => tier(c) < 9)
    .sort((a, b) => tier(a) - tier(b) || (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || Number(b.verified) - Number(a.verified));
}
