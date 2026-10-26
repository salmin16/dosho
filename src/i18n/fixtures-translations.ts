import {
  INSIGHTS,
  INVESTMENT_BANDS,
  PLANS,
  PLATFORM_STATS,
  PROJECTS,
  SERVICES_PRICING,
  SERVICE_PROVIDERS,
  VERIFICATION_LEVELS,
  type Project,
  type ServiceProvider,
  type VerificationLevel,
} from '../data/fixtures'
import type { LanguageCode } from './index'

/**
 * Value-level translation dictionary for shared domain terms (minerals, opportunity types,
 * stages, licence types/statuses, categories, deal types, evidence labels, etc.).
 * Canonical English values remain the URL/filter keys so links and saved filters work
 * across languages without breaking.
 */
export const VALUE_TRANSLATIONS: Record<Exclude<LanguageCode, 'en'>, Record<string, string>> = {
  sw: {
    // Minerals
    Gold: 'Dhahabu',
    Tanzanite: 'Tanzanite',
    Graphite: 'Kinywe (Graphite)',
    Copper: 'Shaba',
    Nickel: 'Nikeli',
    Diamonds: 'Almasi',
    Gemstones: 'Vito vya thamani',
    Coal: 'Makaa ya mawe',
    Limestone: 'Mawe ya chokaa',
    'Rare Earths': 'Madini adimu (Rare Earths)',

    // Opportunity types
    'Licence / rights opportunity': 'Fursa ya leseni / haki',
    'Existing mine seeking investment': 'Mgodi uliopo unaotafuta uwekezaji',
    'Joint venture': 'Ubia (Joint venture)',
    'Exploration opportunity': 'Fursa ya utafutaji madini',
    'Mine seeking partner': 'Mgodi unaotafuta mshirika',
    'Equipment / project financing': 'Ufadhili wa vifaa / mradi',
    'Processing opportunity': 'Fursa ya uchenjuaji',
    'Processing facility': 'Kiwanda cha uchenjuaji',

    // Project stages
    Greenfield: 'Awali (Greenfield)',
    'Early exploration': 'Utafutaji wa awali',
    'Advanced exploration': 'Utafutaji wa kina',
    'Pilot production': 'Uzalishaji wa majaribio',
    Producing: 'Inazalisha',

    // Licence types & statuses
    'Processing Licence': 'Leseni ya Uchenjuaji',
    'Other mineral-trade licence': 'Leseni nyingine ya biashara ya madini',
    Active: 'Hai',
    'Renewal pending': 'Inasubiri kuhuishwa',
    'Application stage': 'Hatua ya maombi',

    // Location disclosure & document access
    Approximate: 'Kukadiria',
    'Exact on NDA': 'Halisi baada ya NDA',
    Public: 'Wazi kwa umma',
    'On request': 'Kwa maombi',
    'Deal room': 'Chumba cha makubaliano',

    // Investment bands
    'Under US$250k': 'Chini ya US$250k',
    'US$250k – 1M': 'US$250k – 1M',
    'US$1M – 5M': 'US$1M – 5M',
    'Over US$5M': 'Zaidi ya US$5M',

    // Service categories
    'Geology & exploration': 'Jiolojia na utafutaji',
    Laboratories: 'Maabara',
    'Drilling & blasting': 'Uchimbaji visima na ulipuaji',
    'Surveying & GIS': 'Upimaji ardhi na GIS',
    'Environmental & social': 'Mazingira na jamii',
    'Legal & advisory': 'Sheria na ushauri',
    'Equipment & suppliers': 'Vifaa na wasambazaji',
    'Processing & metallurgy': 'Uchenjuaji na metalujia',

    // Deal types & evidence chips
    'Equity partnership': 'Ushirika wa hisa',
    Equity: 'Hisa',
    'Operating partnership': 'Ushirika wa uendeshaji',
    Partnership: 'Ushirika',
    'Earn-in': 'Earn-in (Kuingia kwa hatua)',
    'Project finance': 'Ufadhili wa mradi',
    'Assignment of rights': 'Ugawaji wa haki',
    Lease: 'Ukobishaji (Lease)',
    'Offtake partnership': 'Ushirika wa ununuzi (Offtake)',
    Offtake: 'Ununuzi wa mazao (Offtake)',
    'Technical services for equity': 'Huduma za kiufundi kwa hisa',
    'Geological mapping': 'Ramani za kijiolojia',
    'Sampling / assays': 'Sampuli / uchunguzi wa maabara',
    'Drilling data': 'Takwimu za uchimbaji visima',
    'Technical report': 'Ripoti ya kiufundi',
    'Production records': 'Kumbukumbu za uzalishaji',
    'Environmental approvals': 'Vibali vya mazingira',
    'Photos / video': 'Picha / video',

    // Form options
    Individual: 'Mtu binafsi',
    Company: 'Kampuni',
  },
  es: {
    // Minerals
    Gold: 'Oro',
    Tanzanite: 'Tanzanita',
    Graphite: 'Grafito',
    Copper: 'Cobre',
    Nickel: 'Níquel',
    Diamonds: 'Diamantes',
    Gemstones: 'Piedras preciosas',
    Coal: 'Carbón',
    Limestone: 'Piedra caliza',
    'Rare Earths': 'Tierras raras',

    // Opportunity types
    'Licence / rights opportunity': 'Oportunidad de licencia / derechos',
    'Existing mine seeking investment': 'Mina activa buscando inversión',
    'Joint venture': 'Empresa conjunta (JV)',
    'Exploration opportunity': 'Oportunidad de exploración',
    'Mine seeking partner': 'Mina buscando socio',
    'Equipment / project financing': 'Financiación de equipos / proyecto',
    'Processing opportunity': 'Oportunidad de procesamiento',
    'Processing facility': 'Planta de procesamiento',

    // Project stages
    Greenfield: 'Greenfield (Campo virgen)',
    'Early exploration': 'Exploración temprana',
    'Advanced exploration': 'Exploración avanzada',
    'Pilot production': 'Producción piloto',
    Producing: 'En producción',

    // Licence types & statuses
    'Processing Licence': 'Licencia de Procesamiento',
    'Other mineral-trade licence': 'Otra licencia de comercio mineral',
    Active: 'Activa',
    'Renewal pending': 'Renovación pendiente',
    'Application stage': 'En etapa de solicitud',

    // Location disclosure & document access
    Approximate: 'Aproximada',
    'Exact on NDA': 'Exacta bajo NDA',
    Public: 'Público',
    'On request': 'Bajo solicitud',
    'Deal room': 'Sala de datos',

    // Investment bands
    'Under US$250k': 'Menos de US$250k',
    'US$250k – 1M': 'US$250k – 1M',
    'US$1M – 5M': 'US$1M – 5M',
    'Over US$5M': 'Más de US$5M',

    // Service categories
    'Geology & exploration': 'Geología y exploración',
    Laboratories: 'Laboratorios',
    'Drilling & blasting': 'Perforación y voladura',
    'Surveying & GIS': 'Topografía y SIG',
    'Environmental & social': 'Ambiental y social',
    'Legal & advisory': 'Legal y asesoría',
    'Equipment & suppliers': 'Equipos y proveedores',
    'Processing & metallurgy': 'Procesamiento y metalurgia',

    // Deal types & evidence chips
    'Equity partnership': 'Asociación de capital',
    Equity: 'Capital (Equity)',
    'Operating partnership': 'Asociación operativa',
    Partnership: 'Asociación',
    'Earn-in': 'Earn-in (Participación progresiva)',
    'Project finance': 'Financiación de proyecto',
    'Assignment of rights': 'Cesión de derechos',
    Lease: 'Arrendamiento (Lease)',
    'Offtake partnership': 'Acuerdo de compra (Offtake)',
    Offtake: 'Compra garantizada (Offtake)',
    'Technical services for equity': 'Servicios técnicos por capital',
    'Geological mapping': 'Mapeo geológico',
    'Sampling / assays': 'Muestreo / ensayos',
    'Drilling data': 'Datos de perforación',
    'Technical report': 'Informe técnico',
    'Production records': 'Registros de producción',
    'Environmental approvals': 'Aprobaciones ambientales',
    'Photos / video': 'Fotos / video',

    // Form options
    Individual: 'Individual',
    Company: 'Empresa',
  },
}

type VerificationTranslation = {
  name: string
  short: string
  description: string
  checks: string[]
  notCovered: string
}

