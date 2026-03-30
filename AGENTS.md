# AGENTS.md

Guia rapida para futuras sesiones sobre este repo.

## Mision

Este proyecto sirve un gestor conversacional del INSS para web y Telegram.
La prioridad operativa es mantener `BOT_MODE=rag` estable en produccion, conservar el mismo criterio en ambos canales y evitar regresiones que devuelvan respuestas `Eco` o rompan el webhook.

## Bootstrap obligatorio

1. Lee [docs/session-handoff.md](docs/session-handoff.md).
2. Revisa `git status`.
3. Si el trabajo toca runtime o experiencia chat, verifica `GET /api/health` en `https://chatbot-seg-social.vercel.app/api/health`.
4. Si el trabajo toca chat guiado o contrato de respuesta, revisa `api/chat.ts`, `api/catalog.ts`, `src/rag/conversation.ts`, `src/rag/inssCatalog.ts` y `src/bot/handlers.ts`.
5. Si el trabajo toca corpus, recuerda que el fallback local y Pinecone pueden ir desfasados cuando Gemini embeddings esta en cuota.

## Hechos estables de produccion

- Proyecto Vercel canonico: `prj_vRwMawuIb7WYq3Vb8nVTJOM9qpig`
- Team Vercel: `team_l8PhmvuV6TYXf87kaVVxX8zV`
- URL canonica: `https://chatbot-seg-social.vercel.app`
- Node en Vercel: `22.x`
- En produccion `BOT_MODE` debe ser explicito.
- `APP_BASE_URL` debe existir en produccion y apuntar a la URL canonica.
- El webhook de Telegram debe responder `200` rapido y dejar el trabajo pesado en background.
- El webhook debe aceptar `callback_query` ademas de `message`.
- Si los botones de Telegram se quedan marcados y no hacen nada, casi siempre falta `callback_query` en `allowed_updates`.
- `POST /api/chat` acepta `question`, `channel` y `state`.
- `GET /api/catalog` sirve el mismo catalogo guiado para web y Telegram.
- El bot de Telegram expone menu guiado por botones (`/menu`) y salida de contexto (`/reset`).
- El estado de Telegram es ligero, por chat y con TTL de 30 minutos.

## Guardrails

- No reintroducir degradacion silenciosa a `echo` en produccion.
- No volver a bloquear `/api/webhook` esperando a `getAnswer()`.
- No asumir que Gemini embeddings estara disponible para consultas en vivo o ingestiones largas.
- No perder `callback_query` en `allowed_updates` o el menu guiado dejara de funcionar.
- Si `npm run webhook:info` falla por `allowed_updates.callback_query`, corrige primero el webhook con `npm run set:webhook` antes de depurar handlers.
- No desincronizar web y Telegram: la fuente de verdad del catalogo guiado es `src/rag/inssCatalog.ts`, expuesta por `api/catalog.ts`.
- Si cambias el contrato de chat, mantén compatibilidad con `text`, `summary`, `keyPoints`, `sources` y `legalNotice` mientras migran clientes.
- Cuando cambies `data/seed/sources.json`, reconstruye `data/cache/fallback-corpus.json`.
- `APP_BASE_URL` solo es obligatorio en produccion. No copies ese valor a preview salvo que sea intencional.

## Donde mirar

- Plataforma y despliegue: [docs/operations.md](docs/operations.md)
- Estado actual y limites conocidos: [docs/session-handoff.md](docs/session-handoff.md)
- Cobertura y siguientes bloques de corpus: [docs/corpus-roadmap.md](docs/corpus-roadmap.md)
- Briefs de agentes: [.agents/README.md](.agents/README.md)

## Comandos base

```bash
npm run test
npm run typecheck
npm run lint
npm run build:corpus
npm run smoke
npm run ask -- "Tengo un requerimiento del INSS y quiero saber el siguiente paso"
npm run set:webhook
npm run webhook:info
npm run telegram:commands
node ./node_modules/vercel/dist/vc.js deploy --prod --yes
```
