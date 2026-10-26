/**
 * Stubbed marketplace data for the MineConnect product surface.
 * Every screen reads from this module so a later milestone can swap it
 * for Netlify Database queries without touching the UI.
 * All listings are illustrative pilot records — not real projects.
 */

export type Mineral =
  | 'Gold'
  | 'Tanzanite'
  | 'Graphite'
  | 'Copper'
  | 'Nickel'
  | 'Diamonds'
  | 'Gemstones'
  | 'Coal'
  | 'Limestone'
  | 'Rare Earths'

export type OpportunityType =
  | 'Licence / rights opportunity'
  | 'Existing mine seeking investment'
  | 'Joint venture'
  | 'Exploration opportunity'
  | 'Mine seeking partner'
  | 'Equipment / project financing'
  | 'Processing opportunity'
  | 'Processing facility'

export type ProjectStage =
  | 'Greenfield'
  | 'Early exploration'
  | 'Advanced exploration'
  | 'Pilot production'
  | 'Producing'

export type LicenceType = 'PML' | 'PL' | 'ML' | 'SML' | 'Processing Licence'

export type VerificationLevel = 0 | 1 | 2 | 3 | 4

export interface VerificationRecord {
  level: VerificationLevel
  checkedOn: string
  checkedBy: string
  scope: string[]
  notVerified: string[]
}

export interface Project {
  id: string
  title: string
  minerals: Mineral[]
  type: OpportunityType
  transactionStatus: string
  region: string
  district: string
  lat: number
  lng: number
  locationDisclosure: 'Approximate' | 'Exact on NDA'
  licence: {
    type: LicenceType
    reference: string
    status: 'Active' | 'Renewal pending' | 'Application stage'
    issued: string
    expires: string
  }
  areaHa: number
  stage: ProjectStage
  summary: string
  highlights: string[]
  evidence: { label: string; detail: string }[]
  infrastructure: { access: string; power: string; water: string }
  investmentUsd: number
  askingPriceUsd?: number
  dealTypes: string[]
  documents: { name: string; kind: string; access: 'Public' | 'On request' | 'Deal room' }[]
  verification: VerificationRecord
  owner: { name: string; kind: string; memberSince: string }
  image: string
  featured?: boolean
  listedOn: string
  updatedOn: string
  enquiries: number
}

export const MINERALS: Mineral[] = [
  'Gold',
  'Tanzanite',
  'Graphite',
  'Copper',
  'Nickel',
  'Diamonds',
  'Gemstones',
  'Coal',
  'Limestone',
  'Rare Earths',
]

export const OPPORTUNITY_TYPES: OpportunityType[] = [
  'Licence / rights opportunity',
  'Existing mine seeking investment',
  'Joint venture',
  'Exploration opportunity',
  'Mine seeking partner',
  'Equipment / project financing',
  'Processing opportunity',
  'Processing facility',
]

export const STAGES: ProjectStage[] = [
  'Greenfield',
  'Early exploration',
  'Advanced exploration',
  'Pilot production',
  'Producing',
]

export const REGIONS = [
  'Geita',
  'Mara',
  'Shinyanga',
  'Manyara',
  'Arusha',
  'Morogoro',
  'Lindi',
  'Mtwara',
  'Ruvuma',
  'Mbeya',
  'Songwe',
  'Katavi',
  'Tanga',
  'Singida',
  'Dodoma',
  'Kigoma',
] as const

export const INVESTMENT_BANDS = [
  { id: 'lt250k', label: 'Under US$250k', min: 0, max: 250_000 },
  { id: '250k-1m', label: 'US$250k – 1M', min: 250_000, max: 1_000_000 },
  { id: '1m-5m', label: 'US$1M – 5M', min: 1_000_000, max: 5_000_000 },
  { id: 'gt5m', label: 'Over US$5M', min: 5_000_000, max: Infinity },
] as const

