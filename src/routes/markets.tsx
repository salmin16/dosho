import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import IndicativeMineralPrices from '../components/IndicativeMineralPrices'
import { useLocalization } from '../context/LocalizationContext'

export const Route = createFileRoute('/markets')({
  component: MarketsPageComponent,
})

function MarketsPageComponent() {
  const { ui, currency, language } = useLocalization()

  return (
    <div
      data-currency={currency}
      data-language={language}
      className="min-h-screen bg-paper pt-[72px] text-ink"
    >
      <IndicativeMineralPrices showHeaderCta={false} />

      {/* Market Structure & Tier Methodology Explainer */}
      <section className="border-b border-ink/10 bg-paper-2 px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-2xl">
            <p className="eyebrow mb-3 text-ochre">
              {ui('Pricing Architecture', 'Mfumo wa Bei Elekezi', 'Arquitectura de Precios')}
            </p>
            <h2 className="font-display text-3xl font-light leading-[1.08] text-ink md:text-4xl">
              {language === 'sw' ? (
                <>
                  Jinsi Mfumo wa <em className="italic text-ochre">Ngazi Tatu</em> za Thamani ya
                  Madini Unavyofanya Kazi
                </>
              ) : language === 'es' ? (
                <>
                  Cómo Funciona la Valoración Mineral de{' '}
                  <em className="italic text-ochre">Tres Niveles</em>
                </>
              ) : (
                <>
                  How <em className="italic text-ochre">Three-Tier</em> Mineral Valuation Works
                </>
              )}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone">
              {ui(
                `Every benchmark row on MineConnect aligns global spot exchange parity with statutory Tanzanian trading floors in ${currency}.`,
                `Kila safu ya bei kwenye MineConnect inaoanisha soko la kimataifa na masoko rasmi ya madini nchini Tanzania kwa sarafu ya ${currency}.`,
                `Cada fila de referencia en MineConnect alinea la paridad internacional con los mercados oficiales de Tanzania en ${currency}.`,
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <article className="rounded-2xl border border-ink/12 bg-white/85 p-7 transition hover:-translate-y-0.5 hover:border-ochre/40 hover:bg-white">
              <span className="inline-flex rounded-full bg-ink px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-gold">
                {ui('Tier 01 · International Spot', 'Ngazi 01 · Soko la Dunia', 'Nivel 01 · Spot Internacional')}
              </span>
              <h3 className="font-display mt-4 text-2xl font-medium text-ink">
                {ui('World Market Price', 'Bei ya Soko la Dunia', 'Precio del Mercado Mundial')}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-stone">
                {ui(
                  'Reflects international refined bullion and LME Grade-A cathode benchmarks (LBMA London Gold/Silver Fix, LME Copper/Tin/Nickel, and FOB Dar es Salaam industrial mineral indices).',
                  'Inaakisi viwango vya kimataifa vya dhahabu na fedha (LBMA London) pamoja na shaba, bati na nikeli (LME) na bei za FOB Dar es Salaam kwa madini ya viwandani.',
                  'Refleja las referencias internacionales de lingotes refinados LBMA y cátodos Grado A de la LME, además de índices FOB Dar es Salaam.',
                )}
              </p>
            </article>

            <article className="rounded-2xl border border-ink/12 bg-white/85 p-7 transition hover:-translate-y-0.5 hover:border-moss/40 hover:bg-white">
              <span className="inline-flex rounded-full border border-moss/30 bg-moss-light px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-moss">
                {ui('Tier 02 · Soko la Madini', 'Ngazi 02 · Soko la Madini', 'Nivel 02 · Soko la Madini')}
              </span>
              <h3 className="font-display mt-4 text-2xl font-medium text-ink">
                {ui('Mineral Market Benchmark', 'Bei ya Soko la Madini', 'Referencia del Mercado Mineral')}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-stone">
                {ui(
                  'Indicative regional trading benchmark at licensed Mineral Markets across Geita, Mwanza, Kahama, Chunya, and Mererani, accounting for statutory royalty (6% metallic / 3% industrial) and 1% clearing inspection fee.',
                  'Bei elekezi katika Masoko ya Madini yaliyosajiliwa Geita, Mwanza, Kahama, Chunya na Mererani baada ya kuzingatia mrabaha wa kisheria (6% metali/vito, 3% viwandani) na ada ya ukaguzi ya 1%.',
                  'Referencia comercial regional en los Mercados de Minerales autorizados en Geita, Mwanza, Kahama, Chunya y Mererani, descontando regalías legales (6% / 3%) y 1% de inspección.',
                )}
              </p>
            </article>

            <article className="rounded-2xl border border-ink/12 bg-white/85 p-7 transition hover:-translate-y-0.5 hover:border-ochre/40 hover:bg-white">
              <span className="inline-flex rounded-full border border-ochre/30 bg-ochre/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ochre">
                {ui('Tier 03 · Kituo cha Ununuzi', 'Ngazi 03 · Kituo cha Ununuzi', 'Nivel 03 · Kituo cha Ununuzi')}
              </span>
              <h3 className="font-display mt-4 text-2xl font-medium text-ink">
                {ui('Buying Centre Price', 'Bei ya Kituo cha Ununuzi', 'Precio en Centro de Compra')}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-stone">
                {ui(
                  'Operational commercial threshold for artisanal and small-scale miners (PML holders) selling unrefined doré or concentrate at licensed regional buying centres prior to smelting and refining.',
                  'Kiwango cha kibiashara kwa wachimbaji wadogo (wenye leseni za PML) wanaouza madini ghafi katika vituo vya ununuzi vilivyoidhinishwa kabla ya uchenjuaji.',
                  'Umbral comercial operativo para mineros artesanales y de pequeña escala (titulares de PML) en centros de compra regionales autorizados.',
                )}
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
                  {ui('PostgreSQL RLS + Audit Trail', 'Usalama wa Hifadhidata ya PostgreSQL', 'PostgreSQL RLS + Auditoría')}
                </span>
                <h4 className="font-display mt-1 text-2xl font-medium text-paper">
                  {ui(
                    'Administrative Benchmark Governance (`public.mineral_prices`)',
                    'Usimamizi wa Bei Elekezi za Madini (`public.mineral_prices`)',
                    'Gobernanza Administrativa de Precios (`public.mineral_prices`)',
                  )}
                </h4>
                <p className="mt-1 max-w-2xl text-sm text-paper/70">
                  {ui(
                    'Authorized administrators can update world market, local market, and buying centre rates or trigger a live LBMA/LME sync directly from the Master Control Console.',
                    'Wasimamizi walioidhinishwa wanaweza kusasisha bei za soko la dunia, soko la madini na vituo vya ununuzi moja kwa moja kutoka kwenye Dashibodi ya Utawala.',
                    'Los administradores autorizados pueden actualizar las tasas mundiales, locales y de centros de compra directamente desde la Consola de Control.',
                  )}
                </p>
              </div>
            </div>

            <div className="relative flex shrink-0 flex-wrap items-center gap-3">
              <Link to="/admin" className="btn-primary !py-2.5 !px-4 text-xs">
                <SlidersHorizontal size={14} />
                {ui('Manage Prices in Admin Console', 'Simamia Bei kwenye Utawala', 'Gestionar Precios en Admin')}
              </Link>
              <Link
                to="/opportunities"
                className="inline-flex items-center gap-1.5 rounded-md border border-paper/25 bg-paper/10 px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-paper/20"
              >
                {ui('Browse Mineral Projects', 'Tazama Miradi ya Madini', 'Explorar Proyectos Mineros')}{' '}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
