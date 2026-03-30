import type { IntentFamily, IntentOperation, LifecycleStage } from "../types/answers.js";
import { normalizeSearchText, tokenizeSearchText } from "../utils/text.js";

export interface BenefitCatalogEntry {
  benefitId: string;
  displayName: string;
  shortLabel: string;
  family: IntentFamily;
  audience: string;
  summary: string;
  exampleQuestion: string;
  defaultSituation: string;
  promptSeeds: string[];
  aliases: string[];
  sourceTags: string[];
  lifecycleOps: IntentOperation[];
  primaryUrls: string[];
  serviceUrls: string[];
  formUrls: string[];
  pdfUrls: string[];
  trackingUrls: string[];
  notificationUrls: string[];
  reviewUrls: string[];
  requiresAuth: boolean;
  supportsSms: boolean;
  guided: boolean;
}

export interface GuidedProcedure {
  id: string;
  label: string;
  shortLabel: string;
  goal: string;
  summary: string;
  exampleQuestion: string;
  promptSeeds: string[];
  defaultSituation: string;
}

export const COMMON_INSS_SERVICE_URLS = {
  portalPrestaciones: "https://www.seg-social.es/wps/portal/wss/internet/Pensionistas/Servicios/34928/desc34928",
  solicitudesPrestaciones:
    "https://sede.seg-social.gob.es/wps/portal/sede/sede/Ciudadanos/informes%2By%2Bcertificados/inss_tramites",
  citaPrestaciones:
    "https://sede.seg-social.gob.es/wps/portal/sede/sede/Ciudadanos/Cita%2BPrevia%2Bpara%2BPensiones%2By%2BOtras%2BPrestaciones/202910?changeLanguage=es",
  citaInfo: "https://sede.seg-social.gob.es/wps/wcm/connect/sede/sede_contenidos/sede/inicio/informacionutil/informacionad",
  misExpedientes: "https://sede.seg-social.gob.es/wps/portal/sede/sede/Inicio/MisExpedientesAdministrativos",
  certificadoPrestaciones: "https://sede.seg-social.gob.es/wps/portal/sede/sede/Ciudadanos/Pensiones/181119_INSS",
};

const COMMON_TRACKING_URLS = [COMMON_INSS_SERVICE_URLS.misExpedientes];
const COMMON_NOTIFICATION_URLS = [COMMON_INSS_SERVICE_URLS.misExpedientes];
const COMMON_PRESENTATION_URLS = [
  COMMON_INSS_SERVICE_URLS.portalPrestaciones,
  COMMON_INSS_SERVICE_URLS.solicitudesPrestaciones,
];

const ALL_OPERATIONS: IntentOperation[] = [
  "requisitos",
  "documentacion",
  "solicitud",
  "rellenado-formulario",
  "estado-expediente",
  "subsanacion-requerimiento",
  "notificacion",
  "cita-caiss",
  "sin-certificado-sms",
  "cuantia",
  "plazos",
  "compatibilidades",
  "pago-cobro",
  "revision",
  "reclamacion-previa",
  "silencio-administrativo",
  "variacion-datos",
  "suspension-extincion",
];

function benefit(
  partial: Omit<
    BenefitCatalogEntry,
    | "serviceUrls"
    | "formUrls"
    | "pdfUrls"
    | "trackingUrls"
    | "notificationUrls"
    | "reviewUrls"
    | "requiresAuth"
    | "supportsSms"
    | "guided"
  > &
    Partial<
      Pick<
        BenefitCatalogEntry,
        | "serviceUrls"
        | "formUrls"
        | "pdfUrls"
        | "trackingUrls"
        | "notificationUrls"
        | "reviewUrls"
        | "requiresAuth"
        | "supportsSms"
        | "guided"
      >
    >,
): BenefitCatalogEntry {
  return {
    serviceUrls: COMMON_PRESENTATION_URLS,
    formUrls: [],
    pdfUrls: [],
    trackingUrls: COMMON_TRACKING_URLS,
    notificationUrls: COMMON_NOTIFICATION_URLS,
    reviewUrls: COMMON_NOTIFICATION_URLS,
    requiresAuth: false,
    supportsSms: true,
    guided: true,
    ...partial,
  };
}