export const VERIFICATION_LEVELS: {
  level: VerificationLevel
  name: string
  short: string
  description: string
  checks: string[]
  notCovered: string
}[] = [
  {
    level: 0,
    name: 'Unverified',
    short: 'Self-declared',
    description: 'Information supplied by the project owner and not yet independently checked.',
    checks: ['Mandatory moderation for prohibited claims', 'Duplicate-listing screening'],
    notCovered: 'Identity, licence status and technical claims are unchecked.',
  },
  {
    level: 1,
    name: 'Identity & Documents',
    short: 'KYC checked',
    description: 'The submitting individual or company and basic supporting documents have been checked.',
    checks: ['Owner identity / company registration', 'Authorised representative', 'Basic document completeness'],
    notCovered: 'Licence standing and geological evidence are not reviewed.',
  },
  {
    level: 2,
    name: 'Licence Record Check',
    short: 'Licence checked',
    description: 'Available licence or right information is checked against appropriate authoritative records or documents.',
    checks: ['Licence reference & holder match', 'Status, issue and expiry dates', 'Area / coordinates consistency'],
    notCovered: 'Does not confirm transferability or licensing-authority consent.',
  },
  {
    level: 3,
    name: 'Technical Review',
    short: 'Technically reviewed',
    description: 'A qualified professional has reviewed the supplied technical evidence — sampling, assays and reports.',
    checks: ['Sampling & assay chain of custody', 'Laboratory certificates', 'Consistency of technical reports'],
    notCovered: 'This is not a mineral-resource estimate or a guarantee of grade.',
  },
  {
    level: 4,
    name: 'Site & Due Diligence',
    short: 'Site visited',
    description: 'Site visit and/or specialist due diligence has been commissioned and completed for a client.',
    checks: ['Independent site visit', 'Community & access observations', 'Specialist due-diligence report'],
    notCovered: 'Findings are point-in-time and do not replace your own legal and technical advice.',
  },
]