export const VERIFICATION_LEVELS_I18N: Record<Exclude<LanguageCode, 'en'>, Record<VerificationLevel, VerificationTranslation>> = {
  sw: {
    0: {
      name: 'Haijathibitishwa',
      short: 'Imejitangaza',
      description: 'Taarifa imetolewa na mmiliki wa mradi na bado haijakaguliwa kwa uhuru.',
      checks: ['Uhakiki wa lazima dhidi ya madai yaliyopigwa marufuku', 'Uchunguzi wa kuzuia matangazo yanayojirudia'],
      notCovered: 'Utambulisho, hali ya leseni na madai ya kiufundi hayajakaguliwa.',
    },
    1: {
      name: 'Utambulisho na Nyaraka',
      short: 'KYC imekaguliwa',
      description: 'Mtu binafsi au kampuni inayowasilisha pamoja na nyaraka za msingi zimekaguliwa.',
      checks: ['Utambulisho wa mmiliki / usajili wa kampuni', 'Mwakilishi aliyeidhinishwa', 'Ukamilifu wa nyaraka za msingi'],
      notCovered: 'Hali ya leseni na ushahidi wa kijiolojia havijapitiwa.',
    },
    2: {
      name: 'Ukaguzi wa Kumbukumbu za Leseni',
      short: 'Leseni imekaguliwa',
      description: 'Taarifa za leseni au haki zinazopatikana zimekaguliwa dhidi ya kumbukumbu au nyaraka rasmi zinazofaa.',
      checks: ['Kulingana kwa nambari ya leseni na mmiliki', 'Hali, tarehe ya kutolewa na kuisha', 'Uwiano wa eneo / majira-nukta'],
      notCovered: 'Haithibitishi uwezekano wa kuhamishika au ridhaa ya mamlaka ya leseni.',
    },
    3: {
      name: 'Mapitio ya Kiufundi',
      short: 'Imepitiwa kiufundi',
      description: 'Mtaalamu aliyehitimu amepitia ushahidi wa kiufundi uliotolewa — sampuli, majibu ya maabara na ripoti.',
      checks: ['Mnyororo wa ulinzi wa sampuli na maabara', 'Vyeti vya maabara', 'Uwiano wa ripoti za kiufundi'],
      notCovered: 'Hii si makadirio ya rasilimali ya madini wala dhamana ya kiwango cha madini.',
    },
    4: {
      name: 'Ukaguzi wa Eneo na Uhakiki wa Kina',
      short: 'Eneo limetembelewa',
      description: 'Ziara ya eneo la mradi na/au uhakiki maalum wa kina umeagizwa na kukamilishwa kwa ajili ya mteja.',
      checks: ['Ziara huru katika eneo la mradi', 'Uchunguzi wa jamii na ufikikaji', 'Ripoti maalum ya uhakiki wa kina'],
      notCovered: 'Matokeo ni ya wakati husika na hayachukui nafasi ya ushauri wako wa kisheria na kiufundi.',
    },
  },
  es: {
    0: {
      name: 'Sin verificar',
      short: 'Autodeclarado',
      description: 'Información suministrada por el titular del proyecto y aún no comprobada de forma independiente.',
      checks: ['Moderación obligatoria de declaraciones prohibidas', 'Detección de publicaciones duplicadas'],
      notCovered: 'La identidad, el estado de la licencia y las afirmaciones técnicas no están verificados.',
    },
    1: {
      name: 'Identidad y Documentos',
      short: 'KYC verificado',
      description: 'Se ha comprobado la persona o empresa remitente y los documentos básicos de respaldo.',
      checks: ['Identidad del titular / registro de la empresa', 'Representante autorizado', 'Integridad documental básica'],
      notCovered: 'La vigencia de la licencia y la evidencia geológica no se revisan.',
    },
    2: {
      name: 'Verificación de Registro de Licencia',
      short: 'Licencia verificada',
      description: 'La información disponible de la licencia o derecho se contrasta con los registros o documentos oficiales pertinentes.',
      checks: ['Coincidencia de referencia y titular de licencia', 'Estado, fechas de emisión y vencimiento', 'Consistencia de área y coordenadas'],
      notCovered: 'No confirma la transferibilidad ni el consentimiento de la autoridad de licencias.',
    },
    3: {
      name: 'Revisión Técnica',
      short: 'Revisado técnicamente',
      description: 'Un profesional cualificado ha revisado la evidencia técnica suministrada: muestreo, ensayos e informes.',
      checks: ['Cadena de custodia de muestreo y ensayos', 'Certificados de laboratorio', 'Consistencia de informes técnicos'],
      notCovered: 'Esto no es una estimación de recursos minerales ni una garantía de ley.',
    },
    4: {
      name: 'Visita al Sitio y Debida Diligencia',
      short: 'Sitio visitado',
      description: 'Se ha encargado y completado una visita al sitio y/o una debida diligencia especializada para un cliente.',
      checks: ['Visita independiente al sitio', 'Observaciones de comunidad y acceso', 'Informe especializado de debida diligencia'],
      notCovered: 'Los hallazgos corresponden a un momento puntual y no reemplazan tu propio asesoramiento legal y técnico.',
    },
  },
}

type ProjectTranslation = {
  title: string
  transactionStatus: string
  summary: string
  highlights: string[]
  evidence: { label: string; detail: string }[]
  infrastructure: { access: string; power: string; water: string }
  documents: { name: string; kind: string }[]
  verification: {
    checkedBy: string
    scope: string[]
    notVerified: string[]
  }
  ownerKind: string
  ownerName?: string
}