export const INSS_BENEFIT_CATALOG: BenefitCatalogEntry[] = [
  benefit({
    benefitId: "jubilacion",
    displayName: "Jubilacion",
    shortLabel: "Jubilacion",
    family: "jubilacion",
    audience: "trabajadores y pensionistas",
    summary: "Modalidades, edad, cotizacion, cuantia, solicitud y seguimiento de la jubilacion.",
    exampleQuestion: "Tengo 63 anos y quiero jubilarme. Que datos cambian la orientacion y como deberia tramitarlo?",
    defaultSituation: "Quiero ordenar modalidad, edad, cotizacion, documentos y siguiente paso antes de presentar.",
    promptSeeds: [
      "Quiero revisar requisitos y modalidad de mi jubilacion",
      "Que documentos suelen pedir para jubilacion",
      "Como se presenta y se sigue una solicitud de jubilacion",
    ],
    aliases: ["jubilacion", "pension de jubilacion", "retiro", "jubilarme", "jubilacion anticipada", "mutualista"],
    sourceTags: ["jubilacion", "pension", "edad-jubilacion", "cotizacion", "jubilacion-anticipada", "mutualista"],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10963"],
  }),
  benefit({
    benefitId: "incapacidad-temporal",
    displayName: "Incapacidad temporal",
    shortLabel: "IT",
    family: "incapacidad",
    audience: "trabajadores",
    summary: "Baja medica, pago directo cuando exista, expediente y requerimientos de incapacidad temporal.",
    exampleQuestion: "Estoy de baja y quiero saber que revisa el INSS, como se sigue el expediente y que hacer si me piden algo.",
    defaultSituation: "Quiero ordenar origen de la baja, expediente y siguiente paso en incapacidad temporal.",
    promptSeeds: [
      "Que revisa el INSS en incapacidad temporal",
      "Como se gestiona una incapacidad temporal y su seguimiento",
      "Que hago si hay requerimiento o pago directo en incapacidad temporal",
    ],
    aliases: ["incapacidad temporal", "baja medica", "it", "pago directo", "subsidio por enfermedad"],
    sourceTags: ["incapacidad-temporal", "baja-medica", "subsidio"],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10952"],
  }),
  benefit({
    benefitId: "incapacidad-permanente",
    displayName: "Incapacidad permanente",
    shortLabel: "IP",
    family: "incapacidad",
    audience: "trabajadores",
    summary: "Grados, cuantia, compatibilidades, revision y seguimiento de la incapacidad permanente.",
    exampleQuestion:
      "Que cambia entre los grados de incapacidad permanente y como deberia orientar, seguir o reclamar un expediente?",
    defaultSituation: "Quiero ordenar grado, origen, documentos, cuantia y seguimiento del expediente.",
    promptSeeds: [
      "Quiero revisar grado y requisitos de incapacidad permanente",
      "Que documentos suelen pedir para incapacidad permanente",
      "Como se sigue, se revisa o se reclama una incapacidad permanente",
    ],
    aliases: [
      "incapacidad permanente",
      "invalidez",
      "gran incapacidad",
      "incapacidad total",
      "incapacidad absoluta",
      "lesiones permanentes no incapacitantes",
    ],
    sourceTags: [
      "incapacidad-permanente",
      "incapacidad-permanente-total",
      "incapacidad-permanente-parcial",
      "incapacidad-permanente-absoluta",
      "gran-incapacidad",
      "lesiones permanentes no incapacitantes",
    ],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10960"],
  }),
  benefit({
    benefitId: "nacimiento-cuidado-menor",
    displayName: "Nacimiento y cuidado de menor",
    shortLabel: "Nacimiento",
    family: "familia-cuidados",
    audience: "personas progenitoras o adoptantes",
    summary: "Nacimiento, adopcion o acogimiento con foco en documentos, presentacion y seguimiento.",
    exampleQuestion:
      "Voy a pedir nacimiento y cuidado de menor. Que datos cambian la respuesta y como debo prepararlo o seguirlo?",
    defaultSituation: "Quiero ordenar supuesto familiar, regimen, momento del tramite y siguiente paso.",
    promptSeeds: [
      "Que requisitos y documentos suelen pedir para nacimiento y cuidado de menor",
      "Como se presenta esta prestacion y que vias oficiales hay",
      "Como seguir o subsanar un expediente de nacimiento y cuidado de menor",
    ],
    aliases: ["nacimiento y cuidado de menor", "maternidad", "paternidad", "adopcion", "acogimiento"],
    sourceTags: ["nacimiento", "cuidado-menor", "maternidad", "paternidad"],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/6b96a085-4dc0-47af-b2cb-97e00716791e"],
    pdfUrls: ["https://www.seg-social.es/wps/wcm/connect/wss/51178da2-48e0-4d22-aa5d-6a1904b4ae6b/MP-1%2BBIS_Castellano_12_Accesibilidad.pdf?MOD=AJPERES"],
  }),
  benefit({
    benefitId: "familia-cuidados",
    displayName: "Familia y cuidados especiales",
    shortLabel: "Familia",
    family: "familia-cuidados",
    audience: "familias y personas cuidadoras",
    summary: "Menor grave, riesgo en embarazo o lactancia, lactante, brecha de genero y otras prestaciones familiares.",
    exampleQuestion:
      "Quiero saber si mi caso entra en familia y cuidados especiales y que documentos o vias oficiales tengo.",
    defaultSituation: "Quiero ordenar supuesto familiar, beneficiario y siguiente paso del expediente.",
    promptSeeds: [
      "Que prestaciones del INSS entran en familia y cuidados especiales",
      "Que documentos suelen pedir en estos tramites",
      "Como se presenta o se sigue un expediente de familia y cuidados",
    ],
    aliases: [
      "cuidado de menor grave",
      "cancer del menor",
      "riesgo durante el embarazo",
      "riesgo durante la lactancia",
      "cuidado del lactante",
      "brecha de genero",
      "prestaciones familiares",
    ],
    sourceTags: [
      "cuidado-menor-grave",
      "riesgo-embarazo",
      "lactancia",
      "riesgo-lactancia",
      "brecha-genero",
      "familia-cuidados",
      "prestaciones familiares",
    ],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: [
      "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/1941",
      "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10956",
      "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/51288",
      "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/61f8b540-c867-43cf-926d-77476b975f36",
      "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/4c43ce49-6636-4a12-bacf-5e6697eb81da",
      "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10967",
    ],
  }),
  benefit({
    benefitId: "viudedad",
    displayName: "Viudedad",
    shortLabel: "Viudedad",
    family: "supervivencia",
    audience: "personas con vinculo con el causante",
    summary: "Beneficiarios, cuantia, documentos y seguimiento de la pension de viudedad.",
    exampleQuestion:
      "Quiero revisar si me encaja la pension de viudedad, que documentos suelen pedir y como seguir el expediente.",
    defaultSituation: "Quiero ordenar relacion con el causante, documentos, cuantia y siguiente paso.",
    promptSeeds: [
      "Que requisitos y beneficiarios revisan en viudedad",
      "Que documentos suelen pedir para viudedad",
      "Como se presenta, sigue o reclama una viudedad",
    ],
    aliases: ["viudedad", "pension de viudedad", "fallecimiento del conyuge", "viudo", "viuda"],
    sourceTags: ["viudedad", "muerte-supervivencia"],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10964"],
    formUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Pensionistas/Servicios/34887/40968/41026"],
  }),
  benefit({
    benefitId: "supervivencia",
    displayName: "Supervivencia",
    shortLabel: "Supervivencia",
    family: "supervivencia",
    audience: "personas beneficiarias tras un fallecimiento",
    summary: "Orfandad, favor de familiares y auxilio por defuncion, con foco en documentos y seguimiento.",
    exampleQuestion:
      "Quiero ordenar un caso de orfandad, favor de familiares o auxilio por defuncion y saber que via oficial toca.",
    defaultSituation: "Quiero ordenar tipo de prestacion de supervivencia, beneficiario y siguiente paso.",
    promptSeeds: [
      "Que prestaciones de supervivencia distintas de viudedad puedo revisar",
      "Que documentos suelen pedir para orfandad o favor de familiares",
      "Como se presenta o se sigue un expediente de supervivencia",
    ],
    aliases: [
      "orfandad",
      "favor de familiares",
      "auxilio por defuncion",
      "gastos de sepelio",
      "muerte y supervivencia",
    ],
    sourceTags: ["supervivencia", "orfandad", "favor-de-familiares", "auxilio-defuncion", "muerte-supervivencia"],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10964"],
    formUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Pensionistas/Servicios/34887/40968/41026"],
  }),
  benefit({
    benefitId: "asistencia-sanitaria",
    displayName: "Asistencia sanitaria",
    shortLabel: "Sanitaria",
    family: "asistencia-sanitaria",
    audience: "titulares, beneficiarios y personas desplazadas",
    summary: "Cobertura general de asistencia sanitaria, TSE, CPS y alta de beneficiarios.",
    exampleQuestion:
      "Necesito resolver un tramite de asistencia sanitaria y no se si me corresponde TSE, CPS o alta de beneficiario.",
    defaultSituation: "Quiero ordenar tramite sanitario, destinatario y via oficial antes de presentar o seguir.",
    promptSeeds: [
      "Que tramite sanitario me conviene en mi caso",
      "Como se presenta un tramite de asistencia sanitaria",
      "Como seguir o subsanar un expediente sanitario",
    ],
    aliases: ["asistencia sanitaria", "prestacion sanitaria", "tarjeta sanitaria", "beneficiario sanitario"],
    sourceTags: ["asistencia-sanitaria", "tse", "cps", "beneficiario"],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10938"],
  }),
  benefit({
    benefitId: "tse-cps",
    displayName: "TSE y CPS",
    shortLabel: "TSE / CPS",
    family: "asistencia-sanitaria",
    audience: "personas que viajan temporalmente",
    summary: "Tarjeta Sanitaria Europea y Certificado Provisional Sustitutorio con foco en via de solicitud y plazos.",
    exampleQuestion:
      "Necesito viajar y quiero saber si me conviene pedir la TSE o el CPS y por que via hacerlo.",
    defaultSituation: "Quiero ordenar viaje, plazo, identificacion y siguiente paso para TSE o CPS.",
    promptSeeds: [
      "Cuando conviene la TSE y cuando el CPS",
      "Como se solicita la TSE o el CPS y si admite SMS",
      "Como revisar el estado de un tramite de TSE o CPS",
    ],
    aliases: ["tse", "tarjeta sanitaria europea", "cps", "certificado provisional sustitutorio", "tse urgente"],
    sourceTags: ["tse", "tarjeta-sanitaria-europea", "cps", "asistencia-sanitaria"],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: [
      "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10938/11566/1761",
    ],
    serviceUrls: ["https://sede.seg-social.gob.es/wps/portal/sede/sede/Ciudadanos/Asistencia%2BSanitaria/202046SinC"],
  }),
  benefit({
    benefitId: "alta-beneficiarios",
    displayName: "Alta de beneficiarios",
    shortLabel: "Beneficiarios",
    family: "asistencia-sanitaria",
    audience: "titulares que quieren dar de alta a otra persona como beneficiaria",
    summary: "Alta, variacion y seguimiento de beneficiarios de asistencia sanitaria.",
    exampleQuestion:
      "Quiero dar de alta a un beneficiario en asistencia sanitaria y necesito ordenar documentos y vias oficiales.",
    defaultSituation: "Quiero ordenar titular, beneficiario y siguiente paso del alta de beneficiarios.",
    promptSeeds: [
      "Que requisitos revisan para alta de beneficiarios",
      "Que documentos suelen pedir para dar de alta a un beneficiario",
      "Como se presenta o sigue un alta de beneficiarios",
    ],
    aliases: ["alta de beneficiarios", "beneficiario", "anadir beneficiario", "beneficiarios de asistencia sanitaria"],
    sourceTags: ["beneficiario", "asistencia-sanitaria", "solicitud"],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10938"],
    serviceUrls: ["https://sede.seg-social.gob.es/wps/portal/sede/sede/Ciudadanos/Asistencia%2BSanitaria/202043"],
  }),
  benefit({
    benefitId: "imv",
    displayName: "Ingreso Minimo Vital",
    shortLabel: "IMV",
    family: "imv",
    audience: "unidades de convivencia y personas potencialmente beneficiarias",
    summary: "Solicitud, variaciones, seguimiento, requerimientos, suspension, pago y revision del IMV.",
    exampleQuestion: "Quiero pedir o revisar el IMV. Que datos cambian la respuesta y como debo tramitarlo o seguirlo?",
    defaultSituation:
      "Quiero distinguir si es primera solicitud, cambio de circunstancias, pago, suspension o seguimiento del IMV.",
    promptSeeds: [
      "Quiero revisar requisitos y documentos del IMV",
      "Como se presenta o se sigue una solicitud de IMV",
      "Que hago si hay requerimiento, suspension o reclamacion previa del IMV",
    ],
    aliases: ["imv", "ingreso minimo vital", "renta minima", "complemento infancia"],
    sourceTags: ["imv", "ingreso-minimo-vital", "ayuda-infancia"],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/65850d68-8d06-4645-bde7-05374ee42ac7"],
  }),
  benefit({
    benefitId: "sovi",
    displayName: "Pensiones SOVI",
    shortLabel: "SOVI",
    family: "jubilacion",
    audience: "personas potencialmente incluidas en el Seguro Obligatorio de Vejez e Invalidez",
    summary: "Pensiones SOVI con foco en requisitos, compatibilidades, solicitud y seguimiento.",
    exampleQuestion: "Quiero revisar si me puede encajar una pension SOVI y que documentos o compatibilidades debo mirar.",
    defaultSituation: "Quiero ordenar situacion contributiva antigua, documentos y siguiente paso en una pension SOVI.",
    promptSeeds: [
      "Que requisitos revisan en SOVI",
      "Que documentos suelen pedir para una pension SOVI",
      "Como se presenta o se sigue una pension SOVI",
    ],
    aliases: ["sovi", "seguro obligatorio de vejez e invalidez", "pension sovi"],
    sourceTags: ["sovi", "jubilacion", "invalidez"],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10970"],
    guided: false,
  }),
  benefit({
    benefitId: "seguro-escolar",
    displayName: "Seguro escolar",
    shortLabel: "Seguro escolar",
    family: "prestaciones-especiales",
    audience: "estudiantes protegidos por el seguro escolar",
    summary: "Cobertura, incompatibilidades, gestion y solicitud de las prestaciones del seguro escolar.",
    exampleQuestion: "Quiero saber si mi caso entra en el seguro escolar y que riesgos, documentos o tramites tengo.",
    defaultSituation: "Quiero ordenar riesgo cubierto, estudiante beneficiario y siguiente paso del seguro escolar.",
    promptSeeds: [
      "Que cubre el seguro escolar",
      "Que documentos suelen pedir para una prestacion del seguro escolar",
      "Como se gestiona o se sigue un expediente del seguro escolar",
    ],
    aliases: ["seguro escolar", "prestaciones del seguro escolar"],
    sourceTags: ["seguro escolar", "estudiante", "incompatibilidades"],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: ["https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/28622"],
    supportsSms: false,
  }),
  benefit({
    benefitId: "prestaciones-especiales",
    displayName: "Prestaciones especiales INSS",
    shortLabel: "Especiales",
    family: "prestaciones-especiales",
    audience: "personas con supuestos protegidos fuera de las ramas comunes",
    summary: "Violencia contra la mujer, actos terroristas, Sindrome Toxico, Amianto y otros supuestos especiales.",
    exampleQuestion:
      "Quiero revisar si mi caso entra en una prestacion especial del INSS y que pagina oficial o via de tramite debo mirar.",
    defaultSituation: "Quiero identificar la rama especial correcta y el siguiente paso oficial del expediente.",
    promptSeeds: [
      "Que prestaciones especiales del INSS cubren violencia, terrorismo, Sindrome Toxico o Amianto",
      "Que documentos suelen pedir en estas prestaciones especiales",
      "Como se presenta o se sigue un expediente especial del INSS",
    ],
    aliases: [
      "violencia contra la mujer",
      "actos terroristas",
      "terrorismo",
      "sindrome toxico",
      "amianto",
      "asbestos",
    ],
    sourceTags: ["violencia", "terrorismo", "sindrome toxico", "amianto", "asbestos"],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: [
      "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/9b5e05b9-90f9-490d-9fde-0cb3446fed9e",
      "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/42924",
      "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/2399057c-418a-4764-a97c-e3ae9f61fb91",
      "https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/3ad031ff-e95d-4b89-a3cb-4e2c6f432e8d",
    ],
    supportsSms: false,
    guided: false,
  }),
  benefit({
    benefitId: "operativa-inss",
    displayName: "Operativa comun del INSS",
    shortLabel: "Operativa",
    family: "operativa-inss",
    audience: "cualquier persona con un tramite o expediente INSS",
    summary: "Portal de Prestaciones, Mis Expedientes, CAISS, notificaciones, requerimientos y vias con SMS o identificacion.",
    exampleQuestion:
      "Tengo un expediente del INSS y quiero saber como seguirlo, responder a un requerimiento o revisar una notificacion.",
    defaultSituation: "Quiero ordenar identificacion, expediente y siguiente paso comun del INSS sin perder el contexto.",
    promptSeeds: [
      "Como seguir un expediente del INSS",
      "Como responder a un requerimiento o revisar una notificacion",
      "Que vias hay con certificado, Cl@ve, SMS o cita previa",
    ],
    aliases: [
      "mis expedientes",
      "requerimiento del inss",
      "notificacion del inss",
      "cita caiss",
      "portal de prestaciones",
      "operativa inss",
    ],
    sourceTags: [
      "operativa-inss",
      "estado-expediente",
      "subsanacion-requerimiento",
      "notificacion",
      "cita-caiss",
      "sin-certificado-sms",
      "portal-prestaciones",
    ],
    lifecycleOps: ALL_OPERATIONS,
    primaryUrls: [COMMON_INSS_SERVICE_URLS.portalPrestaciones],
    serviceUrls: [
      COMMON_INSS_SERVICE_URLS.solicitudesPrestaciones,
      COMMON_INSS_SERVICE_URLS.citaPrestaciones,
      COMMON_INSS_SERVICE_URLS.citaInfo,
      COMMON_INSS_SERVICE_URLS.certificadoPrestaciones,
    ],
    requiresAuth: true,
  }),
];