export const PROJECTS: Project[] = [
  {
    id: 'MC-GE-0142',
    title: 'Nyakabale Reef Gold Project',
    minerals: ['Gold'],
    type: 'Existing mine seeking investment',
    transactionStatus: 'Open to investment — no transfer of rights proposed',
    region: 'Geita',
    district: 'Geita DC',
    lat: -2.83,
    lng: 32.15,
    locationDisclosure: 'Approximate',
    licence: { type: 'PML', reference: 'PML 00••••/LZW', status: 'Active', issued: '2022-03-14', expires: '2029-03-13' },
    areaHa: 9.8,
    stage: 'Pilot production',
    summary:
      'A cluster of three contiguous primary mining licences on a quartz-reef system in the Lake Victoria Goldfields. The owners operate a small shaft and a 4-tonne-per-day CIL pilot circuit and are seeking capital to deepen the shaft and expand processing.',
    highlights: ['Three contiguous PMLs', 'Pilot CIL circuit on site', 'Monthly production records since 2023'],
    evidence: [
      { label: 'Assays', detail: '42 channel samples, SGS Mwanza certificates supplied' },
      { label: 'Production', detail: '18 months of mineral-office sales receipts' },
      { label: 'Mapping', detail: 'Surface reef mapping, 1:2,000' },
    ],
    infrastructure: { access: 'All-weather gravel, 14 km to Geita town', power: 'TANESCO line 2 km; diesel gensets on site', water: 'Borehole + seasonal dam' },
    investmentUsd: 1_850_000,
    dealTypes: ['Equity partnership', 'Equipment financing'],
    documents: [
      { name: 'Project teaser', kind: 'PDF · 6 pp', access: 'Public' },
      { name: 'Licence copies (redacted)', kind: 'PDF · 3 files', access: 'On request' },
      { name: 'Assay certificates', kind: 'PDF · 42 samples', access: 'Deal room' },
      { name: 'Production ledger 2023–2026', kind: 'XLSX', access: 'Deal room' },
    ],
    verification: {
      level: 3,
      checkedOn: '2026-08-21',
      checkedBy: 'Registered geologist (MineConnect verification panel)',
      scope: ['Owner identity & company registration', 'Licence status against supplied records', 'Assay certificates & sampling methodology'],
      notVerified: ['Mineral resource or reserve', 'Future production rates', 'Site conditions (no site visit)'],
    },
    owner: { name: 'Nyakabale Mining Group Ltd', kind: 'Medium-scale operator', memberSince: '2026' },
    image: 'gold',
    featured: true,
    listedOn: '2026-08-02',
    updatedOn: '2026-09-28',
    enquiries: 23,
  },
  {
    id: 'MC-MY-0087',
    title: 'Mererani Block D Tanzanite Partnership',
    minerals: ['Tanzanite'],
    type: 'Mine seeking partner',
    transactionStatus: 'Seeking operating partner — subject to licensing-authority consent where required',
    region: 'Manyara',
    district: 'Simanjiro',
    lat: -3.56,
    lng: 36.99,
    locationDisclosure: 'Exact on NDA',
    licence: { type: 'PML', reference: 'PML 00••••/ARS', status: 'Active', issued: '2021-11-02', expires: '2028-11-01' },
    areaHa: 4.2,
    stage: 'Producing',
    summary:
      'An active underground tanzanite working inside the controlled Mererani mining area. The holder seeks a technical and financial partner to mechanise haulage, improve ventilation and formalise grading and sales.',
    highlights: ['Inside the Mererani controlled area', 'Active underground workings', 'Formal sales via the Mererani trading centre'],
    evidence: [
      { label: 'Sales', detail: 'Trading-centre sales records, 2024–2026' },
      { label: 'Workings', detail: 'Underground plan & level survey' },
    ],
    infrastructure: { access: 'Tarmac to Mererani, 60 km from Arusha', power: 'Grid connected', water: 'Trucked supply' },
    investmentUsd: 950_000,
    dealTypes: ['Joint venture', 'Operating partnership'],
    documents: [
      { name: 'Project overview', kind: 'PDF · 4 pp', access: 'Public' },
      { name: 'Underground plan', kind: 'DWG + PDF', access: 'Deal room' },
      { name: 'Sales records', kind: 'PDF', access: 'Deal room' },
    ],
    verification: {
      level: 2,
      checkedOn: '2026-07-30',
      checkedBy: 'MineConnect compliance officer',
      scope: ['Owner identity', 'Licence reference, holder and expiry'],
      notVerified: ['Technical evidence', 'Sales volumes', 'Transferability of the licence'],
    },
    owner: { name: 'Simanjiro Gem Miners Cooperative', kind: 'Small-scale miners’ cooperative', memberSince: '2026' },
    image: 'tanzanite',
    featured: true,
    listedOn: '2026-07-11',
    updatedOn: '2026-09-15',
    enquiries: 31,
  },
  {
    id: 'MC-LI-0219',
    title: 'Ruangwa North Graphite Exploration',
    minerals: ['Graphite'],
    type: 'Exploration opportunity',
    transactionStatus: 'Farm-in / earn-in discussions invited',
    region: 'Lindi',
    district: 'Ruangwa',
    lat: -10.05,
    lng: 38.95,
    locationDisclosure: 'Approximate',
    licence: { type: 'PL', reference: 'PL 1••••/2024', status: 'Active', issued: '2024-02-19', expires: '2028-02-18' },
    areaHa: 4_870,
    stage: 'Advanced exploration',
    summary:
      'Prospecting licence covering a graphitic schist belt along strike from producing operations in the Ruangwa district. Trenching and an initial 1,200 m diamond drill programme have been completed.',
    highlights: ['1,200 m diamond drilling complete', 'Along strike from producing operations', 'Flake-size metallurgy test-work underway'],
    evidence: [
      { label: 'Drilling', detail: '14 holes, logged core & photography' },
      { label: 'Geophysics', detail: 'Ground EM survey, 2025' },
      { label: 'Lab', detail: 'TGC assays, ALS certificates' },
    ],
    infrastructure: { access: 'Gravel road to Ruangwa; Mtwara port 220 km', power: 'Off-grid', water: 'Seasonal river; boreholes planned' },
    investmentUsd: 3_400_000,
    dealTypes: ['Earn-in', 'Joint venture'],
    documents: [
      { name: 'Technical summary', kind: 'PDF · 22 pp', access: 'On request' },
      { name: 'Drill logs & core photos', kind: 'ZIP', access: 'Deal room' },
      { name: 'EM survey report', kind: 'PDF', access: 'Deal room' },
    ],
    verification: {
      level: 4,
      checkedOn: '2026-09-04',
      checkedBy: 'Independent consulting geologist, commissioned by investor',
      scope: ['KYC & company records', 'Licence records', 'Core review & QA/QC', 'Site visit (2 days)'],
      notVerified: ['JORC/NI 43-101 compliant resource', 'Offtake terms'],
    },
    owner: { name: 'Lindi Graphite Resources Ltd', kind: 'Exploration company', memberSince: '2026' },
    image: 'graphite',
    featured: true,
    listedOn: '2026-06-18',
    updatedOn: '2026-10-01',
    enquiries: 17,
  },
  {
    id: 'MC-KT-0063',
    title: 'Mpanda Copper–Silver Prospect',
    minerals: ['Copper'],
    type: 'Joint venture',
    transactionStatus: 'JV partner sought for drilling phase',
    region: 'Katavi',
    district: 'Mpanda',
    lat: -6.35,
    lng: 31.05,
    locationDisclosure: 'Approximate',
    licence: { type: 'PL', reference: 'PL 1••••/2023', status: 'Renewal pending', issued: '2023-05-09', expires: '2026-12-08' },
    areaHa: 2_150,
    stage: 'Early exploration',
    summary:
      'Historic copper-silver workings within a sediment-hosted belt. Soil geochemistry outlines a 2.4 km anomaly. The holder seeks a partner to fund a maiden drilling programme.',
    highlights: ['Historic workings on licence', '2.4 km soil anomaly', 'Drill targets defined'],
    evidence: [
      { label: 'Geochem', detail: '610 soil samples' },
      { label: 'Mapping', detail: 'Regional mapping & historic reports' },
    ],
    infrastructure: { access: 'Gravel, 30 km from Mpanda', power: 'Off-grid', water: 'River adjacent' },
    investmentUsd: 750_000,
    dealTypes: ['Joint venture', 'Earn-in'],
    documents: [
      { name: 'Prospect teaser', kind: 'PDF', access: 'Public' },
      { name: 'Soil geochem dataset', kind: 'CSV', access: 'Deal room' },
    ],
    verification: {
      level: 1,
      checkedOn: '2026-09-12',
      checkedBy: 'MineConnect onboarding team',
      scope: ['Owner identity', 'Document completeness'],
      notVerified: ['Licence status', 'Technical claims'],
    },
    owner: { name: 'Katavi Minerals Exploration', kind: 'Project holder', memberSince: '2026' },
    image: 'copper',
    listedOn: '2026-09-10',
    updatedOn: '2026-09-22',
    enquiries: 6,
  },
  {
    id: 'MC-SH-0155',
    title: 'Kahama Gold Tailings Re-processing Plant',
    minerals: ['Gold'],
    type: 'Processing opportunity',
    transactionStatus: 'Seeking project finance for plant expansion',
    region: 'Shinyanga',
    district: 'Kahama',
    lat: -3.83,
    lng: 32.6,
    locationDisclosure: 'Approximate',
    licence: { type: 'Processing Licence', reference: 'PCL ••••/SHY', status: 'Active', issued: '2023-08-01', expires: '2028-07-31' },
    areaHa: 12,
    stage: 'Producing',
    summary:
      'A licensed processing facility treating artisanal tailings under offtake agreements with surrounding small-scale miners. Expansion from 40 to 120 tonnes per day is planned.',
    highlights: ['Licensed processing facility', 'Supply agreements with 60+ miners', 'Environmental management plan in place'],
    evidence: [
      { label: 'Operations', detail: 'Plant throughput records' },
      { label: 'Environment', detail: 'Approved EMP & monitoring reports' },
    ],
    infrastructure: { access: 'Tarmac, 8 km from Kahama', power: 'Grid connected', water: 'Recycled process water + borehole' },
    investmentUsd: 2_600_000,
    dealTypes: ['Project finance', 'Equipment financing', 'Equity'],
    documents: [
      { name: 'Expansion business plan', kind: 'PDF · 31 pp', access: 'On request' },
      { name: 'Financial statements', kind: 'PDF', access: 'Deal room' },
    ],
    verification: {
      level: 2,
      checkedOn: '2026-08-08',
      checkedBy: 'MineConnect compliance officer',
      scope: ['Company records', 'Processing licence record'],
      notVerified: ['Financial statements', 'Throughput claims'],
    },
    owner: { name: 'Kahama Recovery Works Ltd', kind: 'Processor', memberSince: '2026' },
    image: 'copper',
    listedOn: '2026-05-21',
    updatedOn: '2026-09-02',
    enquiries: 12,
  },
  {
    id: 'MC-MO-0111',
    title: 'Ulanga Ruby & Spinel Gemstone Claims',
    minerals: ['Gemstones'],
    type: 'Licence / rights opportunity',
    transactionStatus: 'Assignment offered — subject to statutory process & consent',
    region: 'Morogoro',
    district: 'Ulanga',
    lat: -8.6,
    lng: 36.68,
    locationDisclosure: 'Approximate',
    licence: { type: 'PML', reference: 'PML 00••••/MRG', status: 'Active', issued: '2023-01-17', expires: '2030-01-16' },
    areaHa: 18.5,
    stage: 'Pilot production',
    summary:
      'Two PMLs over alluvial and eluvial gemstone gravels. Hand-mining has recovered ruby and spinel. The holders are open to an assignment or partnership, subject to the statutory transfer process.',
    highlights: ['Two PMLs', 'Recovered ruby & spinel parcels', 'Community agreements documented'],
    evidence: [{ label: 'Recoveries', detail: 'Gemmological reports on sample parcels' }],
    infrastructure: { access: 'Seasonal track, 4x4 required', power: 'None', water: 'River' },
    investmentUsd: 220_000,
    askingPriceUsd: 180_000,
    dealTypes: ['Assignment of rights', 'Partnership'],
    documents: [{ name: 'Overview', kind: 'PDF', access: 'Public' }],
    verification: {
      level: 0,
      checkedOn: '2026-09-30',
      checkedBy: 'Moderation only',
      scope: ['Prohibited-claims moderation'],
      notVerified: ['Identity', 'Licence', 'Technical evidence'],
    },
    owner: { name: 'Private holder', kind: 'Small-scale miner', memberSince: '2026' },
    image: 'tanzanite',
    listedOn: '2026-09-29',
    updatedOn: '2026-09-30',
    enquiries: 2,
  },
  {
    id: 'MC-MA-0098',
    title: 'Nyamongo Fringe Gold Licences',
    minerals: ['Gold'],
    type: 'Licence / rights opportunity',
    transactionStatus: 'Partnership preferred; transfer only via statutory process',
    region: 'Mara',
    district: 'Tarime',
    lat: -1.4,
    lng: 34.55,
    locationDisclosure: 'Approximate',
    licence: { type: 'PML', reference: 'PML 00••••/MSM', status: 'Active', issued: '2022-06-30', expires: '2029-06-29' },
    areaHa: 30,
    stage: 'Early exploration',
    summary:
      'Contiguous PMLs in the Mara greenstone belt with artisanal pitting along a sheared contact. Initial grab sampling and pit mapping completed.',
    highlights: ['Mara greenstone belt', 'Artisanal pitting along shear', 'Road access year-round'],
    evidence: [{ label: 'Sampling', detail: '25 grab samples (indicative only)' }],
    infrastructure: { access: 'Gravel, 22 km from Tarime', power: 'Grid within 5 km', water: 'Borehole' },
    investmentUsd: 420_000,
    dealTypes: ['Partnership', 'Joint venture'],
    documents: [{ name: 'Teaser', kind: 'PDF', access: 'Public' }],
    verification: {
      level: 1,
      checkedOn: '2026-09-18',
      checkedBy: 'MineConnect onboarding team',
      scope: ['Identity', 'Document completeness'],
      notVerified: ['Licence status', 'Technical claims'],
    },
    owner: { name: 'Mara Highlands Miners', kind: 'Small-scale miners’ group', memberSince: '2026' },
    image: 'gold',
    listedOn: '2026-09-16',
    updatedOn: '2026-09-25',
    enquiries: 8,
  },
  {
    id: 'MC-RV-0071',
    title: 'Mbinga Thermal Coal Supply Partnership',
    minerals: ['Coal'],
    type: 'Equipment / project financing',
    transactionStatus: 'Equipment finance sought',
    region: 'Ruvuma',
    district: 'Mbinga',
    lat: -10.95,
    lng: 35.0,
    locationDisclosure: 'Approximate',
    licence: { type: 'ML', reference: 'ML •••/2021', status: 'Active', issued: '2021-04-22', expires: '2031-04-21' },
    areaHa: 640,
    stage: 'Producing',
    summary:
      'A mining-licence holder supplying regional cement and industrial customers. Seeking finance for an additional excavator fleet and haul trucks under existing supply contracts.',
    highlights: ['Mining Licence (ML)', 'Signed industrial supply contracts', 'Fleet expansion plan'],
    evidence: [{ label: 'Commercial', detail: 'Supply contracts (redacted)' }],
    infrastructure: { access: 'Gravel to Songea–Mbinga road', power: 'Diesel', water: 'Boreholes' },
    investmentUsd: 1_200_000,
    dealTypes: ['Equipment financing', 'Lease'],
    documents: [{ name: 'Equipment schedule', kind: 'XLSX', access: 'On request' }],
    verification: {
      level: 2,
      checkedOn: '2026-06-28',
      checkedBy: 'MineConnect compliance officer',
      scope: ['Company records', 'Licence record'],
      notVerified: ['Contract values', 'Coal quality'],
    },
    owner: { name: 'Ruvuma Energy Minerals Ltd', kind: 'Mining company', memberSince: '2026' },
    image: 'copper',
    listedOn: '2026-06-02',
    updatedOn: '2026-08-30',
    enquiries: 9,
  },
  {
    id: 'MC-SW-0130',
    title: 'Chunya Alluvial Gold Mechanisation',
    minerals: ['Gold'],
    type: 'Existing mine seeking investment',
    transactionStatus: 'Equity or equipment partnership',
    region: 'Songwe',
    district: 'Songwe',
    lat: -8.25,
    lng: 33.15,
    locationDisclosure: 'Approximate',
    licence: { type: 'PML', reference: 'PML 00••••/MBY', status: 'Active', issued: '2024-03-03', expires: '2031-03-02' },
    areaHa: 9.6,
    stage: 'Pilot production',
    summary:
      'Alluvial gold operation in the Lupa goldfield using a small wash plant. Investment sought to install a modular gravity circuit and improve recovery and water management.',
    highlights: ['Lupa goldfield', 'Wash plant operating', 'Gravity circuit upgrade planned'],
    evidence: [{ label: 'Production', detail: 'Mineral-office receipts, 12 months' }],
    infrastructure: { access: 'Gravel, 35 km from Chunya', power: 'Diesel', water: 'Recycling ponds' },
    investmentUsd: 380_000,
    dealTypes: ['Equity', 'Equipment financing'],
    documents: [{ name: 'Teaser', kind: 'PDF', access: 'Public' }],
    verification: {
      level: 3,
      checkedOn: '2026-08-30',
      checkedBy: 'Registered mining engineer (verification panel)',
      scope: ['KYC', 'Licence record', 'Production records & plant design review'],
      notVerified: ['Resource estimate', 'Site conditions'],
    },
    owner: { name: 'Lupa Valley Mining Co.', kind: 'Small-scale operator', memberSince: '2026' },
    image: 'gold',
    listedOn: '2026-08-12',
    updatedOn: '2026-09-20',
    enquiries: 14,
  },
  {
    id: 'MC-TN-0044',
    title: 'Handeni Limestone & Industrial Minerals',
    minerals: ['Limestone'],
    type: 'Joint venture',
    transactionStatus: 'JV with construction-materials producer sought',
    region: 'Tanga',
    district: 'Handeni',
    lat: -5.45,
    lng: 38.05,
    locationDisclosure: 'Approximate',
    licence: { type: 'PL', reference: 'PL 1••••/2025', status: 'Active', issued: '2025-01-20', expires: '2029-01-19' },
    areaHa: 1_420,
    stage: 'Advanced exploration',
    summary:
      'High-calcium limestone outcrops near the Tanga cement corridor with chemical analyses completed. Suitable for cement, lime and agricultural-lime applications.',
    highlights: ['Near Tanga cement corridor', 'Chemistry test-work complete', 'Rail & port access'],
    evidence: [{ label: 'Lab', detail: 'XRF analyses, 80 samples' }],
    infrastructure: { access: 'Tarmac 12 km', power: 'Grid 3 km', water: 'Borehole' },
    investmentUsd: 5_800_000,
    dealTypes: ['Joint venture', 'Offtake partnership'],
    documents: [{ name: 'Technical summary', kind: 'PDF', access: 'On request' }],
    verification: {
      level: 2,
      checkedOn: '2026-07-14',
      checkedBy: 'MineConnect compliance officer',
      scope: ['Company records', 'Licence record'],
      notVerified: ['Laboratory results'],
    },
    owner: { name: 'Handeni Industrial Minerals Ltd', kind: 'Project holder', memberSince: '2026' },
    image: 'graphite',
    listedOn: '2026-07-01',
    updatedOn: '2026-09-05',
    enquiries: 5,
  },
  {
    id: 'MC-SH-0170',
    title: 'Maganzo Kimberlite Field Partnership',
    minerals: ['Diamonds'],
    type: 'Mine seeking partner',
    transactionStatus: 'Technical partner sought',
    region: 'Shinyanga',
    district: 'Kishapu',
    lat: -3.55,
    lng: 33.65,
    locationDisclosure: 'Exact on NDA',
    licence: { type: 'PML', reference: 'PML 00••••/SHY', status: 'Active', issued: '2023-10-09', expires: '2030-10-08' },
    areaHa: 9.9,
    stage: 'Early exploration',
    summary:
      'Small-scale licences over gravels in the Maganzo area of the Shinyanga kimberlite field. Seeking a technical partner with bulk-sampling and DMS capability.',
    highlights: ['Kimberlite field setting', 'Gravel bulk-sample planned', 'Community MoU'],
    evidence: [{ label: 'Recoveries', detail: 'Artisanal recovery records (unverified)' }],
    infrastructure: { access: 'Gravel, 20 km from Kishapu', power: 'None', water: 'Seasonal' },
    investmentUsd: 600_000,
    dealTypes: ['Partnership', 'Technical services for equity'],
    documents: [{ name: 'Overview', kind: 'PDF', access: 'Public' }],
    verification: {
      level: 1,
      checkedOn: '2026-09-01',
      checkedBy: 'MineConnect onboarding team',
      scope: ['Identity'],
      notVerified: ['Licence', 'Recoveries'],
    },
    owner: { name: 'Maganzo Miners Association', kind: 'Small-scale miners’ association', memberSince: '2026' },
    image: 'graphite',
    listedOn: '2026-08-28',
    updatedOn: '2026-09-10',
    enquiries: 4,
  },
  {
    id: 'MC-MB-0182',
    title: 'Mbeya Rare-Earth Carbonatite Exploration',
    minerals: ['Rare Earths'],
    type: 'Exploration opportunity',
    transactionStatus: 'Earn-in partner sought',
    region: 'Mbeya',
    district: 'Mbeya DC',
    lat: -8.95,
    lng: 33.6,
    locationDisclosure: 'Approximate',
    licence: { type: 'PL', reference: 'PL 1••••/2025', status: 'Active', issued: '2025-06-11', expires: '2029-06-10' },
    areaHa: 6_300,
    stage: 'Early exploration',
    summary:
      'Prospecting licence covering a mapped carbonatite complex with radiometric anomalies. Rock-chip sampling has returned elevated TREO values; drilling not yet undertaken.',
    highlights: ['Mapped carbonatite complex', 'Airborne radiometric anomaly', 'Critical-minerals focus'],
    evidence: [
      { label: 'Geophysics', detail: 'Airborne radiometrics (licensed dataset)' },
      { label: 'Sampling', detail: '64 rock-chip samples' },
    ],
    infrastructure: { access: 'Gravel 18 km from Mbeya', power: 'Grid 6 km', water: 'Streams' },
    investmentUsd: 2_100_000,
    dealTypes: ['Earn-in', 'Equity'],
    documents: [{ name: 'Technical memo', kind: 'PDF', access: 'On request' }],
    verification: {
      level: 3,
      checkedOn: '2026-09-19',
      checkedBy: 'Registered geologist (verification panel)',
      scope: ['KYC', 'Licence record', 'Sampling QA/QC & lab certificates'],
      notVerified: ['Metallurgy', 'Resource'],
    },
    owner: { name: 'Southern Highlands Critical Minerals', kind: 'Exploration company', memberSince: '2026' },
    image: 'graphite',
    featured: true,
    listedOn: '2026-09-20',
    updatedOn: '2026-10-03',
    enquiries: 11,
  },
]

