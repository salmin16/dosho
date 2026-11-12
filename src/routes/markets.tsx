import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import IndicativeMineralPrices from '../components/IndicativeMineralPrices';

export const Route = createFileRoute('/markets')({
  component: MarketsPageComponent,
});

function MarketsPageComponent() {
  return (
    <div className="min-h-screen bg-paper pt-[72px] text-ink">
      <IndicativeMineralPrices showHeaderCta />

      {/* Market Structure & Tier Methodology Explainer (Warm Parchment & Laterite Palette) */}
      <section className="border-b border-ink/10 bg-paper-2 px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-2xl">
            <p className="eyebrow mb-3 text-ochre">Pricing Architecture</p>
            <h2 className="font-display text-3xl font-light leading-[1.08] text-ink md:text-4xl">
              How <em className="italic text-ochre">Three-Tier</em> Mineral Valuation Works
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone">
              Every benchmark row on MineConnect aligns global spot exchange parity with statutory Tanzanian trading floors.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <article className="rounded-2xl border border-ink/12 bg-white/85 p-7 transition hover:-translate-y-0.5 hover:border-ochre/40 hover:bg-white">
              <span className="inline-flex rounded-full bg-ink px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-gold">
                Tier 01 · International Spot
              </span>
              <h3 className="font-display mt-4 text-2xl font-medium text-ink">
                World Market Price
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-stone">
                Reflects international refined bullion and LME Grade-A cathode benchmarks (LBMA London Gold/Silver Fix, LME Copper/Tin/Nickel, and FOB Dar es Salaam industrial mineral indices).
              </p>
            </article>

            <article className="rounded-2xl border border-ink/12 bg-white/85 p-7 transition hover:-translate-y-0.5 hover:border-moss/40 hover:bg-white">
              <span className="inline-flex rounded-full border border-moss/30 bg-moss-light px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-moss">
                Tier 02 · Soko la Madini
              </span>
              <h3 className="font-display mt-4 text-2xl font-medium text-ink">
                Mineral Market Benchmark
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-stone">
                Indicative regional trading benchmark at licensed Mineral Markets across Geita, Mwanza, Kahama, Chunya, and Mererani, accounting for statutory royalty (6% metallic / 3% industrial) and 1% clearing inspection fee.
              </p>
            </article>

            <article className="rounded-2xl border border-ink/12 bg-white/85 p-7 transition hover:-translate-y-0.5 hover:border-ochre/40 hover:bg-white">
              <span className="inline-flex rounded-full border border-ochre/30 bg-ochre/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ochre">
                Tier 03 · Kituo cha Ununuzi
              </span>
              <h3 className="font-display mt-4 text-2xl font-medium text-ink">
                Buying Centre Price
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-stone">
                Operational commercial threshold for artisanal and small-scale miners (PML holders) selling unrefined doré or concentrate at licensed regional buying centres prior to smelting and refining.
              </p>
            </article>
          </div>

          <div className="grain relative mt-10 flex flex-col items-start justify-between gap-6 overflow-hidden rounded-2xl border border-ink/15 bg-ink p-7 text-paper sm:flex-row sm:items-center lg:p-9">
            <div className="contours absolute inset-0" aria-hidden="true" />
            <div className="relative flex items-start gap-4">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ochre/20 text-gold">
                <ShieldCheck size={20} />
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-gold">
                  PostgreSQL RLS + Audit Trail
                </span>
                <h4 className="font-display mt-1 text-2xl font-medium text-paper">
                  Administrative Benchmark Governance (`public.mineral_prices`)
                </h4>
                <p className="mt-1 max-w-2xl text-sm text-paper/70">
                  Authorized administrators can update world market, local market, and buying centre rates or trigger a live LBMA/LME sync directly from the Master Control Console.
                </p>
              </div>
            </div>

            <div className="relative flex shrink-0 flex-wrap items-center gap-3">
              <Link to="/admin" className="btn-primary !py-2.5 !px-4 text-xs">
                <SlidersHorizontal size={14} />
                Manage Prices in Admin Console
              </Link>
              <Link
                to="/opportunities"
                className="inline-flex items-center gap-1.5 rounded-md border border-paper/25 bg-paper/10 px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-paper/20"
              >
                Browse Mineral Projects <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