const GUIDED_BENEFIT_IDS = new Set([
  "jubilacion",
  "incapacidad-temporal",
  "incapacidad-permanente",
  "nacimiento-cuidado-menor",
  "familia-cuidados",
  "viudedad",
  "supervivencia",
  "asistencia-sanitaria",
  "tse-cps",
  "alta-beneficiarios",
  "imv",
]);

export interface MenuGroup {
  groupId: string;
  label: string;
  benefitIds: string[];
  subLabels: Record<string, string>;
}

const MENU_GROUPS: MenuGroup[] = [
  {
    groupId: "grp-jubilacion",
    label: "Me quiero jubilar",
    benefitIds: ["jubilacion"],
    subLabels: {},
  },
  {
    groupId: "grp-incapacidad",
    label: "Estoy de baja o tengo una discapacidad",
    benefitIds: ["incapacidad-temporal", "incapacidad-permanente"],
    subLabels: {
      "incapacidad-temporal": "Baja medica (incapacidad temporal)",
      "incapacidad-permanente": "Incapacidad permanente o invalidez",
    },
  },
  {
    groupId: "grp-familia",
    label: "Tengo un hijo o cuido a alguien",
    benefitIds: ["nacimiento-cuidado-menor", "familia-cuidados"],
    subLabels: {
      "nacimiento-cuidado-menor": "Nacimiento, adopcion o acogida",
      "familia-cuidados": "Cuidado de hijos o familiares",
    },
  },
  {
    groupId: "grp-fallecimiento",
    label: "Ha fallecido un familiar",
    benefitIds: ["viudedad", "supervivencia"],
    subLabels: {
      viudedad: "Pension de viudedad",
      supervivencia: "Orfandad u otras prestaciones",
    },
  },
  {
    groupId: "grp-ayuda",
    label: "Necesito una ayuda economica",
    benefitIds: ["imv"],
    subLabels: {},
  },
  {
    groupId: "grp-sanitaria",
    label: "Sanidad o tarjeta sanitaria europea",
    benefitIds: ["asistencia-sanitaria", "tse-cps", "alta-beneficiarios"],
    subLabels: {
      "asistencia-sanitaria": "Asistencia sanitaria en Espana",
      "tse-cps": "Tarjeta sanitaria europea o CPS",
      "alta-beneficiarios": "Dar de alta a un beneficiario",
    },
  },
];

