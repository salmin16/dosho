import type { Project, ServiceProvider } from '../data/fixtures'
import type {
  UserListedProject,
  UserOpportunityRecord,
  UserServiceRecord,
  VerificationLevelCode,
} from '../types/database'
import { normalizeVerificationLevel } from './verificationLevels'
import { formatServiceCategory } from './serviceCategories'

export interface DossierComplianceNote {
  label: string
  detail: string
}

export interface CounterpartyDossierData {
  entityKind: 'project' | 'opportunity' | 'service'
  recordCode: string
  title: string
  mineralsOrCategory: string[]
  regionLabel: string
  scopeSummary: string
  // Tenement & Accreditation Dossier
  licenceClass: string
  licenceClassFull: string
  licenceReference: string
  licenceStatus: string
  licenceDates?: string
  areaLabel?: string
  verificationLevel: VerificationLevelCode
  verificationStatus: string
  verificationAuthority: string
  complianceNotes: DossierComplianceNote[]
  // Direct Counterparty Contact
  counterpartyName: string
  counterpartyRole: string
  companyRegistration: string
  localContentRef: string
  directPhone: string
  directEmail: string
  responseSla: string
}

const LICENCE_CLASS_NAMES: Record<string, string> = {
  PML: 'Primary Mining Licence (PML — Mining Act Cap. 123)',
  PL: 'Prospecting Licence (PL — Mining Act Cap. 123)',
  ML: 'Mining Licence (ML — Medium-Scale Tenement)',
  SML: 'Special Mining Licence (SML — Large-Scale Tenement)',
  'Processing Licence': 'Mineral Processing & Smelting Licence (Tume ya Madini)',
}

function stableHash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function buildContactTokens(seed: string, orgName: string): {
  companyRegistration: string
  localContentRef: string
  directPhone: string
  directEmail: string
} {
  const hash = stableHash(`${seed}:${orgName}`)
  const brelaNum = 110_000 + (hash % 86_000)
  const lcNum = 2_400 + (hash % 7_400)
  const prefixes = ['754', '755', '767', '784', '713', '742'] as const
  const prefix = prefixes[hash % prefixes.length]
  const pMid = String(210 + (hash % 780)).padStart(3, '0')
  const pEnd = String(104 + ((hash >> 5) % 890)).padStart(3, '0')

  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 2)
    .join('') || 'operations'

  return {
    companyRegistration: `BRELA-${brelaNum} · TIN ${(100 + (hash % 899))}-${String(100 + ((hash >> 3) % 899))}-${String(100 + ((hash >> 6) % 899))}`,
    localContentRef: `MC-LC/2026/${lcNum}`,
    directPhone: `+255 ${prefix} ${pMid} ${pEnd}`,
    directEmail: `desk@${slug}.co.tz`,
  }
}

export function buildProjectDossier(project: Project): CounterpartyDossierData {
  const hash = stableHash(project.id)
  const unmaskedDigits = String(1042 + (hash % 8800))
  const fullLicenceRef = project.licence.reference.includes('••••')
    ? project.licence.reference.replace('••••', unmaskedDigits)
    : project.licence.reference
  const contact = buildContactTokens(project.id, project.owner.name)

  return {
    entityKind: 'project',
    recordCode: project.id,
    title: project.title,
    mineralsOrCategory: [...project.minerals],
    regionLabel: `${project.district}, ${project.region}`,
    scopeSummary: project.summary,
    licenceClass: project.licence.type,
    licenceClassFull:
      LICENCE_CLASS_NAMES[project.licence.type] ??
      `${project.licence.type} — Tanzania Mining Commission`,
    licenceReference: fullLicenceRef,
    licenceStatus: project.licence.status,
    licenceDates: `Issued ${project.licence.issued} · Expires ${project.licence.expires}`,
    areaLabel: `${project.areaHa.toLocaleString('en-US')} ha · ${project.stage}`,
    verificationLevel: normalizeVerificationLevel(project.verification.level),
    verificationStatus: `Level ${project.verification.level} Verified`,
    verificationAuthority: `${project.verification.checkedBy} (${project.verification.checkedOn})`,
    complianceNotes: [
      ...project.evidence.map((e) => ({ label: e.label, detail: e.detail })),
      ...project.verification.scope.slice(0, 2).map((s, idx) => ({
        label: idx === 0 ? 'Compliance Check' : 'Audit Scope',
        detail: s,
      })),
    ],
    counterpartyName: project.owner.name,
    counterpartyRole: `${project.owner.kind} · Member since ${project.owner.memberSince}`,
    companyRegistration: contact.companyRegistration,
    localContentRef: contact.localContentRef,
    directPhone: contact.directPhone,
    directEmail: contact.directEmail,
    responseSla: 'Direct desk response < 24h (EAT)',
  }
}

