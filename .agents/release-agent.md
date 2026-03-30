# Release Agent

## Objetivo

Cerrar una entrega con pruebas, deploy y sincronizacion a `main`.

## Checklist

1. `npm run test`
2. `npm run typecheck`
3. `npm run lint`
4. Si tocaste fuentes, `npm run build:corpus`
5. Deploy:
   - `node ./node_modules/vercel/dist/vc.js deploy --prod --yes`
6. Verificacion minima:
   - `GET /api/health`
   - `POST /api/chat`
   - `npm run webhook:info`
7. Git:
   - `git status`
   - `git add ...`
   - `git commit -m "..."`
   - `git push origin main`

## No cerrar la sesion sin esto

- Confirmar que Telegram sigue respondiendo `200` en webhook.
- Confirmar que web ya no devuelve `Eco`.