const MENU_GROUP_BY_ID = new Map(MENU_GROUPS.map((group) => [group.groupId, group]));

export function getMenuGroups(): MenuGroup[] {
  return MENU_GROUPS;
}

export function getMenuGroupById(groupId: string): MenuGroup | undefined {
  return MENU_GROUP_BY_ID.get(groupId);
}

const CATALOG_BY_ID = new Map(INSS_BENEFIT_CATALOG.map((entry) => [entry.benefitId, entry]));

function buildBenefitMatchScore(input: string, entry: BenefitCatalogEntry): number {
  const normalizedInput = normalizeSearchText(input);
  const tokens = tokenizeSearchText(input);
  let score = 0;

  for (const phrase of [entry.displayName, ...entry.aliases]) {
    const normalizedPhrase = normalizeSearchText(phrase);
    if (normalizedPhrase && normalizedInput.includes(normalizedPhrase)) {
      score += Math.max(3, normalizedPhrase.split(" ").length * 1.15);
    }
  }

  for (const sourceTag of entry.sourceTags) {
    const normalizedTag = normalizeSearchText(sourceTag);
    if (tokens.includes(normalizedTag) || normalizedInput.includes(normalizedTag)) {
      score += 1.1;
    }
  }

  return score;
}

export function getBenefitCatalogEntry(benefitId?: string | null): BenefitCatalogEntry | undefined {
  return benefitId ? CATALOG_BY_ID.get(benefitId) : undefined;
}

