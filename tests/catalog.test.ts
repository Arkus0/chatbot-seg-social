import { describe, expect, it } from "vitest";

import { detectBenefitId, inferBenefitMetadata } from "../src/rag/inssCatalog.js";

describe("catalog inference", () => {
  it("does not confuse operational INSS pages with incapacity because of short aliases", () => {
    const haystack =
      "Solicitud y tramites de prestaciones de la Seguridad Social operativa-inss portal-prestaciones sin-certificado-sms inss solicitud documentacion";

    expect(detectBenefitId(haystack)).toBe("operativa-inss");
    expect(detectBenefitId(haystack)).not.toBe("incapacidad-temporal");
  });

  it("infers shared operational presentation pages as operativa-inss", () => {
    const samples = [
      inferBenefitMetadata({
        title: "Solicitud y tramites de prestaciones de la Seguridad Social",
        url: "https://sede.seg-social.gob.es/wps/portal/sede/sede/Ciudadanos/informes%2By%2Bcertificados/inss_tramites",
        tags: ["operativa-inss", "portal-prestaciones", "sin-certificado-sms", "inss", "solicitud", "documentacion"],
      }),
      inferBenefitMetadata({
        title: "Cita previa para pensiones y otras prestaciones",
        url: "https://sede.seg-social.gob.es/wps/portal/sede/sede/Ciudadanos/Cita%2BPrevia%2Bpara%2BPensiones%2By%2BOtras%2BPrestaciones/202910?changeLanguage=es",
        tags: ["operativa-inss", "cita-caiss", "caiss", "inss", "tramite"],
      }),
      inferBenefitMetadata({
        title: "Informacion adicional para cita previa y atencion del INSS",
        url: "https://sede.seg-social.gob.es/wps/wcm/connect/sede/sede_contenidos/sede/inicio/informacionutil/informacionad",
        tags: ["operativa-inss", "cita-caiss", "caiss", "sin-certificado-sms", "inss"],
      }),
    ];

    for (const sample of samples) {
      expect(sample.benefitId).toBe("operativa-inss");
      expect(sample.family).toBe("operativa-inss");
      expect(sample.sourceKind).toBe("service");
      expect(sample.lifecycle).toBe("presentacion");
    }
  });

  it("classifies Mis expedientes as operational tracking instead of notification-only", () => {
    const metadata = inferBenefitMetadata({
      title: "Mis expedientes administrativos",
      url: "https://sede.seg-social.gob.es/wps/portal/sede/sede/Inicio/MisExpedientesAdministrativos",
      tags: [
        "operativa-inss",
        "estado-expediente",
        "subsanacion-requerimiento",
        "sin-certificado-sms",
        "estado-solicitud",
        "expediente",
        "sede",
        "tramite",
        "subsanacion",
        "requerimiento",
        "notificacion",
        "inss",
      ],
    });

    expect(metadata.benefitId).toBe("operativa-inss");
    expect(metadata.family).toBe("operativa-inss");
    expect(metadata.sourceKind).toBe("tracking");
    expect(metadata.lifecycle).toBe("seguimiento");
  });
});
