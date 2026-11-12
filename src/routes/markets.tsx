import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import IndicativeMineralPrices from '../components/IndicativeMineralPrices';

export const Route = createFileRoute('/markets')({
  component: MarketsPageComponent,
});

function MarketsPageComponent() {
  return (
    <div className="min-h-screen bg-slate-950 pt-[72px] text-slate-100">
      <IndicativeMineralPrices showHeaderCta />

      {/* Market Structure & Tier Methodology Explainer */}
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-amber-500/20 bg-slate-900/70 p-6">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-400">
              Tier 1 · International Spot
            </span>
            <h3 className="mt-2 font-display text-xl font-semibold text-white">
              World Market Price
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Reflects international refined bullion and LME Grade-A cathode benchmarks (LBMA London Gold/Silver Fix, LME Copper/Tin/Nickel, and FOB Dar es Salaam industrial mineral indices).
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-slate-900/70 p-6">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Tier 2 · Soko la Madini
            </span>
            <h3 className="mt-2 font-display text-xl font-semibold text-white">
              Mineral Market Benchmark
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Indicative regional trading benchmark at licensed Mineral Markets across Geita, Mwanza, Kahama, Chunya, and Mererani, accounting for statutory royalty (6% metallic / 3% industrial) and 1% clearing inspection fee.
            </p>
          </div>

          <div className="rounded-xl border border-sky-500/20 bg-slate-900/70 p-6">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-sky-400">
              Tier 3 · Kituo cha Ununuzi
            </span>
            <h3 className="mt-2 font-display text-xl font-semibold text-white">
              Buying Centre Price
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Operational commercial threshold for artisanal and small-scale miners (PML holders) selling unrefined doré or concentrate at licensed regional buying centres prior to smelting and refining.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-xl border border-amber-500/25 bg-slate-900/90 p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-amber-400" size={20} />
            <div>
              <h4 className="font-display text-lg font-semibold text-white">
                Administrative Benchmark Governance (`public.mineral_prices`)
              </h4>
              <p className="mt-1 text-xs text-slate-400">
                Authorized administrators can update world market, local market, and buying centre rates or trigger a live LBMA/LME sync directly from the Master Control Console.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
            >
              <SlidersHorizontal size={14} />
              Manage Prices in Admin Console
            </Link>
            <Link
              to="/opportunities"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              Browse Mineral Projects <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