export const PROJECTS_I18N: Record<Exclude<LanguageCode, 'en'>, Record<string, ProjectTranslation>> = {
  sw: {
    'MC-GE-0142': {
      title: 'Mradi wa Dhahabu wa Nyakabale Reef',
      transactionStatus: 'Wazi kwa uwekezaji — hakuna uhamisho wa haki unaopendekezwa',
      summary:
        'Kundi la leseni tatu za uchimbaji wa awali (PML) zinazopakana kwenye mfumo wa mwamba wa quartz katika Maeneo ya Dhahabu ya Ziwa Victoria. Wamiliki wanaendesha shimo dogo na mtambo wa majaribio wa CIL wa tani 4 kwa siku na wanatafuta mtaji wa kuongeza kina cha shimo na kupanua uchenjuaji.',
      highlights: ['PML tatu zinazopakana', 'Mtambo wa majaribio wa CIL upo eneo la mradi', 'Kumbukumbu za uzalishaji wa kila mwezi tangu 2023'],
      evidence: [
        { label: 'Maabara', detail: 'Sampuli 42 za mifereji, vyeti vya SGS Mwanza vimetolewa' },
        { label: 'Uzalishaji', detail: 'Risiti za mauzo za ofisi ya madini za miezi 18' },
        { label: 'Ramani', detail: 'Ramani ya mwamba wa juu ya ardhi, 1:2,000' },
      ],
      infrastructure: {
        access: 'Barabara ya changarawe inayopitika majira yote, km 14 hadi mjini Geita',
        power: 'Laini ya TANESCO km 2; jenereta za dizeli zipo eneo la mradi',
        water: 'Kisima kirefu + bwawa la msimu',
      },
      documents: [
        { name: 'Muhtasari wa awali wa mradi', kind: 'PDF · kurasa 6' },
        { name: 'Nakala za leseni (zilizofichwa sehemu)', kind: 'PDF · mafaili 3' },
        { name: 'Vyeti vya maabara (Assay)', kind: 'PDF · sampuli 42' },
        { name: 'Daftari la uzalishaji 2023–2026', kind: 'XLSX' },
      ],
      verification: {
        checkedBy: 'Mwanajiolojia aliyesajiliwa (jopo la uthibitishaji la MineConnect)',
        scope: ['Utambulisho wa mmiliki na usajili wa kampuni', 'Hali ya leseni dhidi ya kumbukumbu zilizotolewa', 'Vyeti vya maabara na mbinu za uchukuaji sampuli'],
        notVerified: ['Rasilimali au akiba ya madini', 'Viwango vya uzalishaji vya baadaye', 'Hali ya eneo (hakuna ziara ya eneo iliyofanyika)'],
      },
      ownerKind: 'Mwendeshaji wa kati',
    },
    'MC-MY-0087': {
      title: 'Ushirika wa Tanzanite wa Mererani Kitalu D',
      transactionStatus: 'Inatafuta mshirika wa uendeshaji — kwa ridhaa ya mamlaka ya leseni inapohitajika',
      summary:
        'Mgodi hai wa chini ya ardhi wa tanzanite ndani ya eneo lililodhibitiwa la Mererani. Mmiliki anatafuta mshirika wa kiufundi na kifedha ili kuweka mitambo ya ubebaji, kuboresha uingizaji hewa na kurasimisha upangaji madaraja na mauzo.',
      highlights: ['Ndani ya eneo lililodhibitiwa la Mererani', 'Njia hai za uchimbaji chini ya ardhi', 'Mauzo rasmi kupitia kituo cha biashara cha Mererani'],
      evidence: [
        { label: 'Mauzo', detail: 'Kumbukumbu za mauzo za kituo cha biashara, 2024–2026' },
        { label: 'Njia za mgodi', detail: 'Ramani ya chini ya ardhi na upimaji wa viwango' },
      ],
      infrastructure: {
        access: 'Barabara ya lami hadi Mererani, km 60 kutoka Arusha',
        power: 'Imeunganishwa na gridi ya taifa',
        water: 'Maji yanayoletwa kwa malori',
      },
      documents: [
        { name: 'Maelezo ya jumla ya mradi', kind: 'PDF · kurasa 4' },
        { name: 'Mpango wa chini ya ardhi', kind: 'DWG + PDF' },
        { name: 'Kumbukumbu za mauzo', kind: 'PDF' },
      ],
      verification: {
        checkedBy: 'Afisa uzingatiaji wa MineConnect',
        scope: ['Utambulisho wa mmiliki', 'Nambari ya leseni, mmiliki na tarehe ya kuisha'],
        notVerified: ['Ushahidi wa kiufundi', 'Kiasi cha mauzo', 'Uwezekano wa kuhamisha leseni'],
      },
      ownerKind: 'Ushirika wa wachimbaji wadogo',
    },
    'MC-LI-0219': {
      title: 'Utafutaji wa Kinywe wa Ruangwa Kaskazini',
      transactionStatus: 'Mazungumzo ya kuingia kwa hatua (farm-in / earn-in) yanakaribishwa',
      summary:
        'Leseni ya utafutaji inayofunika ukanda wa miamba ya kinywe (graphite) sambamba na migodi inayozalisha katika wilaya ya Ruangwa. Uchimbaji wa mifereji na programu ya awali ya uchorongaji wa almasi ya mita 1,200 imekamilika.',
      highlights: ['Uchorongaji wa almasi wa mita 1,200 umekamilika', 'Sambamba na migodi inayozalisha', 'Majaribio ya kimetali ya ukubwa wa chembechembe yanaendelea'],
      evidence: [
        { label: 'Uchorongaji', detail: 'Mashimo 14, kumbukumbu za miamba (core) na picha' },
        { label: 'Jiofizikia', detail: 'Utafiti wa EM wa ardhini, 2025' },
        { label: 'Maabara', detail: 'Vipimo vya TGC, vyeti vya ALS' },
      ],
      infrastructure: {
        access: 'Barabara ya changarawe hadi Ruangwa; bandari ya Mtwara km 220',
        power: 'Nje ya gridi ya taifa',
        water: 'Mto wa msimu; visima virefu vimepangwa',
      },
      documents: [
        { name: 'Muhtasari wa kiufundi', kind: 'PDF · kurasa 22' },
        { name: 'Kumbukumbu za uchorongaji na picha', kind: 'ZIP' },
        { name: 'Ripoti ya utafiti wa EM', kind: 'PDF' },
      ],
      verification: {
        checkedBy: 'Mwanajiolojia mshauri huru, aliyeagizwa na mwekezaji',
        scope: ['KYC na kumbukumbu za kampuni', 'Kumbukumbu za leseni', 'Mapitio ya sampuli za miamba na QA/QC', 'Ziara ya eneo (siku 2)'],
        notVerified: ['Rasilimali inayokidhi viwango vya JORC/NI 43-101', 'Masharti ya ununuzi (offtake)'],
      },
      ownerKind: 'Kampuni ya utafutaji madini',
    },
    'MC-KT-0063': {
      title: 'Mradi wa Utafutaji wa Shaba–Fedha wa Mpanda',
      transactionStatus: 'Mshirika wa ubia (JV) anatafutwa kwa awamu ya uchorongaji',
      summary:
        'Maeneo ya kihistoria ya uchimbaji wa shaba na fedha ndani ya ukanda wa miamba ya mashapo. Jiokemia ya udongo inaonyesha anomalia ya km 2.4. Mmiliki anatafuta mshirika wa kufadhili programu ya kwanza ya uchorongaji.',
      highlights: ['Machimbo ya kihistoria ndani ya leseni', 'Anomalia ya udongo ya km 2.4', 'Maeneo lengwa ya uchorongaji yamebainishwa'],
      evidence: [
        { label: 'Jiokemia', detail: 'Sampuli 610 za udongo' },
        { label: 'Ramani', detail: 'Ramani ya kikanda na ripoti za kihistoria' },
      ],
      infrastructure: {
        access: 'Changarawe, km 30 kutoka Mpanda',
        power: 'Nje ya gridi',
        water: 'Mto upo karibu',
      },
      documents: [
        { name: 'Muhtasari wa mradi', kind: 'PDF' },
        { name: 'Kanzidata ya jiokemia ya udongo', kind: 'CSV' },
      ],
      verification: {
        checkedBy: 'Timu ya usajili ya MineConnect',
        scope: ['Utambulisho wa mmiliki', 'Ukamilifu wa nyaraka'],
        notVerified: ['Hali ya leseni', 'Madai ya kiufundi'],
      },
      ownerKind: 'Mmiliki wa mradi',
    },
    'MC-SH-0155': {
      title: 'Kiwanda cha Kuchenjua Marudio ya Dhahabu Kahama',
      transactionStatus: 'Inatafuta ufadhili wa mradi kwa upanuzi wa kiwanda',
      summary:
        'Kiwanda cha uchenjuaji chenye leseni kinachochakata mabaki ya mchanga wa dhahabu (tailings) chini ya mikataba ya ununuzi na wachimbaji wadogo wanaozunguka. Upanuzi kutoka tani 40 hadi 120 kwa siku umepangwa.',
      highlights: ['Kiwanda cha uchenjuaji chenye leseni', 'Mikataba ya malighafi na wachimbaji 60+', 'Mpango wa usimamizi wa mazingira upo'],
      evidence: [
        { label: 'Uendeshaji', detail: 'Kumbukumbu za uzalishaji wa kiwanda' },
        { label: 'Mazingira', detail: 'EMP iliyoidhinishwa na ripoti za ufuatiliaji' },
      ],
      infrastructure: {
        access: 'Lami, km 8 kutoka Kahama',
        power: 'Imeunganishwa na gridi',
        water: 'Maji yanayorejelezwa + kisima kirefu',
      },
      documents: [
        { name: 'Mpango wa biashara wa upanuzi', kind: 'PDF · kurasa 31' },
        { name: 'Taarifa za fedha', kind: 'PDF' },
      ],
      verification: {
        checkedBy: 'Afisa uzingatiaji wa MineConnect',
        scope: ['Kumbukumbu za kampuni', 'Kumbukumbu ya leseni ya uchenjuaji'],
        notVerified: ['Taarifa za fedha', 'Madai ya uwezo wa uzalishaji'],
      },
      ownerKind: 'Mchenjuaji',
    },
    'MC-MO-0111': {
      title: 'Vitalu vya Vito vya Rubi na Spineli Ulanga',
      transactionStatus: 'Ugawaji unatolewa — kwa kuzingatia mchakato wa kisheria na ridhaa',
      summary:
        'Leseni mbili za PML juu ya changarawe za vito za mito. Uchimbaji wa mikono umepata rubi na spineli. Wamiliki wako tayari kwa ugawaji au ushirika, kwa kuzingatia mchakato wa kisheria wa uhamisho.',
      highlights: ['PML mbili', 'Vifurushi vya rubi na spineli vilivyopatikana', 'Mikataba ya jamii imeandikwa'],
      evidence: [{ label: 'Upatikanaji', detail: 'Ripoti za kijemolojia za sampuli za vito' }],
      infrastructure: { access: 'Barabara ya msimu, gari la 4x4 linahitajika', power: 'Hakuna', water: 'Mto' },
      documents: [{ name: 'Maelezo ya jumla', kind: 'PDF' }],
      verification: {
        checkedBy: 'Uhakiki wa awali pekee',
        scope: ['Uhakiki wa madai yaliyopigwa marufuku'],
        notVerified: ['Utambulisho', 'Leseni', 'Ushahidi wa kiufundi'],
      },
      ownerName: 'Mmiliki binafsi',
      ownerKind: 'Mchimbaji mdogo',
    },
    'MC-MA-0098': {
      title: 'Leseni za Dhahabu za Pembezoni mwa Nyamongo',
      transactionStatus: 'Ushirika unapendelewa; uhamisho kwa mchakato wa kisheria pekee',
      summary:
        'Leseni za PML zinazopakana katika ukanda wa mawe ya kijani wa Mara zenye mashimo ya wachimbaji wadogo. Uchukuaji wa sampuli za awali na uchoraji ramani za mashimo umekamilika.',
      highlights: ['Ukanda wa dhahabu wa Mara', 'Mashimo ya wachimbaji wadogo kwenye mwamba', 'Barabara inapitika mwaka mzima'],
      evidence: [{ label: 'Sampuli', detail: 'Sampuli 25 za awali (elekezi pekee)' }],
      infrastructure: { access: 'Changarawe, km 22 kutoka Tarime', power: 'Gridi ndani ya km 5', water: 'Kisima kirefu' },
      documents: [{ name: 'Muhtasari wa awali', kind: 'PDF' }],
      verification: {
        checkedBy: 'Timu ya usajili ya MineConnect',
        scope: ['Utambulisho', 'Ukamilifu wa nyaraka'],
        notVerified: ['Hali ya leseni', 'Madai ya kiufundi'],
      },
      ownerKind: 'Kikundi cha wachimbaji wadogo',
    },
    'MC-RV-0071': {
      title: 'Ushirika wa Usambazaji wa Makaa ya Mawe Mbinga',
      transactionStatus: 'Ufadhili wa vifaa unatafutwa',
      summary:
        'Mmiliki wa leseni ya uchimbaji (ML) anayesambazia wateja wa saruji na viwanda vya kikanda. Anatafuta ufadhili wa kuongeza mashine za kuchimba (excavators) na malori chini ya mikataba iliyopo ya usambazaji.',
      highlights: ['Leseni ya Uchimbaji (ML)', 'Mikataba ya usambazaji viwandani iliyosainiwa', 'Mpango wa upanuzi wa magari na mitambo'],
      evidence: [{ label: 'Kibiashara', detail: 'Mikataba ya usambazaji (iliyofichwa sehemu)' }],
      infrastructure: { access: 'Changarawe hadi barabara ya Songea–Mbinga', power: 'Dizeli', water: 'Visima virefu' },
      documents: [{ name: 'Orodha ya mitambo inayohitajika', kind: 'XLSX' }],
      verification: {
        checkedBy: 'Afisa uzingatiaji wa MineConnect',
        scope: ['Kumbukumbu za kampuni', 'Kumbukumbu ya leseni'],
        notVerified: ['Thamani za mikataba', 'Ubora wa makaa ya mawe'],
      },
      ownerKind: 'Kampuni ya uchimbaji madini',
    },
    'MC-SW-0130': {
      title: 'Uboreshaji Mitambo ya Dhahabu ya Mito Chunya',
      transactionStatus: 'Ushirika wa hisa au vifaa',
      summary:
        'Mradi wa dhahabu ya mchangani katika eneo la dhahabu la Lupa unaotumia mtambo mdogo wa kuoshea. Uwekezaji unatafutwa kufunga mtambo wa kisasa wa mvuto (gravity circuit) na kuboresha uokoaji dhahabu na usimamizi wa maji.',
      highlights: ['Eneo la dhahabu la Lupa', 'Mtambo wa kuoshea unafanya kazi', 'Uboreshaji wa mtambo wa mvuto umepangwa'],
      evidence: [{ label: 'Uzalishaji', detail: 'Risiti za ofisi ya madini, miezi 12' }],
      infrastructure: { access: 'Changarawe, km 35 kutoka Chunya', power: 'Dizeli', water: 'Mabwawa ya kurejeleza maji' },
      documents: [{ name: 'Muhtasari wa awali', kind: 'PDF' }],
      verification: {
        checkedBy: 'Mhandisi wa migodi aliyesajiliwa (jopo la uthibitishaji)',
        scope: ['KYC', 'Kumbukumbu ya leseni', 'Mapitio ya kumbukumbu za uzalishaji na muundo wa mtambo'],
        notVerified: ['Makadirio ya rasilimali', 'Hali ya eneo la mradi'],
      },
      ownerKind: 'Mwendeshaji mdogo',
    },
    'MC-TN-0044': {
      title: 'Mawe ya Chokaa na Madini ya Viwandani Handeni',
      transactionStatus: 'Ubia na mzalishaji wa vifaa vya ujenzi unatafutwa',
      summary:
        'Miamba ya mawe ya chokaa yenye kalsiamu nyingi karibu na ukanda wa saruji wa Tanga pamoja na uchunguzi wa kikemikali uliokamilika. Inafaa kwa uzalishaji wa saruji, chokaa na chokaa ya kilimo.',
      highlights: ['Karibu na ukanda wa saruji wa Tanga', 'Majaribio ya kikemikali yamekamilika', 'Ufikikaji wa reli na bandari'],
      evidence: [{ label: 'Maabara', detail: 'Uchambuzi wa XRF, sampuli 80' }],
      infrastructure: { access: 'Barabara ya lami km 12', power: 'Gridi km 3', water: 'Kisima kirefu' },
      documents: [{ name: 'Muhtasari wa kiufundi', kind: 'PDF' }],
      verification: {
        checkedBy: 'Afisa uzingatiaji wa MineConnect',
        scope: ['Kumbukumbu za kampuni', 'Kumbukumbu ya leseni'],
        notVerified: ['Matokeo ya maabara'],
      },
      ownerKind: 'Mmiliki wa mradi',
    },
    'MC-SH-0170': {
      title: 'Ushirika wa Eneo la Kimberlite la Maganzo',
      transactionStatus: 'Mshirika wa kiufundi anatafutwa',
      summary:
        'Leseni za uchimbaji mdogo juu ya changarawe katika eneo la Maganzo kwenye ukanda wa kimberlite wa Shinyanga. Inatafuta mshirika wa kiufundi mwenye uwezo wa kuchukua sampuli kubwa na DMS.',
      highlights: ['Mazingira ya mwamba wa kimberlite', 'Sampuli kubwa ya changarawe imepangwa', 'Makubaliano na jamii (MoU)'],
      evidence: [{ label: 'Upatikanaji', detail: 'Kumbukumbu za upatikanaji wa wachimbaji wadogo (hazijathibitishwa)' }],
      infrastructure: { access: 'Changarawe, km 20 kutoka Kishapu', power: 'Hakuna', water: 'Maji ya msimu' },
      documents: [{ name: 'Maelezo ya jumla', kind: 'PDF' }],
      verification: {
        checkedBy: 'Timu ya usajili ya MineConnect',
        scope: ['Utambulisho'],
        notVerified: ['Leseni', 'Kumbukumbu za upatikanaji'],
      },
      ownerKind: 'Chama cha wachimbaji wadogo',
    },
    'MC-MB-0182': {
      title: 'Utafutaji wa Madini Adimu ya Carbonatite Mbeya',
      transactionStatus: 'Mshirika wa kuingia kwa hatua (earn-in) anatafutwa',
      summary:
        'Leseni ya utafutaji inayofunika mwamba wa carbonatite uliochorwa ramani wenye viashiria vya mionzi. Sampuli za miamba zimerudisha viwango vya juu vya TREO; uchorongaji bado haujafanyika.',
      highlights: ['Mwamba wa carbonatite uliochorwa ramani', 'Viashiria vya mionzi vya anga', 'Msisitizo wa madini muhimu ya kimkakati'],
      evidence: [
        { label: 'Jiofizikia', detail: 'Vipimo vya mionzi vya anga (kanzidata yenye leseni)' },
        { label: 'Sampuli', detail: 'Sampuli 64 za vipande vya miamba' },
      ],
      infrastructure: { access: 'Changarawe km 18 kutoka Mbeya', power: 'Gridi km 6', water: 'Vijito vya maji' },
      documents: [{ name: 'Waraka wa kiufundi', kind: 'PDF' }],
      verification: {
        checkedBy: 'Mwanajiolojia aliyesajiliwa (jopo la uthibitishaji)',
        scope: ['KYC', 'Kumbukumbu ya leseni', 'QA/QC ya sampuli na vyeti vya maabara'],
        notVerified: ['Metalujia', 'Rasilimali ya madini'],
      },
      ownerKind: 'Kampuni ya utafutaji madini',
    },
  },
  es: {
    'MC-GE-0142': {
      title: 'Proyecto de Oro Nyakabale Reef',
      transactionStatus: 'Abierto a inversión — no se propone transferencia de derechos',
      summary:
        'Un grupo de tres licencias de minería primaria (PML) contiguas sobre un sistema de vetas de cuarzo en los Campos Auríferos del Lago Victoria. Los titulares operan un pique pequeño y un circuito piloto CIL de 4 toneladas por día, y buscan capital para profundizar el pique y ampliar el procesamiento.',
      highlights: ['Tres PML contiguas', 'Circuito piloto CIL en el sitio', 'Registros mensuales de producción desde 2023'],
      evidence: [
        { label: 'Ensayos', detail: '42 muestras de canal, certificados SGS Mwanza suministrados' },
        { label: 'Producción', detail: '18 meses de recibos de venta en oficina mineral' },
        { label: 'Mapeo', detail: 'Mapeo superficial de vetas, 1:2,000' },
      ],
      infrastructure: {
        access: 'Grava transitable todo el año, a 14 km de la ciudad de Geita',
        power: 'Línea TANESCO a 2 km; generadores diésel en sitio',
        water: 'Pozo perforado + represa estacional',
      },
      documents: [
        { name: 'Resumen ejecutivo del proyecto', kind: 'PDF · 6 págs.' },
        { name: 'Copias de licencias (testadas)', kind: 'PDF · 3 archivos' },
        { name: 'Certificados de ensayo', kind: 'PDF · 42 muestras' },
        { name: 'Libro de producción 2023–2026', kind: 'XLSX' },
      ],
      verification: {
        checkedBy: 'Geólogo registrado (panel de verificación de MineConnect)',
        scope: ['Identidad del titular y registro societario', 'Estado de licencia frente a registros suministrados', 'Certificados de ensayo y metodología de muestreo'],
        notVerified: ['Recursos o reservas minerales', 'Tasas de producción futuras', 'Condiciones del sitio (sin visita al sitio)'],
      },
      ownerKind: 'Operador de mediana escala',
    },
    'MC-MY-0087': {
      title: 'Asociación de Tanzanita Mererani Bloque D',
      transactionStatus: 'Busca socio operativo — sujeto al consentimiento de la autoridad de licencias cuando corresponda',
      summary:
        'Labores subterráneas activas de tanzanita dentro del área minera controlada de Mererani. El titular busca un socio técnico y financiero para mecanizar el acarreo, mejorar la ventilación y formalizar la clasificación y las ventas.',
      highlights: ['Dentro del área controlada de Mererani', 'Labores subterráneas activas', 'Ventas formales vía el centro comercial de Mererani'],
      evidence: [
        { label: 'Ventas', detail: 'Registros de ventas del centro comercial, 2024–2026' },
        { label: 'Labores', detail: 'Plano subterráneo y levantamiento de niveles' },
      ],
      infrastructure: {
        access: 'Asfalto hasta Mererani, a 60 km de Arusha',
        power: 'Conectado a la red eléctrica',
        water: 'Suministro por camión cisterna',
      },
      documents: [
        { name: 'Descripción general del proyecto', kind: 'PDF · 4 págs.' },
        { name: 'Plano subterráneo', kind: 'DWG + PDF' },
        { name: 'Registros de ventas', kind: 'PDF' },
      ],
      verification: {
        checkedBy: 'Oficial de cumplimiento de MineConnect',
        scope: ['Identidad del titular', 'Referencia de licencia, titular y vencimiento'],
        notVerified: ['Evidencia técnica', 'Volúmenes de venta', 'Transferibilidad de la licencia'],
      },
      ownerKind: 'Cooperativa de mineros de pequeña escala',
    },
    'MC-LI-0219': {
      title: 'Exploración de Grafito Ruangwa Norte',
      transactionStatus: 'Se invitan conversaciones de farm-in / earn-in',
      summary:
        'Licencia de prospección que cubre un cinturón de esquisto grafítico en rumbo con operaciones en producción en el distrito de Ruangwa. Se han completado zanjas y un programa inicial de perforación diamantina de 1,200 m.',
      highlights: ['1,200 m de perforación diamantina completados', 'En rumbo con operaciones en producción', 'Pruebas metalúrgicas de tamaño de escama en curso'],
      evidence: [
        { label: 'Perforación', detail: '14 pozos, testigos registrados y fotografía' },
        { label: 'Geofísica', detail: 'Levantamiento EM terrestre, 2025' },
        { label: 'Laboratorio', detail: 'Ensayos TGC, certificados ALS' },
      ],
      infrastructure: {
        access: 'Camino de grava a Ruangwa; puerto de Mtwara a 220 km',
        power: 'Fuera de la red',
        water: 'Río estacional; pozos planificados',
      },
      documents: [
        { name: 'Resumen técnico', kind: 'PDF · 22 págs.' },
        { name: 'Registros de perforación y fotos de testigos', kind: 'ZIP' },
        { name: 'Informe de estudio EM', kind: 'PDF' },
      ],
      verification: {
        checkedBy: 'Geólogo consultor independiente, encargado por inversor',
        scope: ['KYC y registros societarios', 'Registros de licencia', 'Revisión de testigos y QA/QC', 'Visita al sitio (2 días)'],
        notVerified: ['Recurso conforme a JORC/NI 43-101', 'Términos de compra (offtake)'],
      },
      ownerKind: 'Empresa de exploración',
    },
    'MC-KT-0063': {
      title: 'Prospecto de Cobre–Plata Mpanda',
      transactionStatus: 'Se busca socio JV para fase de perforación',
      summary:
        'Labores históricas de cobre y plata dentro de un cinturón alojado en sedimentos. La geoquímica de suelos define una anomalía de 2.4 km. El titular busca un socio para financiar un programa inaugural de perforación.',
      highlights: ['Labores históricas en la licencia', 'Anomalía de suelo de 2.4 km', 'Objetivos de perforación definidos'],
      evidence: [
        { label: 'Geoquímica', detail: '610 muestras de suelo' },
        { label: 'Mapeo', detail: 'Mapeo regional e informes históricos' },
      ],
      infrastructure: {
        access: 'Grava, a 30 km de Mpanda',
        power: 'Fuera de la red',
        water: 'Río adyacente',
      },
      documents: [
        { name: 'Resumen del prospecto', kind: 'PDF' },
        { name: 'Conjunto de datos geoquímicos de suelo', kind: 'CSV' },
      ],
      verification: {
        checkedBy: 'Equipo de incorporación de MineConnect',
        scope: ['Identidad del titular', 'Integridad documental'],
        notVerified: ['Estado de la licencia', 'Afirmaciones técnicas'],
      },
      ownerKind: 'Titular del proyecto',
    },
    'MC-SH-0155': {
      title: 'Planta de Reprocesamiento de Relaves de Oro Kahama',
      transactionStatus: 'Busca financiación de proyecto para ampliación de planta',
      summary:
        'Instalación de procesamiento con licencia que trata relaves artesanales bajo acuerdos de compra con mineros de pequeña escala de los alrededores. Se planea ampliar de 40 a 120 toneladas por día.',
      highlights: ['Planta de procesamiento con licencia', 'Acuerdos de suministro con más de 60 mineros', 'Plan de gestión ambiental vigente'],
      evidence: [
        { label: 'Operaciones', detail: 'Registros de capacidad de procesamiento de planta' },
        { label: 'Ambiente', detail: 'PMA aprobado e informes de monitoreo' },
      ],
      infrastructure: {
        access: 'Asfalto, a 8 km de Kahama',
        power: 'Conectado a la red',
        water: 'Agua de proceso reciclada + pozo',
      },
      documents: [
        { name: 'Plan de negocios de expansión', kind: 'PDF · 31 págs.' },
        { name: 'Estados financieros', kind: 'PDF' },
      ],
      verification: {
        checkedBy: 'Oficial de cumplimiento de MineConnect',
        scope: ['Registros societarios', 'Registro de licencia de procesamiento'],
        notVerified: ['Estados financieros', 'Afirmaciones de rendimiento'],
      },
      ownerKind: 'Procesador',
    },
    'MC-MO-0111': {
      title: 'Concesiones de Rubí y Espinela Ulanga',
      transactionStatus: 'Cesión ofrecida — sujeta a proceso legal y consentimiento',
      summary:
        'Dos PML sobre gravas aluviales y eluviales de piedras preciosas. La minería manual ha recuperado rubí y espinela. Los titulares están abiertos a una cesión o asociación, sujeta al proceso legal de transferencia.',
      highlights: ['Dos PML', 'Lotes recuperados de rubí y espinela', 'Acuerdos comunitarios documentados'],
      evidence: [{ label: 'Recuperaciones', detail: 'Informes gemológicos sobre lotes de muestra' }],
      infrastructure: { access: 'Pista estacional, requiere 4x4', power: 'Ninguna', water: 'Río' },
      documents: [{ name: 'Descripción general', kind: 'PDF' }],
      verification: {
        checkedBy: 'Solo moderación',
        scope: ['Moderación de declaraciones prohibidas'],
        notVerified: ['Identidad', 'Licencia', 'Evidencia técnica'],
      },
      ownerName: 'Titular privado',
      ownerKind: 'Minero de pequeña escala',
    },
    'MC-MA-0098': {
      title: 'Licencias de Oro en la Franja de Nyamongo',
      transactionStatus: 'Se prefiere asociación; transferencia solo mediante proceso legal',
      summary:
        'PML contiguas en el cinturón de rocas verdes de Mara con cateos artesanales a lo largo de un contacto cizallado. Se completó muestreo inicial de fragmentos y mapeo de pozos.',
      highlights: ['Cinturón de rocas verdes de Mara', 'Cateos artesanales en zona de cizalla', 'Acceso vial todo el año'],
      evidence: [{ label: 'Muestreo', detail: '25 muestras puntuales (solo indicativas)' }],
      infrastructure: { access: 'Grava, a 22 km de Tarime', power: 'Red eléctrica a menos de 5 km', water: 'Pozo perforado' },
      documents: [{ name: 'Resumen ejecutivo', kind: 'PDF' }],
      verification: {
        checkedBy: 'Equipo de incorporación de MineConnect',
        scope: ['Identidad', 'Integridad documental'],
        notVerified: ['Estado de la licencia', 'Afirmaciones técnicas'],
      },
      ownerKind: 'Grupo de mineros de pequeña escala',
    },
    'MC-RV-0071': {
      title: 'Asociación de Suministro de Carbón Térmico Mbinga',
      transactionStatus: 'Se busca financiación de equipos',
      summary:
        'Titular de licencia minera (ML) que abastece a clientes regionales de cemento e industria. Busca financiación para una flota adicional de excavadoras y camiones de acarreo bajo contratos de suministro vigentes.',
      highlights: ['Licencia de Minería (ML)', 'Contratos de suministro industrial firmados', 'Plan de ampliación de flota'],
      evidence: [{ label: 'Comercial', detail: 'Contratos de suministro (testados)' }],
      infrastructure: { access: 'Grava hacia la carretera Songea–Mbinga', power: 'Diésel', water: 'Pozos perforados' },
      documents: [{ name: 'Cronograma de equipos', kind: 'XLSX' }],
      verification: {
        checkedBy: 'Oficial de cumplimiento de MineConnect',
        scope: ['Registros societarios', 'Registro de licencia'],
        notVerified: ['Valores de contratos', 'Calidad del carbón'],
      },
      ownerKind: 'Empresa minera',
    },
    'MC-SW-0130': {
      title: 'Mecanización de Oro Aluvial Chunya',
      transactionStatus: 'Asociación de capital o de equipos',
      summary:
        'Operación de oro aluvial en el campo aurífero de Lupa que utiliza una pequeña planta de lavado. Se busca inversión para instalar un circuito gravimétrico modular y mejorar la recuperación y la gestión del agua.',
      highlights: ['Campo aurífero de Lupa', 'Planta de lavado en operación', 'Mejora de circuito gravimétrico planificada'],
      evidence: [{ label: 'Producción', detail: 'Recibos de oficina mineral, 12 meses' }],
      infrastructure: { access: 'Grava, a 35 km de Chunya', power: 'Diésel', water: 'Estanques de reciclaje' },
      documents: [{ name: 'Resumen ejecutivo', kind: 'PDF' }],
      verification: {
        checkedBy: 'Ingeniero de minas registrado (panel de verificación)',
        scope: ['KYC', 'Registro de licencia', 'Registros de producción y revisión de diseño de planta'],
        notVerified: ['Estimación de recursos', 'Condiciones del sitio'],
      },
      ownerKind: 'Operador de pequeña escala',
    },
    'MC-TN-0044': {
      title: 'Caliza y Minerales Industriales Handeni',
      transactionStatus: 'Se busca JV con productor de materiales de construcción',
      summary:
        'Afloramientos de caliza con alto contenido de calcio cerca del corredor cementero de Tanga con análisis químicos completados. Adecuado para cemento, cal y aplicaciones de cal agrícola.',
      highlights: ['Cerca del corredor cementero de Tanga', 'Pruebas químicas completadas', 'Acceso ferroviario y portuario'],
      evidence: [{ label: 'Laboratorio', detail: 'Análisis XRF, 80 muestras' }],
      infrastructure: { access: 'Asfalto a 12 km', power: 'Red eléctrica a 3 km', water: 'Pozo perforado' },
      documents: [{ name: 'Resumen técnico', kind: 'PDF' }],
      verification: {
        checkedBy: 'Oficial de cumplimiento de MineConnect',
        scope: ['Registros societarios', 'Registro de licencia'],
        notVerified: ['Resultados de laboratorio'],
      },
      ownerKind: 'Titular del proyecto',
    },
    'MC-SH-0170': {
      title: 'Asociación en Campo de Kimberlita Maganzo',
      transactionStatus: 'Se busca socio técnico',
      summary:
        'Licencias de pequeña escala sobre gravas en el área de Maganzo del campo de kimberlita de Shinyanga. Se busca un socio técnico con capacidad de muestreo masivo y separación en medio denso (DMS).',
      highlights: ['Entorno de campo de kimberlita', 'Muestreo masivo de grava planificado', 'MoU comunitario'],
      evidence: [{ label: 'Recuperaciones', detail: 'Registros de recuperación artesanal (no verificados)' }],
      infrastructure: { access: 'Grava, a 20 km de Kishapu', power: 'Ninguna', water: 'Estacional' },
      documents: [{ name: 'Descripción general', kind: 'PDF' }],
      verification: {
        checkedBy: 'Equipo de incorporación de MineConnect',
        scope: ['Identidad'],
        notVerified: ['Licencia', 'Recuperaciones'],
      },
      ownerKind: 'Asociación de mineros de pequeña escala',
    },
    'MC-MB-0182': {
      title: 'Exploración de Carbonatita de Tierras Raras Mbeya',
      transactionStatus: 'Se busca socio earn-in',
      summary:
        'Licencia de prospección que cubre un complejo de carbonatita mapeado con anomalías radiométricas. El muestreo de esquirlas de roca ha arrojado valores elevados de TREO; aún no se ha realizado perforación.',
      highlights: ['Complejo de carbonatita mapeado', 'Anomalía radiométrica aérea', 'Enfoque en minerales críticos'],
      evidence: [
        { label: 'Geofísica', detail: 'Radiometría aérea (conjunto de datos con licencia)' },
        { label: 'Muestreo', detail: '64 muestras de esquirlas de roca' },
      ],
      infrastructure: { access: 'Grava a 18 km de Mbeya', power: 'Red eléctrica a 6 km', water: 'Arroyos' },
      documents: [{ name: 'Memorando técnico', kind: 'PDF' }],
      verification: {
        checkedBy: 'Geólogo registrado (panel de verificación)',
        scope: ['KYC', 'Registro de licencia', 'QA/QC de muestreo y certificados de laboratorio'],
        notVerified: ['Metalurgia', 'Recursos'],
      },
      ownerKind: 'Empresa de exploración',
    },
  },
}

