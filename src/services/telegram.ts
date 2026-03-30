import { assertWebhookUrlEnv, getEnv } from "../config/env.js";

interface TelegramApiResponse<T = boolean> {
  ok: boolean;
  result?: T;
  description?: string;
}

function buildTelegramApiUrl(method: string): string {
  const env = getEnv();

  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
}

export function buildWebhookUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/webhook`;
}

async function callTelegramApi<T>(method: string, payload: Record<string, unknown>): Promise<TelegramApiResponse<T>> {
  const response = await fetch(buildTelegramApiUrl(method), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Telegram API request failed with status ${response.status}`);
  }

  return (await response.json()) as TelegramApiResponse<T>;
}

async function getTelegramApi<T>(method: string): Promise<TelegramApiResponse<T>> {
  const response = await fetch(buildTelegramApiUrl(method), {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Telegram API request failed with status ${response.status}`);
  }

  return (await response.json()) as TelegramApiResponse<T>;
}

export async function setTelegramWebhook(): Promise<TelegramApiResponse<boolean>> {
  const env = getEnv();
  assertWebhookUrlEnv(env);

  return callTelegramApi<boolean>("setWebhook", {
    url: buildWebhookUrl(env.APP_BASE_URL!),
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}

export async function deleteTelegramWebhook(): Promise<TelegramApiResponse<boolean>> {
  return callTelegramApi<boolean>("deleteWebhook", {
    drop_pending_updates: true,
  });
}

export async function getTelegramWebhookInfo(): Promise<TelegramApiResponse<Record<string, unknown>>> {
  return getTelegramApi<Record<string, unknown>>("getWebhookInfo");
}

export async function setTelegramCommands(): Promise<TelegramApiResponse<boolean>> {
  return callTelegramApi<boolean>("setMyCommands", {
    commands: [
      {
        command: "start",
        description: "Iniciar el asistente",
      },
      {
        command: "help",
        description: "Ver ayuda y ejemplos",
      },
      {
        command: "menu",
        description: "Abrir menu guiado por botones",
      },
      {
        command: "reset",
        description: "Salir del modo guiado",
      },
    ],
  });
}