export function detectBenefitId(input: string, allowOperationalFallback = true): string | undefined {
  let bestEntry: BenefitCatalogEntry | undefined;
  let bestScore = 0;

  for (const entry of INSS_BENEFIT_CATALOG) {
    if (!allowOperationalFallback && entry.benefitId === "operativa-inss") {
      continue;
    }

    const score = buildBenefitMatchScore(input, entry);
    if (score > bestScore) {
      bestEntry = entry;
      bestScore = score;
    }
  }

  if (!bestEntry) {
    return undefined;
  }

  if (bestEntry.benefitId === "operativa-inss") {
    return bestScore >= 4 ? bestEntry.benefitId : undefined;
  }

  return bestScore >= 2.4 ? bestEntry.benefitId : undefined;
}

export function getGuidedProcedureLibrary(): GuidedProcedure[] {
  return INSS_BENEFIT_CATALOG.filter((entry) => entry.guided && GUIDED_BENEFIT_IDS.has(entry.benefitId)).map((entry) => ({
    id: entry.benefitId,
    label: entry.displayName,
    shortLabel: entry.shortLabel,
    goal: "gestor guiado",
    summary: entry.summary,
    exampleQuestion: entry.exampleQuestion,
    promptSeeds: entry.promptSeeds,
    defaultSituation: entry.defaultSituation,
  }));
}