export const SERVICE_PROVIDERS_I18N: Record<
  Exclude<LanguageCode, 'en'>,
  Record<string, { summary: string; services: string[] }>
> = {
  sw: {
    'sp-01': {
      summary: 'Wanajiolojia waliosajiliwa kwa uchoraji ramani, programu za sampuli na utoaji ripoti za kiufundi katika Maeneo ya Dhahabu ya Ziwa Victoria.',
      services: ['Ramani za kijiolojia', 'Ubunifu wa uchukuaji sampuli', 'Ripoti za kiufundi'],
    },
    'sp-02': {
      summary: 'Uchambuzi wa Fire assay, AAS na ICP pamoja na nyaraka za mnyororo wa ulinzi wa sampuli zinazofaa kwa mapitio ya wawekezaji.',
      services: ['Fire assay', 'ICP-OES', 'Maandalizi ya sampuli'],
    },
    'sp-03': {
      summary: 'Mitambo ya uchorongaji wa almasi na RC yenye timu zenye uzoefu; mkandarasi mwenye leseni ya ulipuaji miamba.',
      services: ['Uchorongaji wa almasi', 'Uchorongaji wa RC', 'Ulipuaji wenye leseni'],
    },
    'sp-04': {
      summary: 'Wapimaji ardhi wenye leseni kwa uwekaji vigingi vya mipaka, picha za droni na ramani za GIS.',
      services: ['Upimaji mipaka', 'Ramani za droni', 'GIS'],
    },
    'sp-05': {
      summary: 'Tathmini za athari kwa mazingira (EIA), mipango ya usimamizi na ushirikishwaji wa jamii kwa miradi ya madini.',
      services: ['EIA', 'EMP', 'Ushirikishwaji wa jamii'],
    },
    'sp-06': {
      summary: 'Miamala ya haki za madini, ugawaji, uundaji wa ubia (JV) na ushauri wa kisheria chini ya sheria za Tanzania.',
      services: ['Ugawaji wa haki', 'Mikataba ya ubia (JV)', 'Ushauri wa kisheria'],
    },
    'sp-07': {
      summary: 'Mashine za kuchimba (excavators), vipondaji mawe, jenereta na kompresa kwa kukodisha au kukodisha-hadi-kumiliki Kanda ya Ziwa.',
      services: ['Kukodisha mitambo', 'Kukodisha-hadi-kumiliki', 'Matengenezo'],
    },
    'sp-08': {
      summary: 'Majaribio ya maabara, ubunifu wa mitambo ya mvuto na CIL, na uboreshaji wa viwanda kwa migodi midogo na ya kati.',
      services: ['Majaribio ya kimetali', 'Ubunifu wa mitambo', 'Uboreshaji wa kiwanda'],
    },
  },
  es: {
    'sp-01': {
      summary: 'Geólogos registrados para mapeo, programas de muestreo e informes técnicos en los Campos Auríferos del Lago Victoria.',
      services: ['Mapeo geológico', 'Diseño de muestreo', 'Informes técnicos'],
    },
    'sp-02': {
      summary: 'Análisis por ensayo al fuego, AAS e ICP con documentación de cadena de custodia apta para revisión de inversores.',
      services: ['Ensayo al fuego', 'ICP-OES', 'Preparación de muestras'],
    },
    'sp-03': {
      summary: 'Equipos de perforación diamantina y RC con cuadrillas experimentadas; contratista de voladura con licencia.',
      services: ['Perforación diamantina', 'Perforación RC', 'Voladura con licencia'],
    },
    'sp-04': {
      summary: 'Topógrafos con licencia para amojonamiento de linderos, fotogrametría con drones y entregables listos para SIG.',
      services: ['Levantamiento de linderos', 'Mapeo con drones', 'SIG (GIS)'],
    },
    'sp-05': {
      summary: 'Evaluaciones de impacto ambiental, planes de manejo y relacionamiento comunitario para proyectos mineros.',
      services: ['EIA', 'PMA (EMP)', 'Relacionamiento comunitario'],
    },
    'sp-06': {
      summary: 'Transacciones de derechos mineros, cesiones, estructuración de JV y asesoría regulatoria bajo la ley de Tanzania.',
      services: ['Cesión de derechos', 'Acuerdos de JV', 'Asesoría regulatoria'],
    },
    'sp-07': {
      summary: 'Excavadoras, trituradoras, generadores y compresores en alquiler o alquiler con opción a compra en la Zona del Lago.',
      services: ['Alquiler de equipos', 'Alquiler con opción a compra', 'Mantenimiento'],
    },
    'sp-08': {
      summary: 'Pruebas metalúrgicas, diseño de circuitos gravimétricos y CIL, y optimización de plantas para pequeñas y medianas operaciones.',
      services: ['Pruebas metalúrgicas', 'Diseño de circuitos', 'Optimización de planta'],
    },
  },
}

