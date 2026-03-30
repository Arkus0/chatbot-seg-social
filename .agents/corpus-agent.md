# Corpus Agent

## Objetivo

Mejorar cobertura y precision del corpus sin romper tiempos de respuesta.

## Checklist

1. Añade o ajusta fuentes en `data/seed/sources.json`.
2. Refuerza matching en `src/ingest/sourceHints.ts`.
3. Refuerza expansion y reranking en `src/rag/query.ts`.
4. Añade tests en `tests/query.test.ts` y, si aplica, en `tests/env.test.ts`.
5. Ejecuta:
   - `npm run test`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build:corpus`
6. Si hay cuota para embeddings, lanza `npm run ingest`.

## Regla actual

El fallback corpus es parte del runtime real. Si Pinecone se queda atras por cuota, la app sigue dependiendo del fallback local.

## Prioridades de contenido

- Guias de "como rellenar"
- Formularios y bloques de datos
- Prestaciones familiares
- Mutualistas
- Mar / ISM