export function getDemoQuestion(): string {
  return (
    getBenefitCatalogEntry("operativa-inss")?.exampleQuestion ??
    "Tengo un requerimiento del INSS y quiero saber que paso me toca ahora."
  );
}

export function inferLifecycleFromSourceTags(tags: string[]): LifecycleStage | undefined {
  if (tags.some((tag) => ["reclamacion-previa", "revision", "silencio-administrativo"].includes(tag))) {
    return "revision";
  }

  if (tags.some((tag) => ["notificacion", "pago-cobro", "suspension-extincion"].includes(tag))) {
    return "resolucion";
  }

  if (tags.some((tag) => ["estado-expediente", "subsanacion-requerimiento", "subsanacion", "requerimiento"].includes(tag))) {
    return "seguimiento";
  }

  if (tags.some((tag) => ["solicitud", "sin-certificado-sms", "cita-caiss", "variacion-datos"].includes(tag))) {
    return "presentacion";
  }

  if (tags.some((tag) => ["documentacion", "rellenar", "formulario"].includes(tag))) {
    return "preparacion";
  }

  if (tags.some((tag) => ["requisitos", "cuantia", "compatibilidades", "plazos"].includes(tag))) {
    return "orientacion";
  }

  return undefined;
}

export function inferSourceKindFromTags(tags: string[]): string | undefined {
  if (tags.some((tag) => ["subsanacion", "subsanacion-requerimiento", "requerimiento", "notificacion"].includes(tag))) {
    return "notification";
  }

  if (tags.some((tag) => ["estado-expediente", "estado-solicitud", "expediente"].includes(tag))) {
    return "tracking";
  }

  if (tags.some((tag) => ["reclamacion-previa", "revision", "silencio-administrativo"].includes(tag))) {
    return "review";
  }

  if (tags.some((tag) => ["formulario", "rellenar", "pdf"].includes(tag))) {
    return "form";
  }

  if (tags.some((tag) => ["cita-caiss", "portal-prestaciones", "sin-certificado-sms"].includes(tag))) {
    return "service";
  }

  return "benefit-page";
}