export const PLANS_I18N: Record<
  Exclude<LanguageCode, 'en'>,
  Record<string, { name: string; price: string; period: string; yearly?: string; audience: string; features: string[] }>
> = {
  sw: {
    explorer: {
      name: 'Mchunguzi (Explorer)',
      price: 'Bure',
      period: '',
      audience: 'Mtu yeyote anayechunguza soko',
      features: ['Utafutaji wa msingi na vichujio', 'Matangazo ya umma yaliyochaguliwa', 'Utafutaji uliohifadhiwa', 'Akaunti binafsi'],
    },
    miner: {
      name: 'Mchimbaji (Miner)',
      price: 'TSh 50,000',
      period: '/mwezi',
      yearly: 'TSh 500,000/mwaka',
      audience: 'Wachimbaji wadogo na wamiliki wa PML',
      features: ['Hadi matangazo 3 ya miradi', 'Wasifu wa msingi wa mmiliki', 'Maombi ya wawekezaji', 'Arifa za barua pepe na SMS'],
    },
    professional: {
      name: 'Mtaalamu (Professional)',
      price: 'TSh 150,000',
      period: '/mwezi',
      yearly: 'TSh 1.5M/mwaka',
      audience: 'Wamiliki wa miradi na wataalamu',
      features: ['Hadi matangazo 10 ya miradi', 'Kurasa za miradi zilizoboreshwa', 'Uhifadhi wa nyaraka', 'Takwimu za matangazo', 'Kipaumbele cha kuonekana'],
    },
    investor: {
      name: 'Mwekezaji (Investor)',
      price: 'TSh 300,000',
      period: '/mwezi',
      yearly: 'TSh 3M/mwaka',
      audience: 'Wawekezaji na kampuni za uwekezaji',
      features: ['Utafutaji wa kina na vichujio vya ramani', 'Taarifa mahususi za kisekta', 'Ufikiaji wa vyumba vya makubaliano', 'Arifa na ulinganishaji wa wawekezaji'],
    },
    corporate: {
      name: 'Shirika (Corporate)',
      price: 'TSh 1M+',
      period: '/mwezi',
      audience: 'Kampuni za madini na taasisi',
      features: ['Akaunti nyingi za timu', 'Wasifu wa shirika', 'Mwonekano wa hali ya juu', 'Ufikiaji wa taarifa za kina', 'Msaada maalum wa akaunti'],
    },
  },
  es: {
    explorer: {
      name: 'Explorador',
      price: 'Gratis',
      period: '',
      audience: 'Cualquier persona que explore el mercado',
      features: ['Búsqueda y filtros básicos', 'Publicaciones públicas seleccionadas', 'Búsquedas guardadas', 'Cuenta personal'],
    },
    miner: {
      name: 'Minero',
      price: 'TSh 50,000',
      period: '/mes',
      yearly: 'TSh 500,000/año',
      audience: 'Mineros de pequeña escala y titulares de PML',
      features: ['Hasta 3 publicaciones de proyectos', 'Perfil básico de titular', 'Consultas de inversores', 'Notificaciones por correo y SMS'],
    },
    professional: {
      name: 'Profesional',
      price: 'TSh 150,000',
      period: '/mes',
      yearly: 'TSh 1.5M/año',
      audience: 'Titulares de proyectos y profesionales',
      features: ['Hasta 10 publicaciones de proyectos', 'Páginas de proyecto mejoradas', 'Alojamiento de documentos', 'Analítica de publicaciones', 'Ubicación prioritaria'],
    },
    investor: {
      name: 'Inversor',
      price: 'TSh 300,000',
      period: '/mes',
      yearly: 'TSh 3M/año',
      audience: 'Inversores y sociedades de inversión',
      features: ['Búsqueda avanzada y filtros de mapa', 'Inteligencia minera seleccionada', 'Acceso a salas de datos', 'Alertas y emparejamiento de inversores'],
    },
    corporate: {
      name: 'Corporativo',
      price: 'TSh 1M+',
      period: '/mes',
      audience: 'Empresas mineras e instituciones',
      features: ['Múltiples puestos de equipo', 'Perfil corporativo', 'Visibilidad premium', 'Acceso a inteligencia', 'Soporte de cuenta dedicado'],
    },
  },
}

