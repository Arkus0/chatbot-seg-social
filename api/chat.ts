import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

import { getAnswer } from "../src/rag/getAnswer.js";
import { logger } from "../src/utils/logger.js";

const bodySchema = z.object({
  question: z.string().trim().min(3).max(1400),
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
    const answer = await getAnswer(parsedBody.data.question);
    res.status(200).json({
      ok: true,
      answer,
    });
  } catch (error) {
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