export function inferBenefitMetadata(input: { title?: string; url?: string; tags?: string[] }): {
  benefitId?: string;
  family?: IntentFamily;
  lifecycle?: LifecycleStage;
  sourceKind?: string;
  requiresAuth?: boolean;
  supportsSms?: boolean;
} {
  const tags = input.tags ?? [];
  const haystack = [input.title ?? "", input.url ?? "", ...tags].join(" ");
  const benefitId = detectBenefitId(haystack) ?? detectBenefitId(haystack, false);
  const entry = getBenefitCatalogEntry(benefitId);

  return {
    benefitId,
    family: entry?.family,
    lifecycle: inferLifecycleFromSourceTags(tags),
    sourceKind: inferSourceKindFromTags(tags),
    requiresAuth:
      entry?.requiresAuth ??
      (/misexpedientesadministrativos|clave|certificado|acceder/i.test(input.url ?? "") || tags.includes("sede")),
    supportsSms:
      entry?.supportsSms ??
      (tags.includes("sms") || tags.includes("sin-certificado-sms") || /sms/i.test(input.title ?? "")),
  };
}

export function buildGuidedPrompt(
  benefitId: string,
  action: "requisitos" | "documentacion" | "solicitud" | "seguimiento" | "resolucion",
): string {
  const entry = getBenefitCatalogEntry(benefitId);

  if (!entry) {
    return "Quiero una guia operativa del INSS sobre este caso: requisitos, documentos, vias, seguimiento y siguiente paso.";
  }

  if (action === "requisitos") {
    return `Quiero revisar si encajo en ${entry.displayName}. Resume requisitos, que documentos suelen pedir, errores habituales y cual es el siguiente paso.`;
  }

  if (action === "documentacion") {
    return `Quiero preparar ${entry.displayName}. Di que documentos o datos suelen pedir y que errores son habituales antes de presentar.`;
  }

  if (action === "seguimiento") {
    return `Estoy siguiendo un expediente de ${entry.displayName}. Explica como revisar estado, requerimientos, notificaciones, y si hay resolucion, como reclamar o revisar.`;
  }

  if (action === "resolucion") {
    return `Tengo dudas sobre resolucion, pagos, compatibilidades o reclamacion previa en ${entry.displayName}. Ordena las vias oficiales y el siguiente paso prudente.`;
  }

  return `Quiero presentar ${entry.displayName}. Explica vias oficiales, si suele admitir SMS o requiere identificacion y como seguir el expediente despues de presentarlo.`;
}
