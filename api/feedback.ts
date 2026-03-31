import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

import { logger } from "../src/utils/logger.js";

const bodySchema = z.object({
  messageId: z.string().trim().min(1).max(200),
  value: z.enum(["positive", "negative"]),
  timestamp: z.string().optional(),
});

export default function feedbackHandler(req: VercelRequest, res: VercelResponse): void {
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

  const parsed = bodySchema.safeParse(rawBody);

  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid request body" });
    return;
  }

  logger.info("User feedback received", {
    messageId: parsed.data.messageId,
    value: parsed.data.value,
    timestamp: parsed.data.timestamp,
  });

  res.status(200).json({ ok: true });
}
