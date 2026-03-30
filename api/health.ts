import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getEffectiveBotMode, getEnv, getMissingConfig } from "../src/config/env.js";

export default function healthHandler(_req: VercelRequest, res: VercelResponse): void {
  const env = getEnv();
  const botMode = getEffectiveBotMode(env);
  const missingConfig = getMissingConfig(env, "health");

  res.status(200).json({
    ok: true,
    service: "gestor-seguridad-social-no-oficial",
    botMode,
    missingConfig,
    configured: {
      telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET),
      gemini: Boolean(env.GEMINI_API_KEY),
      groq: Boolean(env.GROQ_API_KEY),
      pinecone: Boolean(env.PINECONE_API_KEY && env.PINECONE_INDEX_NAME),
    },
    timestamp: new Date().toISOString(),
  });
}
