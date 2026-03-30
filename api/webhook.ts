import type { VercelRequest, VercelResponse } from "@vercel/node";

import { createBot } from "../src/bot/createBot.js";
import { assertTelegramEnv, getEnv } from "../src/config/env.js";
import { isTelegramSecretValid } from "../src/services/security.js";
import { logger } from "../src/utils/logger.js";

export default async function webhookHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const env = getEnv();
  assertTelegramEnv(env);

  const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
  const receivedSecret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;

  if (!isTelegramSecretValid(receivedSecret, env.TELEGRAM_WEBHOOK_SECRET!)) {
    res.status(401).json({ ok: false, error: "Invalid secret token" });
    return;
  }

  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ ok: false, error: "Invalid Telegram update payload" });
    return;
  }

  try {
    const bot = createBot();
    await bot.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error("Webhook processing failed", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