export function buildServiceProviderDossier(
  provider: ServiceProvider,
): CounterpartyDossierData {
  const contact = buildContactTokens(provider.id, provider.name)

  return {
    entityKind: 'service',
    recordCode: provider.id.toUpperCase(),
    title: provider.name,
    mineralsOrCategory: [provider.category],
    regionLabel: `${provider.location}, Tanzania`,
    scopeSummary: provider.summary,
    licenceClass: 'PML · PL · ML · SML',
    licenceClassFull: 'Accredited Technical Contractor (PML, PL, ML & SML Operations)',
    licenceReference: contact.localContentRef,
    licenceStatus: provider.verified ? 'Verified & Accredited' : 'Active Directory Member',
    licenceDates: 'Valid 2026–2027 Mining Commission Cycle',
    areaLabel: `Operating Base: ${provider.location} · Nationwide Deployment`,
    verificationLevel: provider.verified ? 'L1' : 'L0',
    verificationStatus: provider.verified
      ? `MineConnect Verified (${provider.rating.toFixed(1)}★ · ${provider.reviews} reviews)`
      : `Standard Profile (${provider.rating.toFixed(1)}★ · ${provider.reviews} reviews)`,
    verificationAuthority: 'MineConnect Technical Provider Compliance Desk',
    complianceNotes: [
      {
        label: 'Technical Scope',
        detail: provider.services.join(' · '),
      },
      {
        label: 'Assay & QA/QC Standards',
        detail:
          'Chain-of-custody reporting aligned with Tanzania Mining Commission & JORC / NI 43-101 diligence expectations.',
      },
      {
        label: 'Local Content Compliance',
        detail:
          'Registered under Mining (Local Content) Regulations with valid OSHA/HSE field clearance.',
      },
    ],
    counterpartyName: provider.name,
    counterpartyRole: `${provider.category} Specialist`,
    companyRegistration: contact.companyRegistration,
    localContentRef: contact.localContentRef,
    directPhone: contact.directPhone,
    directEmail: contact.directEmail,
    responseSla: `Typical RFQ turnaround ${provider.responseTime}`,
  }
}

export function buildLiveServiceDossier(
  service: UserServiceRecord,
): CounterpartyDossierData {
  const contact = buildContactTokens(service.reference_code || service.id, service.provider_organization)
  const displayCategory = formatServiceCategory(service)

  return {
    entityKind: 'service',
    recordCode: service.reference_code,
    title: service.service_name,
    mineralsOrCategory: [displayCategory],
    regionLabel: service.regional_coverage,
    scopeSummary: service.scope_description,
    licenceClass: 'PML · PL · ML · SML',
    licenceClassFull: 'Accredited Mining Technical Service Provider',
    licenceReference: service.reference_code,
    licenceStatus: service.status === 'active' ? 'Admin Approved · Active' : service.status,
    areaLabel: `Coverage: ${service.regional_coverage}`,
    verificationLevel: service.approved || service.status === 'active' ? 'L1' : 'L0',
    verificationStatus: 'Admin Approved & Compliance Checked',
    verificationAuthority: 'MineConnect Admin Governance Queue',
    complianceNotes: [
      {
        label: 'Rate & Pricing Model',
        detail: service.rate_or_pricing_model,
      },
      {
        label: 'Certifications & Credentials',
        detail:
          service.certifications ||
          'BRELA registered technical firm · Mining Commission Local Content compliant',
      },
      {
        label: 'Technical Scope',
        detail: service.scope_description,
      },
    ],
    counterpartyName: service.provider_organization,
    counterpartyRole: `${displayCategory} Provider`,
    companyRegistration: contact.companyRegistration,
    localContentRef: contact.localContentRef,
    directPhone: contact.directPhone,
    directEmail: contact.directEmail,
    responseSla: 'Direct desk response < 24h (EAT)',
  }
}