export interface ServiceProvider {
  id: string
  name: string
  category: string
  location: string
  summary: string
  services: string[]
  verified: boolean
  rating: number
  reviews: number
  responseTime: string
  initials: string
}

export const SERVICE_CATEGORIES = [
  'Geology & exploration',
  'Laboratories',
  'Drilling & blasting',
  'Surveying & GIS',
  'Environmental & social',
  'Legal & advisory',
  'Equipment & suppliers',
  'Processing & metallurgy',
] as const

export const SERVICE_PROVIDERS: ServiceProvider[] = [
  {
    id: 'sp-01',
    name: 'Lake Zone Geoscience',
    category: 'Geology & exploration',
    location: 'Mwanza',
    summary: 'Registered geologists for mapping, sampling programmes and technical reporting across the Lake Victoria Goldfields.',
    services: ['Geological mapping', 'Sampling design', 'Technical reports'],
    verified: true,
    rating: 4.9,
    reviews: 38,
    responseTime: '< 24 h',
    initials: 'LZ',
  },
  {
    id: 'sp-02',
    name: 'Mwanza Assay Laboratory',
    category: 'Laboratories',
    location: 'Mwanza',
    summary: 'Fire assay, AAS and ICP analysis with chain-of-custody documentation suitable for investor review.',
    services: ['Fire assay', 'ICP-OES', 'Sample prep'],
    verified: true,
    rating: 4.7,
    reviews: 64,
    responseTime: '< 48 h',
    initials: 'MA',
  },
  {
    id: 'sp-03',
    name: 'Kilimanjaro Drilling Services',
    category: 'Drilling & blasting',
    location: 'Arusha',
    summary: 'Diamond and RC drilling rigs with experienced crews; licensed blasting contractor.',
    services: ['Diamond drilling', 'RC drilling', 'Licensed blasting'],
    verified: true,
    rating: 4.6,
    reviews: 21,
    responseTime: '< 48 h',
    initials: 'KD',
  },
  {
    id: 'sp-04',
    name: 'Coastline Survey & GIS',
    category: 'Surveying & GIS',
    location: 'Dar es Salaam',
    summary: 'Licensed surveyors for boundary pegging, drone photogrammetry and GIS-ready deliverables.',
    services: ['Boundary surveys', 'Drone mapping', 'GIS'],
    verified: true,
    rating: 4.8,
    reviews: 29,
    responseTime: '< 24 h',
    initials: 'CS',
  },
  {
    id: 'sp-05',
    name: 'Savanna Environmental Partners',
    category: 'Environmental & social',
    location: 'Dodoma',
    summary: 'Environmental impact assessments, management plans and community engagement for mining projects.',
    services: ['EIA', 'EMP', 'Community engagement'],
    verified: false,
    rating: 4.5,
    reviews: 12,
    responseTime: '< 72 h',
    initials: 'SE',
  },
  {
    id: 'sp-06',
    name: 'Msasani Mining Law Chambers',
    category: 'Legal & advisory',
    location: 'Dar es Salaam',
    summary: 'Mining-rights transactions, assignments, JV structuring and regulatory advice under Tanzanian law.',
    services: ['Rights assignments', 'JV agreements', 'Regulatory advice'],
    verified: true,
    rating: 4.9,
    reviews: 17,
    responseTime: '< 24 h',
    initials: 'MM',
  },
  {
    id: 'sp-07',
    name: 'Geita Plant & Equipment Hire',
    category: 'Equipment & suppliers',
    location: 'Geita',
    summary: 'Excavators, crushers, generators and compressors for hire or lease-to-own across the Lake Zone.',
    services: ['Equipment hire', 'Lease-to-own', 'Maintenance'],
    verified: true,
    rating: 4.4,
    reviews: 45,
    responseTime: '< 12 h',
    initials: 'GP',
  },
  {
    id: 'sp-08',
    name: 'Rift Metallurgy Consultants',
    category: 'Processing & metallurgy',
    location: 'Arusha',
    summary: 'Test-work, gravity and CIL circuit design, and plant optimisation for small and medium operations.',
    services: ['Test-work', 'Circuit design', 'Plant optimisation'],
    verified: false,
    rating: 4.6,
    reviews: 9,
    responseTime: '< 48 h',
    initials: 'RM',
  },
]

