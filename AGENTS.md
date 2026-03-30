# AGENTS.md

Guia rapida para futuras sesiones sobre este repo.

## Mision

Este proyecto sirve un asistente informativo de Seguridad Social para web y Telegram.
La prioridad operativa es mantener `BOT_MODE=rag` estable en produccion y evitar regresiones que devuelvan respuestas `Eco` o rompan el webhook.

## Bootstrap obligatorio

1. Lee [docs/session-handoff.md](docs/session-handoff.md).
2. Revisa `git status`.
3. Si el trabajo toca runtime, verifica `GET /api/health` en `https://chatbot-seg-social.vercel.app/api/health`.
4. Si el trabajo toca corpus, recuerda que el fallback local y Pinecone pueden ir desfasados cuando Gemini embeddings esta en cuota.

## Hechos estables de produccion

- Proyecto Vercel canonicto: `prj_vRwMawuIb7WYq3Vb8nVTJOM9qpig`
- Team Vercel: `team_l8PhmvuV6TYXf87kaVVxX8zV`
- URL canonica: `https://chatbot-seg-social.vercel.app`
- Node en Vercel: `22.x`
- En produccion `BOT_MODE` debe ser explicito.
- `APP_BASE_URL` debe existir en produccion y apuntar a la URL canonica.
- El webhook de Telegram debe responder `200` rapido y dejar el trabajo pesado en background.

## Guardrails

- No reintroducir degradacion silenciosa a `echo` en produccion.
- No volver a bloquear `/api/webhook` esperando a `getAnswer()`.
- No asumir que Gemini embeddings estara disponible para consultas en vivo.
- Cuando cambies `data/seed/sources.json`, reconstruye `data/cache/fallback-corpus.json`.
- `APP_BASE_URL` solo es obligatorio en produccion. No copies ese valor a preview salvo que sea intencional.

## Donde mirar

- Plataforma y despliegue: [docs/operations.md](docs/operations.md)
- Estado actual y limites conocidos: [docs/session-handoff.md](docs/session-handoff.md)
- Corpus y siguientes bloques: [docs/corpus-roadmap.md](docs/corpus-roadmap.md)
- Briefs de agentes: [.agents/README.md](.agents/README.md)

## Comandos base

```bash
npm run test
npm run typecheck
npm run lint
npm run build:corpus
npm run smoke
npm run set:webhook
npm run webhook:info
node ./node_modules/vercel/dist/vc.js deploy --prod --yes
```
