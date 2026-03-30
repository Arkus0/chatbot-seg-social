# Session Handoff

Actualizado el 2026-03-30 (tercera actualizacion del dia).

## Produccion estable verificada

- `GET https://chatbot-seg-social.vercel.app/api/health` se comprobo el 2026-03-30 a las `18:42:03Z`.
- Respuesta observada:
  - `ok: true`
  - `service: "gestor-seguridad-social-no-oficial"`
  - `botMode: "rag"`
  - `missingConfig: []`
  - `configured.telegram/gemini/groq/pinecone: true`
- `POST /api/webhook` sigue pensado para responder rapido y procesar Telegram en background.
- Telegram mantiene modo guiado con botones navegables (`/menu`) y salida (`/reset`).
- El webhook sigue necesitando `allowed_updates` con `message` y `callback_query`.

## Estado actual del repo

- El arbol local ya esta en modo gestor conversacional v2 para INSS.
- El chat trabaja por `family`, `operation`, `benefitId` y `lifecycleStage`.
- `POST /api/chat` acepta `question`, `channel` y `state`, y devuelve un payload ampliado con:
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

- `data/seed/sources.json` ya incluye nuevas paginas oficiales para prestaciones familiares, SOVI, seguro escolar, violencia contra la mujer, actos terroristas, Sindrome Toxico, Amianto y corresponsabilidad en el cuidado del lactante.
- `src/ingest/sourceHints.ts`, `src/rag/query.ts` y `src/rag/retriever.ts` ya trabajan con metadata por prestacion y ciclo de vida:
  - `benefitId`
  - `family`
  - `lifecycle`
  - `sourceKind`
  - `requiresAuth`
  - `supportsSms`
  - `formCodes`
- El fallback local se reconstruyo tras ampliar semillas.
- `data/cache/fallback-corpus.json` queda en `910` chunks tras la ultima reconstruccion.

## Verificaciones ya hechas en este arbol

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build:corpus`
- `npm run smoke`
- `npm run ask -- "Tengo un requerimiento del IMV y quiero saber el siguiente paso"`
- `npm run ask -- "Que cubre el seguro escolar"`

## Resultado relevante de smoke

- `npm run smoke` paso a nivel de runtime.
- El LLM respondio `OK`.
- Pinecone sigue visible con el indice `seg-social-rag`.
- Gemini embeddings siguio devolviendo `429 Too Many Requests` en embedding de prueba.
- El runtime sigue siendo valido porque el fast path lexico y el fallback local continúan funcionando.

## Limites conocidos

- Gemini embeddings sigue en cuota para ingestiones completas. `npm run ingest` puede fallar con `429`.
- Pinecone puede quedar por detras del fallback local hasta que se reintente la ingesta con cuota suficiente.
- El estado de Telegram sigue siendo efimero y en memoria por chat, con TTL de 30 minutos.
- Seguro escolar y varias prestaciones especiales ya entran en catalogo, pero algunas consultas aun deberian aclarar primero el supuesto exacto si no hay fuente oficial suficiente para cerrar la orientacion.

## Estado de despliegue

- Esta tanda v2 del gestor conversacional esta implementada en el repo local y lista para sincronizarse.
- No hay constancia en este handoff de un deploy a produccion posterior a estos cambios locales.

## Siguiente foco recomendado

1. Desplegar esta tanda cuando toque release y repetir `GET /api/health`, smoke de `/api/chat` y `npm run webhook:info`.
2. Hacer una comprobacion manual del mismo caso en web y Telegram para confirmar paridad de `intent`, `benefitId`, `mode` y `sections`.
3. Seguir ampliando paginas oficiales por prestacion para cuantia, pago, compatibilidades y reclamacion previa, sobre todo en `familia-cuidados`, `seguro-escolar` y `prestaciones-especiales`.
4. Reintentar `npm run ingest` cuando haya cuota para alinear Pinecone con el fallback local.
