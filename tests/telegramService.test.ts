import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnvCache } from "../src/config/env.js";
import { setTelegramCommands, setTelegramWebhook } from "../src/services/telegram.js";

const originalEnv = { ...process.env };

function setEnv(entries: Record<string, string | undefined>): void {
  process.env = { ...originalEnv };

  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }

  resetEnvCache();
}

describe("telegram service payloads", () => {
  beforeEach(() => {
    setEnv({
      APP_BASE_URL: "https://chatbot-seg-social.vercel.app",
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET: "secret",
    });
  });

  afterAll(() => {
    process.env = originalEnv;
    resetEnvCache();
  });

  it("configures webhook with callback_query updates enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await setTelegramWebhook();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(options.body)) as { allowed_updates?: string[] };

    expect(payload.allowed_updates).toEqual(["message", "callback_query"]);

    vi.unstubAllGlobals();
  });

  it("registers /menu and /reset commands", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await setTelegramCommands();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(options.body)) as {
      commands?: Array<{ command: string; description: string }>;
    };
    const commands = payload.commands?.map((command) => command.command) ?? [];

    expect(commands).toContain("menu");
    expect(commands).toContain("reset");

    vi.unstubAllGlobals();
  });
});