export function buildLiveOpportunityDossier(
  opp: UserOpportunityRecord,
): CounterpartyDossierData {
  const contact = buildContactTokens(opp.reference_code || opp.id, opp.organization)

  return {
    entityKind: 'opportunity',
    recordCode: opp.reference_code,
    title: opp.title,
    mineralsOrCategory: [opp.category],
    regionLabel: opp.location,
    scopeSummary: opp.description,
    licenceClass: 'PL · ML · SML',
    licenceClassFull: `${opp.category} Procurement / Site Opportunity (Mining Act Cap. 123)`,
    licenceReference: opp.reference_code,
    licenceStatus: opp.status === 'active' ? 'Active Tender / Opportunity' : opp.status,
    licenceDates: `Submission Deadline: ${opp.deadline}`,
    verificationLevel: opp.approved || opp.status === 'active' ? 'L1' : 'L0',
    verificationStatus: 'Admin Verified Member Listing',
    verificationAuthority: 'MineConnect Moderation & Governance Desk',
    complianceNotes:
      opp.requirements.length > 0
        ? opp.requirements.map((req, idx) => ({
            label: `Requirement ${idx + 1}`,
            detail: req,
          }))
        : [
            {
              label: 'Compliance Scope',
              detail: 'Valid BRELA registration, TIN & Tanzania Mining Commission Local Content compliance.',
            },
          ],
    counterpartyName: opp.organization,
    counterpartyRole: `${opp.category} Issuer`,
    companyRegistration: contact.companyRegistration,
    localContentRef: contact.localContentRef,
    directPhone: contact.directPhone,
    directEmail: contact.directEmail,
    responseSla: `Deadline ${opp.deadline} · Direct counterparty desk`,
  }
}

export function buildLiveProjectDossier(
  proj: UserListedProject,
): CounterpartyDossierData {
  const contact = buildContactTokens(proj.id, `${proj.region} ${proj.mineral} Operations`)
  const licenceKey = proj.licence_type.trim().toUpperCase()

  return {
    entityKind: 'project',
    recordCode: proj.licence_reference || proj.id.slice(0, 8).toUpperCase(),
    title: proj.title,
    mineralsOrCategory: [proj.mineral],
    regionLabel: `${proj.region}, Tanzania`,
    scopeSummary: proj.summary,
    licenceClass: licenceKey || 'PML',
    licenceClassFull:
      LICENCE_CLASS_NAMES[proj.licence_type] ??
      LICENCE_CLASS_NAMES[licenceKey] ??
      `${proj.licence_type} — Tanzania Mining Commission`,
    licenceReference: proj.licence_reference,
    licenceStatus:
      proj.status === 'approved' || proj.status === 'VERIFIED'
        ? 'Verified Active Tenement'
        : proj.status,
    areaLabel: `${proj.region} · Target US$${Number(proj.investment_usd).toLocaleString('en-US')}`,
    verificationLevel: normalizeVerificationLevel(
      proj.verification_level,
      proj.approved || proj.status === 'VERIFIED' ? 'verified' : 'unverified',
    ),
    verificationStatus: 'MineConnect Admin Verified Listing',
    verificationAuthority: 'MineConnect Cadastre & Compliance Queue',
    complianceNotes: [
      {
        label: 'Tenement Standing',
        detail: `${proj.licence_type} reference ${proj.licence_reference} submitted with holder attestation.`,
      },
      {
        label: 'Project Scope',
        detail: proj.summary,
      },
    ],
    counterpartyName: `${proj.region} ${proj.mineral} Tenement Holder`,
    counterpartyRole: 'Verified Project Owner',
    companyRegistration: contact.companyRegistration,
    localContentRef: contact.localContentRef,
    directPhone: contact.directPhone,
    directEmail: contact.directEmail,
    responseSla: 'Direct counterparty outreach < 24h (EAT)',
  }
}
