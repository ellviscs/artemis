import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

// Placeholder for the B2B EUDR & InsurTech compliance portal (Sprint 5).
export function AuditPage() {
  return (
    <div className="min-h-screen bg-[#07090b] text-white/90">
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16 sm:px-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 self-start font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50 hover:text-accent-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Command center
        </Link>
        <div className="terminal-surface rounded-xl p-6">
          <div className="terminal-label flex items-center gap-2 text-xs font-semibold text-accent-400">
            <ShieldCheck className="h-4 w-4" />
            Enterprise EUDR audit
          </div>
          <h1 className="mt-3 font-mono text-2xl font-semibold text-white">20-year zero-burn verification</h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Upload a plot boundary to check its harmonized MODIS + VIIRS burn history since 2000 against the
            EUDR post-2020 zero-burn cutoff. This portal is under construction.
          </p>
        </div>
      </main>
    </div>
  );
}
