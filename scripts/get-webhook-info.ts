import { getTelegramWebhookInfo } from "../src/services/telegram.js";

async function main(): Promise<void> {
  const response = await getTelegramWebhookInfo();
  console.log(JSON.stringify(response, null, 2));

  if (!response.ok || !response.result) {
    process.exitCode = 1;
    return;
  }

  const allowedUpdates = Array.isArray(response.result.allowed_updates)
    ? response.result.allowed_updates.map((value) => String(value))
    : [];
  const webhookUrl = String(response.result.url ?? "");
  const missingChecks: string[] = [];

  if (!webhookUrl.endsWith("/api/webhook")) {
    missingChecks.push("url canonica del webhook");
  }

  if (!allowedUpdates.includes("message")) {
    missingChecks.push("allowed_updates.message");
  }

  if (!allowedUpdates.includes("callback_query")) {
    missingChecks.push("allowed_updates.callback_query");
  }

  if (missingChecks.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: "Webhook de Telegram incompleto",
          missingChecks,
          hint: "Ejecuta `npm run set:webhook` y vuelve a comprobar `npm run webhook:info`.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