export const SERVICES_PRICING_I18N: Record<
  Exclude<LanguageCode, 'en'>,
  { product: string; price: string; customer: string; type: string }[]
> = {
  sw: [
    { product: 'Tangazo la msingi', price: 'TSh 50k – 100k', customer: 'Mmiliki wa mradi', type: 'Mara moja' },
    { product: 'Tangazo lililothibitishwa', price: 'TSh 250k – 750k', customer: 'Mmiliki wa mradi', type: 'Mara moja, kulingana na wigo' },
    { product: 'Uwekaji maalum (Featured)', price: 'TSh 100k – 500k', customer: 'Mmiliki / mtoa huduma', type: 'Kwa kampeni / mwezi' },
    { product: 'Uratibu wa uhakiki wa kina', price: 'TSh 500k – 5M+', customer: 'Mwekezaji / mmiliki wa mradi', type: 'Huduma, bila gharama za wahusika wa tatu' },
    { product: 'Ada ya mafanikio / uwezeshaji', price: '1 – 5% iliyokubaliwa', customer: 'Pande za muamala', type: 'Inakubaliwa kwa maandishi awali' },
  ],
  es: [
    { product: 'Publicación básica', price: 'TSh 50k – 100k', customer: 'Titular del proyecto', type: 'Pago único' },
    { product: 'Publicación verificada', price: 'TSh 250k – 750k', customer: 'Titular del proyecto', type: 'Pago único, según alcance' },
    { product: 'Ubicación destacada', price: 'TSh 100k – 500k', customer: 'Titular / proveedor de servicios', type: 'Por campaña / mes' },
    { product: 'Coordinación de debida diligencia', price: 'TSh 500k – 5M+', customer: 'Inversor / titular del proyecto', type: 'Servicio, excl. costos de terceros' },
    { product: 'Comisión de éxito / facilitación', price: '1 – 5% acordado', customer: 'Partes de la transacción', type: 'Acordado por escrito de antemano' },
  ],
}

export const INSIGHTS_I18N: Record<
  Exclude<LanguageCode, 'en'>,
  { title: string; tag: string; minutes: number; excerpt: string }[]
> = {
  sw: [
    {
      title: 'PML, PL, ML, SML: kile ambacho kila haki ya madini inaruhusu hasa',
      tag: 'Mwongozo',
      minutes: 7,
      excerpt: 'Maelezo kwa lugha rahisi kuhusu aina za haki za madini nchini Tanzania — na kwa nini tangazo kamwe halimaanishi idhini ya leseni.',
    },
    {
      title: 'Kusoma cheti cha maabara (assay) kabla ya kusaini NDA',
      tag: 'Uhakiki wa kina',
      minutes: 5,
      excerpt: 'Mnyororo wa ulinzi wa sampuli, viwango vya ugunduzi na viashiria vya hatari ambavyo wakaguzi wetu wa kiufundi huona mara nyingi.',
    },
    {
      title: 'Kuunda ubia wa haki na mchimbaji mdogo',
      tag: 'Muundo wa makubaliano',
      minutes: 9,
      excerpt: 'Makubaliano ya kuingia kwa hatua, ushirika wa uendeshaji na jinsi ya kulinda pande zote mbili ndani ya mchakato wa kisheria wa uhamisho.',
    },
  ],
  es: [
    {
      title: 'PML, PL, ML, SML: qué permite realmente cada derecho minero',
      tag: 'Guía',
      minutes: 7,
      excerpt: 'Una introducción clara a las categorías de derechos mineros de Tanzania — y por qué una publicación nunca equivale a la aprobación de una licencia.',
    },
    {
      title: 'Cómo leer un certificado de ensayo antes de firmar un NDA',
      tag: 'Debida diligencia',
      minutes: 5,
      excerpt: 'Cadena de custodia, límites de detección y las señales de alerta que nuestros revisores técnicos ven con más frecuencia.',
    },
    {
      title: 'Estructuración de una empresa conjunta justa con un minero de pequeña escala',
      tag: 'Estructuración de acuerdos',
      minutes: 9,
      excerpt: 'Acuerdos earn-in, asociaciones operativas y cómo proteger a ambas partes dentro del proceso legal de transferencia.',
    },
  ],
}

