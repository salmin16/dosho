export interface BriefingTableRow {
  licence: string
  permitted: string
  scaleTenure: string
  transferRule: string
}

export interface BriefingSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
  table?: {
    headers: [string, string, string, string]
    rows: BriefingTableRow[]
  }
}

export interface KnowledgeBriefing {
  id: 'mineral-rights' | 'assay-certificate' | 'jv-structuring'
  number: '01' | '02' | '03'
  category: string
  minutes: number
  title: string
  lead: string
  sections: BriefingSection[]
  takeaways: string[]
  note: string
}

export const KNOWLEDGE_BRIEFINGS: readonly KnowledgeBriefing[] = [
  {
    id: 'mineral-rights',
    number: '01',
    category: 'GUIDE',
    minutes: 7,
    title: 'PML, PL, ML, SML—what each mineral right actually allows',
    lead: 'Understanding Tanzania’s four core mineral-right categories under the Mining Act (Cap. 123) prevents costly misunderstandings during early screening, joint-venture negotiations, and licence due diligence.',
    sections: [
      {
        heading: 'How Tanzania categorises mineral rights',
        paragraphs: [
          'Under Tanzania’s Mining Act (Cap. 123, as amended) and administered by the Mining Commission (Tume ya Madini), mineral rights are separated by operational purpose, capital scale, area ceiling, and ownership eligibility. A right to explore does not grant a right to mine, and a small-scale mining licence carries distinct citizenship rules compared to medium- and large-scale licences.',
        ],
        table: {
          headers: ['Right', 'Permitted Activity', 'Scale & Tenure', 'Key Statutory Rule'],
          rows: [
            {
              licence: 'PML',
              permitted: 'Small-scale mining, extraction & mineral sales via licensed markets',
              scaleTenure: 'Up to 10 ha per licence; 7-year renewable term',
              transferRule: 'Reserved for Tanzanian citizens / 100% citizen-owned entities; convertible to ML',
            },
            {
              licence: 'PL',
              permitted: 'Exploration: mapping, geophysics, trenching & drilling only',
              scaleTenure: 'Up to 300 km²; 4-year initial term + statutory renewals',
              transferRule: 'No commercial extraction or ore sales allowed; Mining Commission consent required for transfer',
            },
            {
              licence: 'ML',
              permitted: 'Medium-scale commercial extraction, processing & export',
              scaleTenure: 'Up to 10 km²; US$100k–US$100M capex; 10-year renewable term',
              transferRule: 'Requires ESIA certificate, feasibility study, Local Content Plan & Commission transfer consent',
            },
            {
              licence: 'SML',
              permitted: 'Large-scale capital-intensive mining & integrated processing',
              scaleTenure: 'Over US$100M capex; life-of-mine up to 25 years (renewable)',
              transferRule: 'Cabinet/Ministerial framework, Mine Development Agreement & statutory 16% Government free-carried interest',
            },
          ],
        },
      },
      {
        heading: 'Primary Mining Licences (PML) vs. Prospecting Licences (PL)',
        paragraphs: [
          'A Primary Mining Licence (PML) is the backbone of Tanzania’s artisanal and small-scale mining sector across Geita, Kahama, Chunya, Mererani, and Singida. It permits active extraction and sale of minerals through licensed Soko la Madini trading floors, but is statutorily restricted to Tanzanian citizens or companies wholly owned by Tanzanian citizens. Foreign capital partners commonly participate through technical-service, equipment-financing, or conversion-to-ML structures rather than direct equity ownership of a raw PML.',
          'By contrast, a Prospecting Licence (PL) is open to both domestic and foreign corporate applicants, but strictly authorises exploration activities—geological mapping, geochemical sampling, geophysics, trenching, and drilling. Removing bulk ore for commercial sale under a PL without an approved bulk-sampling permit is a breach of licence conditions.',
        ],
      },
      {
        heading: 'Mining Licences (ML) and Special Mining Licences (SML)',
        paragraphs: [
          'Once a deposit advances beyond small-scale operations or exploration into defined commercial production, operators apply for a Mining Licence (ML) or Special Mining Licence (SML). Both require a valid Environmental and Social Impact Assessment (ESIA) certificate from NEMC, a bankable or technical feasibility study, a Local Content Plan, and an approved Integrity Pledge.',
          'For SML projects exceeding US$100 million in capital expenditure, Tanzania’s legal framework provides for a minimum 16% non-dilutable free-carried Government shareholding alongside structured royalty, inspection, and corporate tax obligations.',
        ],
      },
      {
        heading: 'Statutory transfers and why a listing is never licence approval',
        paragraphs: [
          'No assignment, transfer, mortgage, or change of control over a PL, ML, or SML takes legal effect without prior written consent from the Mining Commission, confirmation of up-to-date annual rent and royalty compliance, and Tanzania Revenue Authority (TRA) tax clearance.',
          'A project profile or verification badge on MineConnect reflects document screening and structured disclosure at a point in time. It never grants tenure, validates transferability, or replaces an official Mining Cadastre search and independent Tanzanian mining counsel.',
        ],
      },
    ],
    takeaways: [
      'Confirm that the licence category matches the activity being pitched: a PL permits exploration only, never commercial ore sales.',
      'For PML partnerships involving foreign capital, structure compliance early—including the statutory pathway for converting contiguous PMLs into an ML.',
      'Verify licence standing, coordinates, annual rent receipts, and encumbrances directly against Mining Commission cadastre records before paying any deposit.',
      'Treat any assignment or change-of-control agreement as strictly conditional on written Mining Commission consent and TRA tax clearance.',
    ],
    note: 'Editorial Briefing · Informed by the Mining Act (Cap. 123) framework of the United Republic of Tanzania. Always engage qualified Tanzanian legal counsel before executing mineral-right transactions.',
  },
  {
    id: 'assay-certificate',
    number: '02',
    category: 'DUE DILIGENCE',
    minutes: 5,
    title: 'Reading an assay certificate before you sign an NDA',
    lead: 'High headline grades can look compelling in a project teaser, yet an experienced geologist can spot sampling bias, weak chain of custody, or missing QA/QC within five minutes of reviewing the underlying lab certificate.',
    sections: [
      {
        heading: '1. Verify laboratory accreditation and certificate authenticity',
        paragraphs: [
          'Start at the top of the certificate before looking at a single grade number. Reputable mineral assays in East Africa are issued by ISO/IEC 17025 accredited laboratories (such as SGS Mwanza, ALS Geochemistry, Bureau Veritas, or the Geological Survey of Tanzania in Dodoma).',
          'Check for a complete lab letterhead, unique job/batch reference number, date received, date reported, analytical method code, and authorised chemist signature. If a teaser supplies only a re-typed Excel spreadsheet or cropped screenshot without the original PDF certificate, treat the grades as unverified.',
        ],
      },
      {
        heading: '2. Examine sample type: grab vs. channel, trench, or core',
        paragraphs: [
          'The single most common source of misleading grade expectations is confusing selective grab samples with systematic sampling. Picking a single visible-gold quartz cobble from a stockpile can return 25 g/t Au while telling you almost nothing about the average grade across a 1.5-metre mining width.',
        ],
        bullets: [
          'Grab samples: useful only as an early indicator that mineralisation exists—never for tonnage or valuation modelling.',
          'Channel / trench samples: cut continuously across the full width of a mineralised structure perpendicular to strike; far more representative of true width and grade.',
          'RC and diamond drill core: provide down-dip continuity, lithology, and density data required for institutional resource estimation.',
        ],
      },
      {
        heading: '3. Check chain of custody, analytical methods, and detection limits',
        paragraphs: [
          'Ask who collected, bagged, sealed, and delivered the samples to the laboratory. Owner-delivered samples carry higher selection risk than samples collected or witnessed by an independent geologist with tamper-evident tags and dispatch reconciliation.',
          'Match the analytical method to the commodity. For gold, 50g Fire Assay with AAS or ICP finish (and gravimetric finish for over-limit samples above 10 g/t, or metallic screen fire assay for coarse nuggety reef gold) is the institutional standard—not handheld XRF or partial aqua-regia digests. Always inspect lower and upper detection limits so censored values are not misinterpreted.',
        ],
      },
      {
        heading: '4. Look for QA/QC controls and technical red flags',
        paragraphs: [
          'Serious exploration programmes insert Certified Reference Materials (standards), coarse blanks, and field/pulp duplicates into every batch (typically 10–15% of total samples) to monitor analytical accuracy, precision, and lab cross-contamination.',
        ],
        bullets: [
          'Red flag: Missing GPS coordinates, sample widths, or sample-type descriptions accompanying high-grade assay rows.',
          'Red flag: Only 3–5 "best" samples shown out of a larger batch with non-sequential sample IDs (evidence of cherry-picking).',
          'Red flag: Claiming "proven reserves" or multi-million-ounce resources without a JORC, NI 43-101, or SAMREC report signed by a Competent Person.',
        ],
      },
    ],
    takeaways: [
      'Always request the original, uncropped ISO/IEC 17025 lab PDF certificate—never rely solely on transcribed spreadsheets.',
      'Separate selective grab samples from continuous channel, trench, or drill-core assays before assessing grade continuity.',
      'Verify analytical method suitability (e.g., 50g Fire Assay / screen fire assay for reef gold) and confirm over-limit re-assays were completed.',
      'Check for sequential sample IDs, documented chain of custody, and QA/QC standards/blanks before advancing to site-visit spend.',
    ],
    note: 'Technical Due Diligence Briefing · Assay review on MineConnect never constitutes a mineral resource or reserve estimate under JORC, NI 43-101, or SAMREC.',
  },
  {
    id: 'jv-structuring',
    number: '03',
    category: 'DEAL STRUCTURING',
    minutes: 9,
    title: 'Structuring a fair joint venture with a small-scale miner',
    lead: 'Most small-scale mining partnerships fail not because the rock lacks grade, but because equity, capital recovery, statutory obligations, and off-take accounting were left vague on day one.',
    sections: [
      {
        heading: '1. Choose the right commercial structure for the stage',
        paragraphs: [
          'Avoid rushing into a permanent 50/50 split before the geology and metallurgy are proved. Well-structured partnerships match commercial risk to clearly defined technical milestones:',
        ],
        bullets: [
          'Staged Earn-In Joint Venture: The funding partner earns incremental equity (or profit-share) by funding verifiable milestones—mapping, trenching/drilling, pilot plant commissioning, and full-scale ramp-up.',
          'Operating / Tribute Partnership: Appropriate for producing PML sites where the investor supplies plant, dewatering, or working capital in exchange for an agreed production or net-cash-flow split while statutory licence ownership remains compliant.',
          'Preferential Capex Recovery + Production Split: Often 70/30 or 65/35 in favour of the capital provider until audited equipment and development capex is recovered, stepping down to a balanced ongoing operating split thereafter.',
        ],
      },
      {
        heading: '2. Value contributions transparently on both sides',
        paragraphs: [
          'Friction arises quickly when capital partners treat a licence holder’s tenure and local groundwork as "free," or when licence holders underestimate the true cost of mobilisation, fuel, maintenance, and working capital.',
          'Itemise both contributions in an agreed schedule attached to the JV contract: independent valuation or purchase invoices for plant/equipment on the investor side, and licence standing, existing shaft/pit development, surface access agreements, and local operational support on the miner side. Define clearly who owns mobile plant if the venture terminates early.',
        ],
      },
      {
        heading: '3. Assign statutory compliance, local content, and HSE explicitly',
        paragraphs: [
          'Every joint venture must ring-fence statutory obligations before distributing profit. Budget and assign explicit responsibility for annual Mining Commission licence rent, NEMC environmental compliance, occupational health and safety (PPE, shaft timbering, cyanide/tailings controls), local service levy, and community relations.',
          'Where foreign investors partner on a PML cluster, incorporate the statutory conversion-to-ML roadmap upfront so ownership, governance, and export rights remain fully compliant with Tanzanian law.',
        ],
      },
      {
        heading: '4. Anchor settlement accounting to local unit rates (/g, /kg, /ct)',
        paragraphs: [
          'Transparent sales reconciliation is the cornerstone of trust in small-scale mining. Every pour, parcel, or concentrate shipment should be weighed and logged under dual-signatory control and settled against official Soko la Madini / Tume ya Madini sales receipts priced in local statutory units (/g for gold and silver, /kg for copper and industrial concentrates, /ct for gemstones).',
          'Deduct statutory royalty (6% metallic/gemstones, 3% industrial minerals), the 1% clearing & inspection fee, and pre-approved operating costs transparently from gross sales proceeds before computing partner distributions—eliminating off-book side sales and reconciliation disputes.',
        ],
      },
      {
        heading: '5. Write clear governance, default, and exit clauses upfront',
        paragraphs: [
          'Include practical operational controls: dual-signatory bank accounts for capex/opex draws, monthly audited production and cost statements, clear cure periods for missed funding or operational breaches, right of first refusal on transfers, and an enforceable Tanzania arbitration clause so disagreements do not halt mine operations indefinitely.',
        ],
      },
    ],
    takeaways: [
      'Use milestone-based earn-ins or capex-recovery waterfalls rather than unconditioned upfront equity transfers.',
      'Ring-fence Mining Commission rent, royalties (6% / 3%), 1% inspection fee, NEMC, and HSE budgets ahead of partner profit distributions.',
      'Reconcile every mineral sale using dual-signatory logs and official Soko la Madini receipts denominated in local unit rates (/g, /kg, /ct).',
      'Define equipment title, default cure windows, and buyout/exit valuation formulas before mobilising machinery to site.',
    ],
    note: 'Commercial Structuring Briefing · Provided for practical sector guidance only. Formal joint-venture agreements should be drafted and registered with qualified Tanzanian mining and corporate counsel.',
  },
] as const
