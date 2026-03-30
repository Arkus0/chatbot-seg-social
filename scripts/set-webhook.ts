import { setTelegramWebhook } from "../src/services/telegram.js";

async function main(): Promise<void> {
  const response = await setTelegramWebhook();
  console.log(JSON.stringify(response, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
