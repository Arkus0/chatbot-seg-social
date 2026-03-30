const DEFAULT_BASE_URL = process.env.BENCHMARK_CHAT_BASE_URL ?? process.env.APP_BASE_URL ?? "http://localhost:3000";

const BENCHMARK_CASES = [
  "Quiero pedir el IMV y no se que documentos preparar",
  "Necesito la TSE para viajar manana, que me conviene",
  "Tengo 63 anos y 34 cotizados y quiero jubilarme cuanto antes",
  "Que documentos suelen pedir para una incapacidad permanente absoluta",
  "Quiero pedir viudedad y no se por donde empezar",
];

async function runCase(baseUrl: string, question: string) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      question,
      channel: "web",
    }),
  });
  const elapsedMs = Date.now() - startedAt;
  const rawBody = await response.text();
  let payload: any;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = {
      ok: false,
      error: rawBody.slice(0, 200),
    };
  }

  return {
    question,
    elapsedMs,
    ok: response.ok && payload.ok,
    status: response.status,
    error: payload.error ?? null,
    mode: payload.answer?.mode ?? null,
    decisionStatus: payload.answer?.decisionStatus ?? null,
    confidence: payload.answer?.confidence ?? null,
    benefitId: payload.answer?.benefitId ?? null,
    lifecycleStage: payload.answer?.lifecycleStage ?? null,
    sourceCount: Array.isArray(payload.answer?.sources) ? payload.answer.sources.length : 0,
    actions: Array.isArray(payload.answer?.recommendedActions)
      ? payload.answer.recommendedActions.map((action: { label?: string }) => action.label ?? "")
      : [],
  };
}

async function main(): Promise<void> {
  const results = [];

  for (const question of BENCHMARK_CASES) {
    results.push(await runCase(DEFAULT_BASE_URL, question));
  }

  const answerRuns = results.filter((result) => result.ok);
  const averageMs =
    answerRuns.length > 0
      ? Math.round(answerRuns.reduce((total, result) => total + result.elapsedMs, 0) / answerRuns.length)
      : null;

  console.log(
    JSON.stringify(
      {
        baseUrl: DEFAULT_BASE_URL,
        averageMs,
        targets: {
          clarifyUnderMs: 1500,
          firstApplicationUnderMs: 3500,
          generatedAnswerUnderMs: 4500,
        },
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