export const PLANS = [
  {
    id: 'explorer',
    name: 'Explorer',
    price: 'Free',
    period: '',
    audience: 'Anyone exploring the market',
    features: ['Basic search & filters', 'Selected public listings', 'Saved searches', 'Personal account'],
  },
  {
    id: 'miner',
    name: 'Miner',
    price: 'TSh 50,000',
    period: '/month',
    yearly: 'TSh 500,000/year',
    audience: 'Small-scale miners & PML holders',
    features: ['Up to 3 project listings', 'Basic owner profile', 'Investor enquiries', 'Email & SMS notifications'],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 'TSh 150,000',
    period: '/month',
    yearly: 'TSh 1.5M/year',
    audience: 'Project owners & professionals',
    features: ['Up to 10 project listings', 'Enhanced project pages', 'Document hosting', 'Listing analytics', 'Priority placement'],
  },
  {
    id: 'investor',
    name: 'Investor',
    price: 'TSh 300,000',
    period: '/month',
    yearly: 'TSh 3M/year',
    audience: 'Investors & investment companies',
    highlighted: true,
    features: ['Advanced search & map filters', 'Selected mining intelligence', 'Deal-room access', 'Investor alerts & matching'],
  },
  {
    id: 'corporate',
    name: 'Corporate',
    price: 'TSh 1M+',
    period: '/month',
    audience: 'Mining companies & institutions',
    features: ['Multiple team seats', 'Corporate profile', 'Premium visibility', 'Intelligence access', 'Dedicated account support'],
  },
] as const

