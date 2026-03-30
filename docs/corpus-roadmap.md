# Corpus Roadmap

## Ya cubierto

- Vida laboral, NUSS, autonomos, empleo de hogar
- Jubilacion ordinaria, anticipada, demorada, parcial, discapacidad
- Incapacidad temporal y permanente
- Nacimiento y cuidado de menor
- Viudedad, orfandad, favor de familiares
- IMV, convenio especial, practicas formativas
- TSE, CPS, beneficiarios de asistencia sanitaria
- Mutualistas
- Mar / ISM

## Siguiente sprint con mas retorno

1. Mutualistas:
   - mas tramites de solicitud
   - calculo y casuistica
   - compatibilidades y documentacion
2. Mar / ISM:
   - tramites frecuentes
   - formularios especificos
   - guias de sede electronica
3. Familia / hijos:
   - mas formularios y "como rellenar"
   - cuidado de menor grave
   - brecha de genero
4. Incapacidad permanente:
   - mas formularios
   - mas guias de datos y documentacion

## Flujo correcto al tocar corpus

1. Cambia `data/seed/sources.json`
2. Refuerza `src/ingest/sourceHints.ts`
3. Refuerza `src/rag/query.ts`
4. Cubre el caso con tests
5. Ejecuta `npm run build:corpus`
6. Reintenta `npm run ingest` solo si hay cuota

## Regla editorial

- Prioriza `seg-social.es`, `sede.seg-social.gob.es` e `Importass`.
- Usa `revista.seg-social.es` como apoyo, no como fuente primaria cuando exista alternativa oficial directa.
- Para "como rellenar", solo afirma campos o casillas si la fuente oficial lo permite de forma explicita.
