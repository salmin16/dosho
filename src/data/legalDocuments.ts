export type LegalDocumentSlug =
  | 'terms-of-use'
  | 'privacy-policy'
  | 'listing-agreement'
  | 'investor-terms'
  | 'facilitation-success-fee-terms'
  | 'prohibited-claims-policy'
  | 'complaints-procedure'

export interface LegalSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export interface LegalDocumentDefinition {
  slug: LegalDocumentSlug
  title: string
  shortTitle: string
  category: string
  effectiveDate: string
  jurisdiction: string
  summary: string
  sections: LegalSection[]
}

export const LEGAL_EFFECTIVE_DATE = 'November 2026'
export const LEGAL_JURISDICTION = 'United Republic of Tanzania'

export const LEGAL_DOCUMENTS: LegalDocumentDefinition[] = [
  {
    slug: 'terms-of-use',
    title: 'Terms of Use',
    shortTitle: 'Terms of Use',
    category: 'Platform Governance',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    jurisdiction: LEGAL_JURISDICTION,
    summary:
      'Governs access to the Mine Connect digital marketplace, defining our facilitator role, account obligations, intellectual property, liability boundaries, and Tanzanian governing law.',
    sections: [
      {
        heading: '1. Platform Role & Non-Brokerage Status',
        paragraphs: [
          'Mine Connect operates an independent digital discovery, verification workflow, and deal-facilitation marketplace connecting mineral-right holders, mining operators, qualified investors, and accredited technical service providers in the United Republic of Tanzania.',
          'Mine Connect is strictly a technology marketplace and facilitation platform. Mine Connect is NOT a licensed mineral dealer, securities broker, investment advisor, fiduciary escrow agent, or government licensing authority, and is not a party to any underlying joint venture, farm-in, offtake, equity, or service contract concluded between users.',
        ],
      },
      {
        heading: '2. Account Eligibility & Security Responsibilities',
        paragraphs: [
          'By creating an account, you represent that you are at least 18 years of age, possess full legal authority to bind yourself or the corporate entity you represent, and will maintain accurate registration details.',
        ],
        bullets: [
          'Users must safeguard account credentials and immediately notify Mine Connect upon discovering unauthorized access.',
          'Corporate accounts must designate an authorized officer holding valid BRELA registration or mineral-right mandate.',
          'Mine Connect reserves the right to suspend or terminate accounts that violate statutory regulations or these Terms.',
        ],
      },
      {
        heading: '3. Platform Intellectual Property & License to Display',
        paragraphs: [
          'All Mine Connect software, map overlays, verification frameworks, editorial copy, trade names, and design systems remain the exclusive intellectual property of Mine Connect. You may not scrape, mirror, reverse engineer, or redistribute platform data without prior written authorization.',
          'By submitting project profiles, geological summaries, or service dossiers, you grant Mine Connect a non-exclusive, revocable license to host, verify, and display approved public summaries on the platform.',
        ],
      },
      {
        heading: '4. Limitation of Liability & Disclaimer of Warranties',
        paragraphs: [
          'The platform and all indicative mineral price benchmarks are provided on an "as is" and "as available" basis. To the maximum extent permitted under Tanzanian law, Mine Connect disclaims liability for indirect, incidental, or consequential losses, transaction defaults, assay variances, or regulatory delays arising from interactions between counterparties.',
        ],
      },
      {
        heading: '5. Governing Law & Dispute Resolution',
        paragraphs: [
          'These Terms of Use are governed by and construed in accordance with the laws of the United Republic of Tanzania. Any unresolved dispute shall first be submitted to good-faith mediation in Dar es Salaam and, failing settlement within thirty (30) days, referred to the courts of competent jurisdiction in Tanzania.',
        ],
      },
    ],
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    shortTitle: 'Privacy Policy',
    category: 'Data Protection (PDPA 2022)',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    jurisdiction: LEGAL_JURISDICTION,
    summary:
      'Explains how Mine Connect collects, processes, safeguards, and retains personal and corporate records in compliance with Tanzania’s Personal Data Protection Act, 2022.',
    sections: [
      {
        heading: '1. Statutory Alignment — Tanzania Personal Data Protection Act, 2022',
        paragraphs: [
          'Mine Connect processes personal and corporate compliance information in accordance with the Personal Data Protection Act, 2022 (Act No. 11 of 2022) of the United Republic of Tanzania and its subsidiary regulations. We act as a responsible Data Controller for account, verification, and platform governance records.',
        ],
      },
      {
        heading: '2. Categories of Data Collected',
        paragraphs: [
          'We collect only information strictly necessary to operate a verified mining marketplace and satisfy anti-fraud and statutory compliance requirements:',
        ],
        bullets: [
          'Account & Identity Data: Full name, work email address, encrypted password credentials, phone number, and organization name.',
          'Corporate KYC & Statutory Records: BRELA company incorporation particulars, Tanzania Revenue Authority (TRA) TIN certificates, and Mining Commission licence references (PML, PL, ML, SML, Dealer/Broker licences).',
          'Commercial & Operational Records: Project listings, service provider profiles, quote requests, subscription payment references, and compliance complaint filings.',
          'Essential Technical & Consent Telemetry: Authentication session cookies, explicit clickwrap consent timestamps, and cookie preference selections.',
        ],
      },
      {
        heading: '3. Lawful Basis & Purpose of Processing',
        paragraphs: [
          'Personal data is processed strictly on the lawful grounds of contractual necessity (operating your account and marketplace workflows), legal obligation (anti-fraud, mining cadastre verification, and regulatory auditability), and explicit user consent (optional interface preferences and analytics). We never sell user data to third-party data brokers.',
        ],
      },
      {
        heading: '4. Data Security, Access Controls & Retention',
        paragraphs: [
          'All user records are transmitted over TLS-encrypted connections and protected by database-level Row-Level Security (RLS) so private due-diligence documents are isolated strictly to their authorized owner. Administrative access is restricted to verified compliance officers and logged in an immutable governance audit trail.',
        ],
      },
      {
        heading: '5. Your Rights as a Data Subject',
        paragraphs: [
          'Under the Personal Data Protection Act, 2022, you have the right to:',
        ],
        bullets: [
          'Request access to and a copy of the personal data Mine Connect holds about you.',
          'Request rectification of inaccurate or outdated corporate or contact information.',
          'Withdraw optional preference or analytics consent at any time via the Cookie Settings control in the footer.',
          'Request erasure of account data, subject to statutory record-retention obligations for financial and compliance audit trails.',
        ],
      },
    ],
  },
  {
    slug: 'listing-agreement',
    title: 'Listing Agreement',
    shortTitle: 'Listing Agreement',
    category: 'Project Owners & Providers',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    jurisdiction: LEGAL_JURISDICTION,
    summary:
      'Establishes legal title warranties, Tanzania Mining Act (Cap. 123) licence compliance, technical accuracy standards, and moderation authority for all listed projects and services.',
    sections: [
      {
        heading: '1. Warranties of Legal Title & Mineral Rights (Mining Act, Cap. 123)',
        paragraphs: [
          'Every project owner, licence holder, or authorized representative submitting a mining project or opportunity on Mine Connect warrants that all referenced tenements—including Primary Mining Licences (PML), Prospecting Licences (PL), Mining Licences (ML), Special Mining Licences (SML), Processing Licences, and Dealer/Broker Licences—are validly issued, active, and in good standing with the Mining Commission of Tanzania under the Mining Act (Cap. 123).',
        ],
      },
      {
        heading: '2. Mandate & Authority to List',
        paragraphs: [
          'Where a listing is submitted by a representative, cooperative officer, consultant, or joint-venture agent, the submitter warrants that they hold written, verifiable authorization from the registered licence holder(s). Unauthorized third-party brokerage or "daisy-chain" listing of mineral rights without owner consent is strictly prohibited.',
        ],
      },
      {
        heading: '3. Accuracy of Geological, Commercial & Accreditation Data',
        paragraphs: [
          'Submitters warrant that all tenement coordinates, area measurements, historical production figures, assay summaries, environmental clearances (NEMC ESIA), and professional accreditations (ERB, CRB, TRA, Local Content certificates) are truthful, current, and free from material omission.',
        ],
        bullets: [
          'Unverified estimates must be clearly distinguished from JORC, NI 43-101, or SAMREC compliant resource statements.',
          'Commercial service rates must be separated clearly from statutory government royalties, application fees, and inspection charges.',
          'Material changes in licence status, expiry, or encumbrances must be disclosed within five (5) business days.',
        ],
      },
      {
        heading: '4. Verification Review, Moderation & Right of Removal',
        paragraphs: [
          'All new project, opportunity, and service submissions enter the Mine Connect Administrative Moderation Queue prior to public publication. Mine Connect reserves the unrestricted right to request supporting documentation, downgrade verification tiers, suspend, reject, or permanently remove any listing suspected of inaccuracy, title dispute, or breach of the Prohibited Claims Policy.',
        ],
      },
    ],
  },
  {
    slug: 'investor-terms',
    title: 'Investor Terms',
    shortTitle: 'Investor Terms',
    category: 'Capital & Counterparty Risk',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    jurisdiction: LEGAL_JURISDICTION,
    summary:
      'Defines risk disclosures for mineral exploration and mining investments, non-guarantee of geological outcomes, mandatory independent due diligence, and counterparty risk allocation.',
    sections: [
      {
        heading: '1. High-Risk Nature of Mineral Exploration & Mining Investments',
        paragraphs: [
          'Mineral exploration, mine development, equipment financing, and commodity offtake carry substantial technical, geological, operational, market-price, environmental, and regulatory risks, including the potential loss of all invested capital. Past artisanal or historical production does not guarantee future commercial viability.',
        ],
      },
      {
        heading: '2. No Guarantee of Grade, Tonnage, or Statutory Approvals',
        paragraphs: [
          'Mine Connect’s verification badges (L1–L4) reflect documentary and administrative checks performed at a point in time and do NOT constitute an endorsement, geological certification, valuation opinion, or guarantee of mineral grade, tonnage, metallurgical recovery, profitability, or Mining Commission transfer consent.',
        ],
      },
      {
        heading: '3. Mandatory Independent Technical, Legal & Financial Due Diligence',
        paragraphs: [
          'Before committing funds, signing a memorandum of understanding, or releasing capital, every investor or acquirer agrees to conduct comprehensive independent due diligence through qualified professionals, including:',
        ],
        bullets: [
          'Independent tenement search and encumbrance verification directly with the Tanzania Mining Commission Cadastre Portal.',
          'Independent field sampling, check assays at accredited laboratories, and Competent Person / Qualified Person technical review.',
          'Independent Tanzanian legal counsel review covering local content, free-carried interest, royalty rates, NEMC environmental compliance, and tax clearance.',
        ],
      },
      {
        heading: '4. Counterparty Risk Allocation & Direct Settlement',
        paragraphs: [
          'All investment terms, escrow arrangements, milestone disbursements, and dispute remedies are negotiated and enforced solely between the investor and the project owner or service provider. Mine Connect assumes no fiduciary responsibility for counterparty performance or capital recovery.',
        ],
      },
    ],
  },
  {
    slug: 'facilitation-success-fee-terms',
    title: 'Facilitation & Success-Fee Terms',
    shortTitle: 'Facilitation & Success-Fee Terms',
    category: 'Commercial & Anti-Bypass',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    jurisdiction: LEGAL_JURISDICTION,
    summary:
      'Sets out commercial facilitation fee triggers, settlement terms, and a binding 24-month Non-Circumvention & Anti-Bypass Clause governing counterparties introduced via Mine Connect.',
    sections: [
      {
        heading: '1. Scope & Fee-Triggering Events',
        paragraphs: [
          'In addition to published platform membership tiers, Mine Connect may earn agreed facilitation, mandate, or success fees where Mine Connect provides structured introductions, curated deal-room coordination, verified counterparty matching, or transaction facilitation that leads to a closed commercial transaction.',
        ],
        bullets: [
          'Triggering transactions include equity investments, joint ventures, earn-in / farm-in agreements, licence assignments or transfers, project finance, equipment leasing, long-term offtake agreements, and major commercial service contracts originated through Mine Connect introductions.',
          'Unless otherwise specified in a signed deal-specific mandate, platform facilitation fees become earned and payable upon execution of definitive transaction agreements or first tranche capital/consideration release.',
        ],
      },
      {
        heading: '2. Payment Settlement & Statutory Fee Separation',
        paragraphs: [
          'All Mine Connect membership and facilitation fees are strictly commercial platform charges invoiced in USD or TZS equivalent and are entirely separate from government application fees, annual mineral rents, royalties, or inspection charges payable directly to the United Republic of Tanzania.',
          'Invoices are payable within fourteen (14) calendar days of milestone settlement via authorized bank transfer or ClickPesa settlement channels.',
        ],
      },
      {
        heading: '3. Strict 24-Month Non-Circumvention & Anti-Bypass Clause',
        paragraphs: [
          'For a binding period of twenty-four (24) months following any introduction, quote request, investor enquiry, or confidential dossier disclosure facilitated through Mine Connect, neither party (nor any affiliate, subsidiary, director, nominee, or controlled vehicle) may directly or indirectly circumvent, bypass, or contact the introduced counterparty off-platform to structure, negotiate, or close a transaction with the intent or effect of avoiding applicable Mine Connect facilitation or success fees.',
        ],
        bullets: [
          'Any transaction consummated within the 24-month non-circumvention period between counterparties first introduced via Mine Connect remains fully subject to the agreed facilitation or success fee schedule.',
          'Confirmed circumvention entitles Mine Connect to recover the full applicable facilitation fee, liquidated administrative recovery costs, immediate permanent account suspension, and injunctive or contractual remedies under Tanzanian law.',
        ],
      },
      {
        heading: '4. Auditability & Good-Faith Disclosure',
        paragraphs: [
          'Platform introductions, enquiry timestamps, and quote submissions are logged automatically by Mine Connect to establish clear priority of introduction. Parties agree to notify Mine Connect promptly upon signing a term sheet or definitive agreement with an introduced counterparty.',
        ],
      },
    ],
  },
  {
    slug: 'prohibited-claims-policy',
    title: 'Prohibited Claims Policy',
    shortTitle: 'Prohibited Claims Policy',
    category: 'Marketplace Integrity',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    jurisdiction: LEGAL_JURISDICTION,
    summary:
      'Prohibits unsubstantiated mineral reserve guarantees, fabricated Mining Commission licences, misleading ESG claims, and unauthorized third-party listings, with immediate enforcement remedies.',
    sections: [
      {
        heading: '1. Zero Tolerance for Misleading Technical or Financial Claims',
        paragraphs: [
          'To protect Tanzanian mineral-right holders and international investors alike, Mine Connect strictly prohibits deceptive, unsubstantiated, or fraudulent representations anywhere on the platform, including project descriptions, service profiles, uploaded notes, and direct enquiries.',
        ],
      },
      {
        heading: '2. Explicitly Prohibited Content & Conduct',
        paragraphs: [
          'The following claims and practices constitute an immediate breach of platform policy:',
        ],
        bullets: [
          'Guaranteed Returns or Unsubstantiated Reserves: Advertising "guaranteed gold/mineral grade", "risk-free ROI", or quoting JORC/NI 43-101 compliant reserves without a verifiable Competent Person report.',
          'Fabricated or Expired Licences: Listing forged, altered, revoked, overlapped, or expired PML, PL, ML, SML, or dealer licence references.',
          'Unauthorized Third-Party Listings: Offering tenements, mines, or equipment owned by third parties without documented written mandate from the lawful holder.',
          'Misleading Regulatory or Environmental Claims: Falsely claiming Mining Commission endorsement, NEMC ESIA approval, or local-content certification where none exists.',
          'Soliciting Unreceipted Upfront Fees: Demanding informal cash or mobile-money payments from applicants or bidders outside lawful contractual or statutory channels.',
        ],
      },
      {
        heading: '3. Enforcement & Immediate Suspension Remedies',
        paragraphs: [
          'Upon identifying a suspected violation—either through internal compliance review or a verified complaint—Mine Connect may immediately hide or delist the affected content, suspend the user’s account pending investigation, revoke Verified badges, preserve immutable audit records, and refer suspected fraud or forged statutory instruments to relevant Tanzanian law-enforcement or regulatory authorities.',
        ],
      },
    ],
  },
  {
    slug: 'complaints-procedure',
    title: 'Complaints Procedure',
    shortTitle: 'Complaints Procedure',
    category: 'Dispute & Compliance Desk',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    jurisdiction: LEGAL_JURISDICTION,
    summary:
      'Outlines Mine Connect’s structured 4-step compliance escalation timeline and provides a direct portal to report unverified licences, misleading claims, fee circumvention, or privacy concerns.',
    sections: [
      {
        heading: '1. Scope of Compliance & Listing Complaints',
        paragraphs: [
          'Any user, licence holder, investor, service provider, or member of the public may lodge a formal complaint concerning unverified or disputed mineral licences, misleading technical claims, suspected fee circumvention, unauthorized listing of assets, or personal data privacy concerns under Tanzania’s Personal Data Protection Act, 2022.',
        ],
      },
      {
        heading: '2. Structured 4-Step Resolution & Escalation Timeline',
        paragraphs: [
          'Every complaint submitted through the form below is logged directly into the Mine Connect Admin Governance & Compliance Queue and processed according to four transparent milestones:',
        ],
        bullets: [
          'Step 1 — Submission & Intake Logging (Immediate): Your complaint receives a tracking reference and is queued for the Compliance Officer.',
          'Step 2 — Formal Acknowledgment (Within 48 Hours): Our compliance desk confirms receipt via email and places provisional review flags on high-risk listings if necessary.',
          'Step 3 — Evidence Review & Investigation (Within 7 Business Days): We audit submitted references, cross-check licence documentation, and invite a documented response from the subject party where appropriate.',
          'Step 4 — Resolution, Remediation & Closure: Mine Connect executes remediation (delisting, badge revocation, account suspension, fee-enforcement notice, or data rectification) and notifies the reporter of the outcome.',
        ],
      },
      {
        heading: '3. Good-Faith Reporting & Confidentiality',
        paragraphs: [
          'Reporter identities and supporting evidence are handled confidentially and accessed solely by authorized Mine Connect compliance administrators. Malicious or bad-faith complaints intended to harass competitors may themselves result in account sanctions.',
        ],
      },
    ],
  },
]

export const LEGAL_DOCUMENTS_BY_SLUG: Record<
  LegalDocumentSlug,
  LegalDocumentDefinition
> = LEGAL_DOCUMENTS.reduce(
  (acc, doc) => {
    acc[doc.slug] = doc
    return acc
  },
  {} as Record<LegalDocumentSlug, LegalDocumentDefinition>
)

export function isLegalDocumentSlug(value: string): value is LegalDocumentSlug {
  return value in LEGAL_DOCUMENTS_BY_SLUG
}
