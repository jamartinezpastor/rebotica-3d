# Rebotica 3D — instrucciones para el agente

Web app mobile-first que convierte una consulta sobre un síntoma leve en un pasillo 3D de
medicamentos sin receta y parafarmacia, con ficha 3D, calculadora de dosis y una vitrina diferenciada
con lo que solo puede recetar un médico.

Plan base (pantallas, datos, API y tickets; con el cambio de vitrina indicado abajo):
https://claude.ai/code/artifact/8a917b01-db4d-45a1-a901-83b044842fd7

## Cómo trabajar

- Se trabaja por tickets del plan (`F0-01`, `F1-02`…). Implementa solo el ticket pedido y cumple
  su criterio de «hecho».
- Antes de dar un ticket por terminado: `pnpm check` en verde (formato, lint, tipos, tests, build).
- Commits pequeños con el id del ticket al principio: `F1-02: descarga del catálogo sin receta`.

## Principios que no se negocian

1. **Separar sin receta y con receta.** Las baldas principales contienen medicamentos sin receta,
   parafarmacia y productos sanitarios. Los medicamentos sujetos a prescripción aparecen en una
   vitrina visualmente diferenciada (estructura oscura, señalización ámbar y aviso explícito de
   receta), con las mismas opciones de selección, caja 3D, fotos, ficha y pestañas. La ficha y la
   vista lista mantienen el aviso de precaución. Las calculadoras
   requieren siempre una regla validada y vigente, también para medicamentos con receta.
   Cambio de alcance solicitado por el usuario el 19/10/2026; sustituye la restricción original.
2. **La IA entiende, no prescribe.** El modelo de lenguaje solo clasifica el texto del usuario en
   un protocolo del catálogo y detecta alarmas. Nunca elige medicamentos ni dosis.
3. **La dosis la calcula código determinista** (`@rebotica/dosis`) a partir de reglas transcritas
   de la sección 4.2 de la ficha técnica. Nunca escribas valores de dosis de memoria ni los
   generes: si una regla no existe o no está `validada`, la ficha muestra el texto de la ficha
   técnica y no la calculadora. Los números de los tests son ficticios y deben seguir siéndolo.
4. **Derivar antes que recomendar.** Un criterio de derivación sustituye el pasillo por la
   pantalla de derivación (112, 024, médico). Ante urgencia, ni pasillo ni vitrina.
5. **Neutralidad.** Agrupar por principio activo, varias marcas y genéricos, sin patrocinios.
6. **Visual pero rápido.** 3D como experiencia principal, con vista 2D equivalente y modo de
   menos movimiento. JavaScript inicial < 250 kB comprimido.

## Datos y privacidad

- Fuente oficial: API REST pública de CIMA (AEMPS). La app sirve una copia local sincronizada;
  CIMA nunca está en el camino de una petición del usuario.
- Sin cuentas. No se guarda ni se registra el texto libre del usuario ni datos del paciente.
  La calculadora se ejecuta en el navegador. La analítica solo cuenta protocolos.

## Estructura

| Ruta                  | Qué es                                                     |
| --------------------- | ---------------------------------------------------------- |
| `apps/web`            | Vite + React + Tailwind (escena 3D con React Three Fiber)  |
| `apps/api`            | Fastify; contratos validados con los esquemas de `shared`  |
| `packages/shared`     | Esquemas Zod y constantes comunes (aviso legal, teléfonos) |
| `packages/db`         | Esquema Drizzle (PostgreSQL), migraciones y conexión       |
| `packages/dosis`      | Motor determinista (F3-02); interfaz en `apps/web` (F3-03) |
| `packages/protocolos` | Esquema de protocolos; los JSON firmados van en `data/`    |
| `jobs/sync-cima`      | Job nocturno de sincronización con CIMA                    |

Los paquetes internos exportan su código TypeScript directamente (`exports: ./src/index.ts`).
Vite y Vitest los consumen tal cual; `apps/api` y `jobs/*` los empaquetan con tsup.

En producción hay una sola imagen Docker (`Dockerfile` en la raíz): la API sirve la web compilada
desde `WEB_DIST` con fallback a `index.html` para las rutas de la SPA, y `/api/*` desconocido
responde 404 en JSON. Se despliega en Coolify con el build pack Dockerfile y PostgreSQL gestionado
por Coolify (`DATABASE_URL`).

## Comandos

```bash
pnpm install
pnpm dev          # API en :3000 y web en :5173 (con proxy de /api)
pnpm check        # todo lo que ejecuta la CI
pnpm --filter @rebotica/dosis test
```

## Convenciones

- Nombres del dominio en español (`reglaDosis`, `protocolo`, `vitrina`); términos técnicos en
  inglés cuando son estándar (`app`, `build`, `handler`).
- TypeScript estricto. Zod en cada frontera (API, JSON de protocolos, respuestas de CIMA).
- TypeScript fijado en 6.0 hasta que typescript-eslint soporte la 7.
