# Session Handoff

Actualizado el 2026-03-30 (quinta actualizacion del dia).

## Produccion estable verificada

- `GET https://chatbot-seg-social.vercel.app/api/health` se verifico de nuevo el 2026-03-30 a las `20:25:27Z`.
- Respuesta observada:
  - `ok: true`
  - `service: "gestor-seguridad-social-no-oficial"`
  - `botMode: "rag"`
  - `missingConfig: []`
  - `configured.telegram/gemini/groq/pinecone: true`
- `POST /api/webhook` sigue pensado para responder rapido y procesar Telegram en background.
- Telegram mantiene modo guiado con botones navegables (`/menu`) y salida (`/reset`).
- Incidencia detectada y corregida el 2026-03-30: el webhook activo habia quedado con `allowed_updates: ["message"]`; eso hacia que los botones se quedaran marcados y no llegaran `callback_query` al bot.
- Tras relanzar `npm run set:webhook`, `npm run webhook:info` vuelve a mostrar `allowed_updates: ["message", "callback_query"]`.

## Estado actual del repo

- El arbol local ya esta en modo gestor conversacional v2 para INSS con mejoras de respuesta operativa.
- El chat trabaja por `family`, `operation`, `benefitId` y `lifecycleStage`.
- `POST /api/chat` acepta `question`, `channel` y `state`, y ahora devuelve ademas:
  - `decisionStatus`
  - `confidence`
  - `recommendedActions`
  - `mode`
  - `intent`
  - `benefitId`
  - `lifecycleStage`
  - `caseSummary`
  - `checklist`
  - `alternatives`
  - `nextBestAction`
  - `sections`
  - `clarifyingQuestions`
  - `suggestedReplies`
  - `state`
- `GET /api/catalog` expone el mismo catalogo guiado que consumen web y Telegram.
- La web y Telegram ya salen de `src/rag/inssCatalog.ts`; no deben mantener listas manuales separadas.
- La web ahora es chat-first: oculta expediente, checklist y guardado local hasta que exista una primera respuesta util.
- Telegram y web comparten acciones operativas estructuradas a partir de `recommendedActions`.

## Catalogo y corpus ya ampliados en el repo

- Jubilacion.
- Incapacidad temporal.
- Incapacidad permanente.
- Nacimiento y cuidado de menor.
- Familia y cuidados especiales.
- Viudedad.
- Supervivencia.
- Asistencia sanitaria.
- TSE y CPS.
- Alta de beneficiarios.
- IMV.
- SOVI.
- Seguro escolar.
- Prestaciones especiales INSS: violencia contra la mujer, actos terroristas, Sindrome Toxico y Amianto.
- Operativa comun del INSS.

## Fuentes y retrieval

- `data/seed/sources.json` sigue incluyendo paginas oficiales para prestaciones familiares, SOVI, seguro escolar, violencia contra la mujer, actos terroristas, Sindrome Toxico, Amianto y corresponsabilidad en el cuidado del lactante.
- `src/ingest/sourceHints.ts`, `src/rag/query.ts` y `src/rag/retriever.ts` trabajan con metadata por prestacion y ciclo de vida:
  - `benefitId`
  - `family`
  - `lifecycle`
  - `sourceKind`
  - `requiresAuth`
  - `supportsSms`
  - `formCodes`
- El fallback local ya se habia reconstruido tras ampliar semillas.
- `data/cache/fallback-corpus.json` queda en `910` chunks.
- La ruta TSE/CPS ya evita la deriva a estudios cuando no toca, pero sigue siendo el principal cuello de latencia.

## Verificaciones ya hechas en este arbol

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run smoke`
- `npm run webhook:info`
- `npm run set:webhook`
- `npm run telegram:commands`
- `npm run benchmark:chat`
- `npm run ask -- "Necesito la TSE urgente para viajar manana y no se si me conviene CPS"`
- `npm run ask -- "Tengo 63 anos y 34 cotizados y quiero jubilarme cuanto antes"`

## Resultado relevante de smoke

- `npm run smoke` paso a nivel de runtime.
- El LLM respondio `OK`.
- Pinecone sigue visible con el indice `seg-social-rag`.
- Gemini embeddings siguio devolviendo `429 Too Many Requests` en embedding de prueba.
- El runtime sigue siendo valido porque el fast path lexico y el fallback local continuan funcionando.

## Resultado relevante de release

- Despliegue a produccion completado el 2026-03-30.
- Deployment id: `dpl_93FmfWXieatw16Zu8Dn654fHoDuF`.
- Alias canonico actualizado: `https://chatbot-seg-social.vercel.app`.
- `POST /api/chat` en produccion ya expone `decisionStatus`, `confidence` y `recommendedActions`.
- `npm run benchmark:chat` contra produccion dejo estos hitos:
  - IMV documentacion: ~1.6 s, `ready_to_prepare`.
  - Jubilacion con 63 anos y 34 cotizados: ~0.3 s, `need_info`, una sola aclaracion bloqueante.
  - Incapacidad permanente documentacion: ~1.6 s, `ready_to_prepare`.
  - Viudedad inicial: ~11.8 s, correcta pero lenta.
  - TSE/CPS urgente: timeout intermitente en benchmark y respuesta manual correcta en ~23.8 s.

## Limites conocidos

- Gemini embeddings sigue en cuota para ingestiones completas. `npm run ingest` puede fallar con `429`.
- Pinecone puede quedar por detras del fallback local hasta que se reintente la ingesta con cuota suficiente.
- El estado de Telegram sigue siendo efimero y en memoria por chat, con TTL de 30 minutos.
- Seguro escolar y varias prestaciones especiales ya entran en catalogo, pero algunas consultas aun deberian aclarar primero el supuesto exacto si no hay fuente oficial suficiente para cerrar la orientacion.
- TSE/CPS sigue mostrando latencia alta e incluso timeout intermitente en produccion.

## Estado de despliegue

- Release desplegada en produccion y webhook Telegram reconfigurado.
- `npm run webhook:info` vuelve a pasar con `message` y `callback_query`.

## Siguiente foco recomendado

1. Bajar la latencia y eliminar el timeout intermitente de TSE/CPS en produccion.
2. Hacer una comprobacion manual del mismo caso en web y Telegram para confirmar paridad de `intent`, `benefitId`, `decisionStatus` y `recommendedActions`.
3. Seguir ampliando paginas oficiales por prestacion para cuantia, pago, compatibilidades y reclamacion previa, sobre todo en `familia-cuidados`, `seguro-escolar` y `prestaciones-especiales`.
4. Reintentar `npm run ingest` cuando haya cuota para alinear Pinecone con el fallback local.