export const SERVICES_PRICING = [
  { product: 'Basic listing', price: 'TSh 50k – 100k', customer: 'Project owner', type: 'One-off' },
  { product: 'Verified listing', price: 'TSh 250k – 750k', customer: 'Project owner', type: 'One-off, by scope' },
  { product: 'Featured placement', price: 'TSh 100k – 500k', customer: 'Owner / service provider', type: 'Per campaign / month' },
  { product: 'Due-diligence coordination', price: 'TSh 500k – 5M+', customer: 'Investor / project owner', type: 'Service, excl. third-party costs' },
  { product: 'Success / facilitation fee', price: '1 – 5% agreed', customer: 'Transaction parties', type: 'Agreed in writing beforehand' },
]

export const INSIGHTS = [
  {
    title: 'PML, PL, ML, SML: what each mineral right actually allows',
    tag: 'Guide',
    minutes: 7,
    excerpt: 'A plain-language primer on Tanzania’s mineral-right categories — and why a listing never equals licence approval.',
  },
  {
    title: 'Reading an assay certificate before you sign an NDA',
    tag: 'Due diligence',
    minutes: 5,
    excerpt: 'Chain of custody, detection limits and the red flags our technical reviewers see most often.',
  },
  {
    title: 'Structuring a fair joint venture with a small-scale miner',
    tag: 'Deal structuring',
    minutes: 9,
    excerpt: 'Earn-ins, operating partnerships and how to protect both parties within the statutory transfer process.',
  },
]

export const PLATFORM_STATS = [
  { value: '120+', label: 'Pilot projects in review' },
  { value: '16', label: 'Regions represented' },
  { value: '48%', label: 'Listings at Level 2 or above' },
  { value: '9 days', label: 'Median verification turnaround' },
]

export function getProject(id: string) {
  return PROJECTS.find((p) => p.id === id)
}

export function formatUsd(n: number) {
  if (n >= 1_000_000) return `US$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2).replace(/\.?0+$/, '')}M`
  return `US$${Math.round(n / 1000)}k`
}

export function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
