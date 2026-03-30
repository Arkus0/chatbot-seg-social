import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

import { assertRuntimeConfig, getEnv, isEnvConfigurationError } from "../src/config/env.js";
import { getAnswer } from "../src/rag/getAnswer.js";
import { logger } from "../src/utils/logger.js";

const bodySchema = z.object({
  question: z.string().trim().min(3).max(1400),
  channel: z.enum(["web", "telegram"]).default("web"),
  state: z
    .object({
      family: z
        .enum([
          "general",
          "jubilacion",
          "incapacidad",
          "familia-cuidados",
          "supervivencia",
          "asistencia-sanitaria",
          "imv",
          "operativa-inss",
          "prestaciones-especiales",
        ])
        .optional(),
      operation: z
        .enum([
          "general",
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
        ])
        .optional(),
      benefitId: z.string().trim().min(2).max(120).optional(),
      lifecycleStage: z
        .enum(["descubrimiento", "orientacion", "preparacion", "presentacion", "seguimiento", "resolucion", "revision"])
        .optional(),
      facts: z.record(z.string(), z.string()).optional(),
      missingFacts: z.array(z.string()).optional(),
      factsConfirmed: z.record(z.string(), z.string()).optional(),
      factsPending: z.array(z.string()).optional(),
      caseSummary: z.string().max(400).optional(),
      lastRecommendedAction: z.string().max(400).optional(),
      updatedAt: z.string().optional(),
    })
    .optional(),
});

export default async function chatHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const rawBody =
    typeof req.body === "string"
      ? (() => {
          try {
            return JSON.parse(req.body) as unknown;
          } catch {
            return undefined;
          }
        })()
      : req.body;

  const parsedBody = bodySchema.safeParse(rawBody);

  if (!parsedBody.success) {
    res.status(400).json({
      ok: false,
      error: "Invalid request body",
      details: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const env = getEnv();
    assertRuntimeConfig(env, "chat");
    const normalizedState = parsedBody.data.state
      ? {
          family: parsedBody.data.state.family ?? "general",
          operation: parsedBody.data.state.operation ?? "general",
          benefitId: parsedBody.data.state.benefitId,
          lifecycleStage: parsedBody.data.state.lifecycleStage ?? "descubrimiento",
          facts: parsedBody.data.state.facts ?? {},
          missingFacts: parsedBody.data.state.missingFacts ?? [],
          factsConfirmed: parsedBody.data.state.factsConfirmed ?? parsedBody.data.state.facts ?? {},
          factsPending: parsedBody.data.state.factsPending ?? parsedBody.data.state.missingFacts ?? [],
          caseSummary: parsedBody.data.state.caseSummary ?? "Caso abierto sin datos suficientes.",
          lastRecommendedAction: parsedBody.data.state.lastRecommendedAction ?? "",
          updatedAt: parsedBody.data.state.updatedAt ?? new Date().toISOString(),
        }
      : undefined;
    const answer = await getAnswer(parsedBody.data.question, {
      channel: parsedBody.data.channel,
      state: normalizedState,
    });
    res.status(200).json({
      ok: true,
      answer,
    });
  } catch (error) {
    if (isEnvConfigurationError(error)) {
      logger.error("Chat API misconfigured", {
        missingConfig: error.missingKeys,
      });

      res.status(503).json({
        ok: false,
        error: "Server configuration error",
        missingConfig: error.missingKeys,
      });
      return;
    }

    logger.error("Chat API failed", {
      error,
      question: parsedBody.data.question,
    });

    res.status(500).json({
      ok: false,
      error: "No se pudo generar la respuesta.",
    });
  }
}
