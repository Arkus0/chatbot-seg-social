# Release Agent

## Objetivo

Cerrar una entrega con pruebas, sincronizacion git y, si toca, deploy a produccion.

## Checklist

1. `git status`
2. `npm run test`
3. `npm run typecheck`
4. `npm run lint`
5. Si tocaste fuentes, hints o query, `npm run build:corpus`
6. Si tocaste runtime, `npm run smoke`
7. Si la entrega incluye release:
   - `node ./node_modules/vercel/dist/vc.js deploy --prod --yes`
   - `GET /api/health`
   - smoke manual de `/api/chat`
   - `npm run webhook:info`
8. Git:
   - `git add ...`
   - `git commit -m "..."`
   - `git push origin main`

## No cerrar la sesion sin esto

- Confirmar si el cambio ha quedado solo sincronizado en git o tambien desplegado.
- Confirmar que Telegram sigue respondiendo `200` en webhook.
- Confirmar que web no vuelve a `Eco`.
- Confirmar que el menu guiado sigue funcionando con `callback_query`.
