// One sourced fire organization or campaign in the Impact Hub's donation list:
// badge (by the written rule), where it works and how far that is, what it does about
// fire with its source, its own social accounts, and a donate or follow action.
import { ArrowUpRight, BadgeCheck, ExternalLink, Facebook, Instagram, Linkedin, MapPin, Music2, Twitter, Youtube } from 'lucide-react';

import { BADGE_RULE, CAMPAIGNS_CHECKED, type RankedCampaign, type SocialPlatform } from '@/data/fireCampaigns';
import { cn } from '@/lib/utils';

const SOCIAL: Record<SocialPlatform, { label: string; Icon: typeof Facebook }> = {
  facebook: { label: 'Facebook', Icon: Facebook },
  instagram: { label: 'Instagram', Icon: Instagram },
  x: { label: 'X', Icon: Twitter },
  youtube: { label: 'YouTube', Icon: Youtube },
  tiktok: { label: 'TikTok', Icon: Music2 },
  linkedin: { label: 'LinkedIn', Icon: Linkedin },
};

function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString('en-US')} km`;
}

export function FireCampaignCard({ campaign: c, onViewMap }: { campaign: RankedCampaign; onViewMap?: (lat: number, lng: number) => void }) {
  const badgeId = `badge-rule-${c.id}`;
  return (
    <article className="rounded-[6px] border border-white/[0.1] bg-white/[0.025] p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-5 text-white/90">{c.name}</h4>
          <p className="mt-0.5 text-[11px] leading-4 text-white/55">
            {c.kind === 'platform' ? c.organizer : (c.legalName ?? 'Organization')}
          </p>
        </div>
        {c.verified ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-[3px] border border-[#6ee7b7]/30 bg-[#6ee7b7]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6ee7b7]"
            title={BADGE_RULE}
            aria-describedby={badgeId}
          >
            <BadgeCheck className="h-3 w-3" /> Verified by Artemis
            <span id={badgeId} className="sr-only">{BADGE_RULE}</span>
          </span>
        ) : null}
      </header>

      <p className="mt-2 flex items-start gap-1.5 font-mono text-[11px] leading-4 text-white/70">
        <MapPin className="mt-px h-3 w-3 shrink-0 text-white/50" />
        {c.workArea ? (
          <span>
            {c.distanceKm !== null && <strong className="font-semibold text-white/90">{formatKm(c.distanceKm)} away · </strong>}
            {c.workArea.label}{c.provinces[0] && !c.workArea.label.includes(c.provinces[0]) ? `, ${c.provinces[0]}` : ''}
          </span>
        ) : (
          <span>Covers {c.provinces.join(', ')}</span>
        )}
      </p>

      <p className="mt-2 text-xs leading-5 text-white/60">
        {c.fireWork}{' '}
        <a href={c.fireSource} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-white/75 underline decoration-white/30 underline-offset-2 hover:text-white">
          Source
        </a>
      </p>

      {!c.verified && c.unverifiedReason && (
        <p className="mt-2 rounded-[4px] border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] leading-4 text-white/60">
          No badge: {c.unverifiedReason}
        </p>
      )}

      {c.socials.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`${c.name} on social media`}>
          {c.socials.map(({ platform, url }) => {
            const { label, Icon } = SOCIAL[platform];
            return (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-[3px] border border-white/[0.12] px-1.5 py-1 text-[10px] text-white/65 transition-colors hover:border-white/30 hover:text-white">
                  <Icon className="h-3 w-3" /> {label}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <div className={cn('mt-3 grid gap-2', c.workArea && onViewMap && 'sm:grid-cols-2')}>
        {c.donateUrl ? (
          <a href={c.donateUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-[4px] bg-accent-500 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-karhutla-smoke transition-colors hover:bg-accent-400">
            Donate {c.kind === 'platform' ? 'on campaign page' : 'directly'} <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        ) : (
          <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-white/[0.18] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-white/80 hover:border-white/35 hover:text-white">
            Visit website <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {c.workArea && onViewMap && (
          <button type="button" onClick={() => onViewMap(c.workArea!.lat, c.workArea!.lng)} className="inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-white/[0.12] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-white/70 hover:bg-white/[0.06] hover:text-white">
            <MapPin className="h-3.5 w-3.5" /> Work area on map
          </button>
        )}
      </div>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-white/45">Checked {CAMPAIGNS_CHECKED}</p>
    </article>
  );
}