export const PLATFORM_STATS_I18N: Record<Exclude<LanguageCode, 'en'>, { value: string; label: string }[]> = {
  sw: [
    { value: '120+', label: 'Miradi ya majaribio inayokaguliwa' },
    { value: '16', label: 'Mikoa iliyowakilishwa' },
    { value: '48%', label: 'Miradi yenye Kiwango cha 2 au zaidi' },
    { value: 'Siku 9', label: 'Wastani wa muda wa uthibitishaji' },
  ],
  es: [
    { value: '120+', label: 'Proyectos piloto en revisión' },
    { value: '16', label: 'Regiones representadas' },
    { value: '48%', label: 'Publicaciones en Nivel 2 o superior' },
    { value: '9 días', label: 'Tiempo medio de verificación' },
  ],
}

export const LIST_PACKAGES_I18N: Record<
  LanguageCode,
  { id: string; name: string; price: string; note: string; points: string[]; recommended?: boolean }[]
> = {
  en: [
    { id: 'basic', name: 'Basic listing', price: 'TSh 50,000 – 100,000', note: 'One-off', points: ['Moderated publication', 'Level 0–1 badge', 'Investor enquiries'] },
    {
      id: 'verified',
      name: 'Verified listing',
      price: 'TSh 250,000 – 750,000',
      note: 'One-off, by scope',
      points: ['Licence record check (L2)', 'Optional technical review (L3)', 'Verification scope published', 'Priority in search'],
      recommended: true,
    },
    { id: 'featured', name: 'Verified + Featured', price: 'from TSh 350,000', note: 'Plus campaign/month', points: ['Everything in Verified', 'Home-page & map placement', 'Investor alert inclusion'] },
  ],
  sw: [
    { id: 'basic', name: 'Tangazo la msingi', price: 'TSh 50,000 – 100,000', note: 'Mara moja', points: ['Uchapishaji uliohakikiwa', 'Beji ya Kiwango 0–1', 'Maombi ya wawekezaji'] },
    {
      id: 'verified',
      name: 'Tangazo lililothibitishwa',
      price: 'TSh 250,000 – 750,000',
      note: 'Mara moja, kulingana na wigo',
      points: ['Ukaguzi wa kumbukumbu za leseni (L2)', 'Mapitio ya kiufundi ya hiari (L3)', 'Wigo wa uthibitishaji unachapishwa', 'Kipaumbele kwenye utafutaji'],
      recommended: true,
    },
    { id: 'featured', name: 'Imethibitishwa + Maalum', price: 'kuanzia TSh 350,000', note: 'Pamoja na kampeni/mwezi', points: ['Yote yaliyo kwenye Imethibitishwa', 'Kuonekana ukurasa wa mwanzo na ramani', 'Kujumuishwa kwenye arifa za wawekezaji'] },
  ],
  es: [
    { id: 'basic', name: 'Publicación básica', price: 'TSh 50,000 – 100,000', note: 'Pago único', points: ['Publicación moderada', 'Insignia Nivel 0–1', 'Consultas de inversores'] },
    {
      id: 'verified',
      name: 'Publicación verificada',
      price: 'TSh 250,000 – 750,000',
      note: 'Pago único, según alcance',
      points: ['Verificación de licencia (N2)', 'Revisión técnica opcional (N3)', 'Alcance de verificación publicado', 'Prioridad en búsqueda'],
      recommended: true,
    },
    { id: 'featured', name: 'Verificada + Destacada', price: 'desde TSh 350,000', note: 'Más campaña/mes', points: ['Todo lo de Verificada', 'Ubicación en inicio y mapa', 'Inclusión en alertas a inversores'] },
  ],
}

