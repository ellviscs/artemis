import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Visible tag for anything that is not a real operational system. */
export function SimTag({ kind = 'Simulated', className }: { kind?: 'Simulated' | 'Demo'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-[2px] border border-[#c4b5fd]/35 bg-[#c4b5fd]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#c4b5fd]',
        className,
      )}
    >
      {kind}
    </span>
  );
}

export function LiveTag({ children = 'Live data' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-[2px] border border-[#6ee7b7]/30 bg-[#6ee7b7]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6ee7b7]">
      {children}
    </span>
  );
}

export function Panel({ title, tag, children, className }: { title: string; tag?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[4px] border border-white/[0.12] bg-[#111111]', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-3 py-2.5">
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/85">{title}</h3>
        {tag}
      </div>
      <div className="px-3 py-3">{children}</div>
    </section>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[12px] leading-5 text-white/60">{children}</p>;
}

export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-accent-500 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-black hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/50';
export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-white/[0.14] px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/75 hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50';
