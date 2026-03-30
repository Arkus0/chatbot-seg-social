# Session Handoff

Actualizado el 2026-03-30 (segunda actualizacion del dia).

## Estado estable

- Produccion en `BOT_MODE=rag`.
- `GET /api/health` devuelve `botMode: "rag"` y `missingConfig: []`.
- `POST /api/chat` responde de nuevo con fuentes oficiales.
- `POST /api/webhook` responde rapido y procesa Telegram en background.
- Telegram dispone de modo guiado con botones navegables (`/menu`) y salida (`/reset`).
- Proyecto Vercel canonico:
  - `projectId = prj_vRwMawuIb7WYq3Vb8nVTJOM9qpig`
  - `teamId = team_l8PhmvuV6TYXf87kaVVxX8zV`

## Que se corrigio

- Produccion ya no cae en `echo` cuando faltan env vars.
- `api/health.ts` expone `botMode` y `missingConfig`.
- `api/chat.ts` y `api/webhook.ts` devuelven errores de configuracion explicitos.
- El retriever usa fast path lexico para no depender de embeddings en consultas en vivo.
- `embedQuery()` ya no hace retries largos cuando Gemini embeddings esta sin cuota.
- El webhook de Telegram usa `waitUntil()` y devuelve `200` rapido.
- El webhook de Telegram queda configurado para `allowed_updates` con `message` y `callback_query`.
- El corpus queda reequilibrado para priorizar fuentes oficiales en intenciones de tramite.
- Se refuerzan reglas semanticas para `subsanacion`, `requerimientos`, `notificaciones` y `CAISS`.

## Verificaciones ya hechas

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build:corpus`
- `npm run set:webhook`
- `npm run webhook:info`
- `npm run build:corpus` (tras reequilibrar semillas)

## Limite conocido

- Gemini embeddings sigue en cuota para ingestiones completas. `npm run ingest` puede fallar con `429`.
- La app sigue funcionando porque el fallback corpus local esta reconstruido y el runtime prioriza la recuperacion lexica cuando hay suficiente contexto.
- El menu guiado de Telegram es estado en memoria por chat (sin persistencia cross-instance).

## Siguiente foco recomendado

1. Medir metricas de uso del menu guiado (topic mas usado, tasa de abandono, latencia por accion).
2. Añadir cobertura de fuentes primarias para subsanacion/requerimientos por tipo de prestacion.
3. Si hay cuota, reintentar ingest completo para alinear Pinecone con el fallback local actualizado.