export const FAQ_GROUPS_I18N: Record<LanguageCode, { id: string; title: string; items: { id: string; q: string; a: string }[] }[]> = {
  en: [
    {
      id: 'platform',
      title: 'The platform',
      items: [
        {
          id: 'what-is',
          q: 'What is MineConnect?',
          a: 'MineConnect is a digital mining marketplace and intelligence platform for Tanzania. It connects small- and medium-scale miners and mineral-right holders with investors, mining companies, technical professionals and equipment suppliers through structured listings, verification and controlled deal rooms.',
        },
        {
          id: 'gov-body',
          q: 'Is MineConnect a government body or licensing authority?',
          a: 'No. MineConnect is a private platform. It does not grant, approve or transfer mineral rights. Licensing matters are handled by the Mining Commission and the processes set out in the Mining Act (Cap. 123) and its regulations.',
        },
        {
          id: 'transferable',
          q: 'Does a listing mean the right can be sold or transferred?',
          a: 'No. Every listing shows its opportunity type and transaction status, but appearing on MineConnect never means a right is approved or transferable. Any assignment or transfer follows the prescribed statutory process, including licensing-authority consent where required.',
        },
      ],
    },
    {
      id: 'verification',
      title: 'Verification & trust',
      items: [
        {
          id: 'badge-guarantee',
          q: 'What does a verification badge guarantee?',
          a: 'A badge states exactly what was checked, by whom and when — and what was not. Even at Level 3 (technical review) or Level 4 (site/due diligence), verification is not a guarantee of mineral occurrence, grade, resource or profitability.',
        },
        {
          id: 'fraud-prevention',
          q: 'How do you prevent fraudulent listings?',
          a: 'Mandatory moderation, identity and document checks, duplicate-listing detection, flagging of suspicious pricing or claims, verification expiry, a report button on every listing, and a published dispute and escalation procedure.',
        },
        {
          id: 'gov-fee',
          q: 'Will MineConnect ever ask me to pay a government fee?',
          a: 'Never. Platform fees are always invoiced separately and clearly labelled. If anyone asks you to pay a “government fee” to MineConnect, or to a personal mobile-money number, report it to us immediately.',
        },
      ],
    },
    {
      id: 'investors',
      title: 'Investors',
      items: [
        {
          id: 'contact-owner',
          q: 'How do I contact a project owner?',
          a: 'Send an enquiry from the project page. Before protected contact details are released, the introduction and your acceptance of the facilitation terms are recorded. Once the owner approves, you can enter the project’s deal room.',
        },
        {
          id: 'deal-room',
          q: 'What is a deal room?',
          a: 'A private workspace for a specific opportunity: controlled document folders with versioning and watermarking, NDA status, Q&A, a due-diligence checklist, meeting notes and a full audit log of who accessed what.',
        },
        {
          id: 'success-fees',
          q: 'How do success fees work?',
          a: 'Where a success or facilitation fee applies (typically 1–5% depending on size and structure), it is agreed in writing before the relevant introduction or service. It is never presented as a government fee.',
        },
      ],
    },
    {
      id: 'owners',
      title: 'Miners & project owners',
      items: [
        {
          id: 'cost-to-list',
          q: 'What does it cost to list?',
          a: 'A basic listing is TSh 50,000–100,000 one-off, or join the Miner membership at TSh 50,000/month for up to three listings. Verified listings cost TSh 250,000–750,000 depending on scope.',
        },
        {
          id: 'personal-data',
          q: 'What personal data do you collect?',
          a: 'Only what the verification process genuinely requires. Data is handled in line with the Personal Data Protection Act, 2022, with defined retention periods, access controls and deletion rules.',
        },
        {
          id: 'how-to-pay',
          q: 'How can I pay?',
          a: 'By bank transfer or approved mobile-money and payment-gateway integrations. Every payment receives an invoice, a payment reference and a receipt.',
        },
      ],
    },
  ],
  sw: [
    {
      id: 'platform',
      title: 'Jukwaa',
      items: [
        {
          id: 'what-is',
          q: 'MineConnect ni nini?',
          a: 'MineConnect ni soko la kidijitali la madini na jukwaa la taarifa kwa ajili ya Tanzania. Inaunganisha wachimbaji wadogo na wa kati pamoja na wamiliki wa haki za madini na wawekezaji, kampuni za madini, wataalamu wa kiufundi na wasambazaji wa vifaa kupitia matangazo yaliyopangwa, uthibitishaji na vyumba vya makubaliano vilivyodhibitiwa.',
        },
        {
          id: 'gov-body',
          q: 'Je, MineConnect ni chombo cha serikali au mamlaka ya utoaji leseni?',
          a: 'Hapana. MineConnect ni jukwaa binafsi. Haitoi, haiidhinishi wala kuhamisha haki za madini. Masuala ya leseni yanashughulikiwa na Tume ya Madini na taratibu zilizowekwa katika Sheria ya Madini (Sura ya 123) na kanuni zake.',
        },
        {
          id: 'transferable',
          q: 'Je, kuweka mradi kunamaanisha haki inaweza kuuzwa au kuhamishwa?',
          a: 'Hapana. Kila tangazo linaonyesha aina ya fursa na hali ya muamala, lakini kuonekana kwenye MineConnect kamwe hakumaanishi haki imeidhinishwa au inahamishika. Ugawaji au uhamisho wowote unafuata mchakato wa kisheria uliowekwa, ikiwa ni pamoja na ridhaa ya mamlaka ya leseni inapohitajika.',
        },
      ],
    },
    {
      id: 'verification',
      title: 'Uthibitishaji na uaminifu',
      items: [
        {
          id: 'badge-guarantee',
          q: 'Beji ya uthibitishaji inahakikisha nini?',
          a: 'Beji inaeleza wazi kilichokaguliwa, na nani na lini — na kile ambacho hakikukaguliwa. Hata katika Kiwango cha 3 (mapitio ya kiufundi) au Kiwango cha 4 (ukaguzi wa eneo/uhakiki wa kina), uthibitishaji si dhamana ya uwepo wa madini, kiwango, rasilimali au faida.',
        },
        {
          id: 'fraud-prevention',
          q: 'Mnazuiaje matangazo ya kitapeli?',
          a: 'Uhakiki wa lazima, ukaguzi wa utambulisho na nyaraka, utambuzi wa matangazo yanayojirudia, kuashiria bei au madai yanayotia shaka, muda wa kuisha kwa uthibitishaji, kitufe cha kuripoti kwenye kila tangazo, na utaratibu uliochapishwa wa migogoro.',
        },
        {
          id: 'gov-fee',
          q: 'Je, MineConnect itawahi kuniomba nilipe ada ya serikali?',
          a: 'Kamwe. Ada za jukwaa hutolewa ankara tofauti na kuwekewa lebo wazi. Ikiwa mtu yeyote atakuomba ulipe “ada ya serikali” kwa MineConnect, au kwenye nambari binafsi ya simu, tupatie taarifa mara moja.',
        },
      ],
    },
    {
      id: 'investors',
      title: 'Wawekezaji',
      items: [
        {
          id: 'contact-owner',
          q: 'Ninawasilianaje na mmiliki wa mradi?',
          a: 'Tuma ombi kutoka kwenye ukurasa wa mradi. Kabla ya mawasiliano yaliyohifadhiwa kutolewa, utambulisho na kukubali kwako kwa masharti ya uwezeshaji kunarekodiwa. Mmiliki akishaidhinisha, unaweza kuingia kwenye chumba cha makubaliano cha mradi.',
        },
        {
          id: 'deal-room',
          q: 'Chumba cha makubaliano (deal room) ni nini?',
          a: 'Sehemu binafsi ya kazi kwa ajili ya fursa mahususi: folda za nyaraka zilizodhibitiwa zenye matoleo na alama za maji (watermark), hali ya NDA, maswali na majibu, orodha ya uhakiki wa kina, kumbukumbu za mikutano na kumbukumbu kamili ya ukaguzi wa nani alifikia nini.',
        },
        {
          id: 'success-fees',
          q: 'Ada za mafanikio zinafanyaje kazi?',
          a: 'Pale ambapo ada ya mafanikio au uwezeshaji inatumika (kawaida 1–5% kulingana na ukubwa na muundo), inakubaliwa kwa maandishi kabla ya utambulisho au huduma husika. Kamwe haiwasilishwi kama ada ya serikali.',
        },
      ],
    },
    {
      id: 'owners',
      title: 'Wachimbaji na wamiliki wa miradi',
      items: [
        {
          id: 'cost-to-list',
          q: 'Ni gharama gani kuweka mradi?',
          a: 'Tangazo la msingi ni TSh 50,000–100,000 mara moja, au jiunge na uanachama wa Mchimbaji kwa TSh 50,000/mwezi kwa hadi miradi mitatu. Matangazo yaliyothibitishwa yanagharimu TSh 250,000–750,000 kulingana na wigo.',
        },
        {
          id: 'personal-data',
          q: 'Mnakusanya taarifa gani binafsi?',
          a: 'Zile tu ambazo mchakato wa uthibitishaji unazihitaji kweli. Taarifa zinashughulikiwa kwa mujibu wa Sheria ya Ulinzi wa Taarifa Binafsi, 2022, kukiwa na muda maalum wa kuhifadhi, udhibiti wa ufikiaji na sheria za ufutaji.',
        },
        {
          id: 'how-to-pay',
          q: 'Ninawezaje kulipa?',
          a: 'Kwa uhamisho wa benki au mifumo iliyoidhinishwa ya malipo ya simu. Kila malipo hupokea ankara, nambari ya kumbukumbu ya malipo na risiti.',
        },
      ],
    },
  ],
  es: [
    {
      id: 'platform',
      title: 'La plataforma',
      items: [
        {
          id: 'what-is',
          q: '¿Qué es MineConnect?',
          a: 'MineConnect es un mercado minero digital y plataforma de inteligencia para Tanzania. Conecta a mineros de pequeña y mediana escala y titulares de derechos mineros con inversores, empresas mineras, profesionales técnicos y proveedores de equipos mediante publicaciones estructuradas, verificación y salas de datos controladas.',
        },
        {
          id: 'gov-body',
          q: '¿Es MineConnect un organismo gubernamental o autoridad de licencias?',
          a: 'No. MineConnect es una plataforma privada. No otorga, aprueba ni transfiere derechos mineros. Los asuntos de licencias son gestionados por la Comisión de Minería y los procesos establecidos en la Ley de Minería (Cap. 123) y sus reglamentos.',
        },
        {
          id: 'transferable',
          q: '¿Publicar un proyecto significa que el derecho puede venderse o transferirse?',
          a: 'No. Cada publicación muestra su tipo de oportunidad y el estado de la transacción, pero aparecer en MineConnect nunca significa que un derecho esté aprobado o sea transferible. Cualquier cesión o transferencia sigue el proceso legal prescrito, incluido el consentimiento de la autoridad de licencias cuando sea necesario.',
        },
      ],
    },
    {
      id: 'verification',
      title: 'Verificación y confianza',
      items: [
        {
          id: 'badge-guarantee',
          q: '¿Qué garantiza una insignia de verificación?',
          a: 'Una insignia indica exactamente qué se comprobó, por quién y cuándo — y qué no se comprobó. Incluso en el Nivel 3 (revisión técnica) o Nivel 4 (sitio/debida diligencia), la verificación no es garantía de presencia mineral, ley, recursos o rentabilidad.',
        },
        {
          id: 'fraud-prevention',
          q: '¿Cómo previenen las publicaciones fraudulentas?',
          a: 'Moderación obligatoria, controles de identidad y documentos, detección de publicaciones duplicadas, señalización de precios o afirmaciones sospechosas, vencimiento de verificación, un botón de reporte en cada publicación y un procedimiento publicado de disputas y escalamiento.',
        },
        {
          id: 'gov-fee',
          q: '¿MineConnect me pedirá alguna vez pagar una tasa gubernamental?',
          a: 'Nunca. Las tarifas de la plataforma siempre se facturan por separado y están claramente etiquetadas. Si alguien te pide pagar una “tasa gubernamental” a MineConnect o a un número personal de dinero móvil, repórtalo de inmediato.',
        },
      ],
    },
    {
      id: 'investors',
      title: 'Inversores',
      items: [
        {
          id: 'contact-owner',
          q: '¿Cómo contacto al titular de un proyecto?',
          a: 'Envía una consulta desde la página del proyecto. Antes de liberar los datos de contacto protegidos, se registran la presentación y tu aceptación de los términos de facilitación. Una vez que el titular aprueba, puedes ingresar a la sala de datos del proyecto.',
        },
        {
          id: 'deal-room',
          q: '¿Qué es una sala de datos (deal room)?',
          a: 'Un espacio de trabajo privado para una oportunidad específica: carpetas de documentos controladas con control de versiones y marcas de agua, estado de NDA, preguntas y respuestas, lista de debida diligencia, notas de reuniones y un registro de auditoría completo de accesos.',
        },
        {
          id: 'success-fees',
          q: '¿Cómo funcionan las comisiones de éxito?',
          a: 'Cuando aplica una comisión de éxito o facilitación (típicamente del 1 al 5% según el tamaño y la estructura), se acuerda por escrito antes de la presentación o servicio correspondiente. Nunca se presenta como una tasa gubernamental.',
        },
      ],
    },
    {
      id: 'owners',
      title: 'Mineros y titulares de proyectos',
      items: [
        {
          id: 'cost-to-list',
          q: '¿Cuánto cuesta publicar un proyecto?',
          a: 'Una publicación básica cuesta TSh 50,000–100,000 en pago único, o puedes unirte a la membresía Minero por TSh 50,000/mes para hasta tres publicaciones. Las publicaciones verificadas cuestan TSh 250,000–750,000 según el alcance.',
        },
        {
          id: 'personal-data',
          q: '¿Qué datos personales recopilan?',
          a: 'Solo los que el proceso de verificación realmente requiere. Los datos se tratan de acuerdo con la Ley de Protección de Datos Personales de 2022, con períodos de retención definidos, controles de acceso y reglas de eliminación.',
        },
        {
          id: 'how-to-pay',
          q: '¿Cómo puedo pagar?',
          a: 'Por transferencia bancaria o integraciones aprobadas de dinero móvil y pasarelas de pago. Cada pago recibe una factura, una referencia de pago y un recibo.',
        },
      ],
    },
  ],
}

export function translateValue(val: string, lang: LanguageCode): string {
  if (lang === 'en') return val
  return VALUE_TRANSLATIONS[lang]?.[val] ?? val
}

export function localizeProject(p: Project, lang: LanguageCode): Project {
  if (lang === 'en') return p
  const tr = PROJECTS_I18N[lang]?.[p.id]
  if (!tr) return p
  return {
    ...p,
    title: tr.title,
    transactionStatus: tr.transactionStatus,
    summary: tr.summary,
    highlights: tr.highlights,
    evidence: tr.evidence,
    infrastructure: tr.infrastructure,
    documents: p.documents.map((d, i) => ({
      ...d,
      name: tr.documents[i]?.name ?? d.name,
      kind: tr.documents[i]?.kind ?? d.kind,
    })),
    verification: {
      ...p.verification,
      checkedBy: tr.verification.checkedBy,
      scope: tr.verification.scope,
      notVerified: tr.verification.notVerified,
    },
    owner: {
      ...p.owner,
      name: tr.ownerName ?? p.owner.name,
      kind: tr.ownerKind,
    },
  }
}

export function getLocalizedFixtures(lang: LanguageCode) {
  const projects = lang === 'en' ? PROJECTS : PROJECTS.map((p) => localizeProject(p, lang))

  const verificationLevels =
    lang === 'en'
      ? VERIFICATION_LEVELS
      : VERIFICATION_LEVELS.map((v) => {
          const tr = VERIFICATION_LEVELS_I18N[lang][v.level]
          return tr ? { ...v, ...tr } : v
        })

  const serviceProviders: ServiceProvider[] =
    lang === 'en'
      ? SERVICE_PROVIDERS
      : SERVICE_PROVIDERS.map((sp) => {
          const tr = SERVICE_PROVIDERS_I18N[lang]?.[sp.id]
          return tr ? { ...sp, summary: tr.summary, services: tr.services } : sp
        })

  const plans =
    lang === 'en'
      ? PLANS
      : PLANS.map((pl) => {
          const tr = PLANS_I18N[lang]?.[pl.id]
          return tr ? { ...pl, ...tr } : pl
        })

  const servicesPricing = lang === 'en' ? SERVICES_PRICING : SERVICES_PRICING_I18N[lang]
  const insights = lang === 'en' ? INSIGHTS : INSIGHTS_I18N[lang]
  const platformStats = lang === 'en' ? PLATFORM_STATS : PLATFORM_STATS_I18N[lang]
  const investmentBands =
    lang === 'en'
      ? INVESTMENT_BANDS
      : INVESTMENT_BANDS.map((b) => ({
          ...b,
          label: translateValue(b.label, lang),
        }))

  return {
    projects,
    verificationLevels,
    serviceProviders,
    plans,
    servicesPricing,
    insights,
    platformStats,
    investmentBands,
    listPackages: LIST_PACKAGES_I18N[lang],
    faqGroups: FAQ_GROUPS_I18N[lang],
  }
}
