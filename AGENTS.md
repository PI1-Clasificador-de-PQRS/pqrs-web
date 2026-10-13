# AGENTS.md

Guía para agentes y personas que trabajan en `pqrs-web`, el dashboard del Clasificador
automático de PQRS. Las otras piezas son `pqrs-classifier` (modelo) y `pqrs-api` (FastAPI).

## Reglas generales

- **Interfaz en español**, en lenguaje claro para personal no técnico, con estados de carga,
  vacío y error. Identificadores, commits y PR **en inglés**.
- Todo texto que venga de la API o de un CSV se muestra como **texto plano**.
  `dangerouslySetInnerHTML` está prohibido (lo verifica ESLint con `react/no-danger`).
- Los mensajes de error salen del `code` estable de la API, a través del catálogo único
  `src/lib/api/errors.ts`. Si llega un código desconocido, se muestra el `message` de la API.
- No se agregan dependencias sin acordarlo.
- No se inventan endpoints. Si el contrato no cubre algo, se anota en el PR.
- Antes de un PR:
  `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:api`.

## Arquitectura: proxy BFF

```
Navegador ──(solo mismo origen, sin credenciales)──▶ Next.js /api/proxy/<ruta>
                                                      │ añade secreto, IP y CSRF
                                                      ▼
                                          pqrs-api  /api/v1/<ruta>
```

El navegador **solo** habla con el origen del dashboard y **nunca** maneja credenciales. La
cookie de sesión es `HttpOnly` y la fija la API a través del proxy.

| Pieza                                              | Archivo                                                    |
| -------------------------------------------------- | ---------------------------------------------------------- |
| Route Handler catch-all (runtime Node)             | `src/app/api/proxy/[...path]/route.ts`                     |
| Lógica del proxy (lista blanca, CSRF, cabeceras)   | `src/lib/server/bff.ts`                                    |
| IP del navegador                                   | `src/lib/server/client-ip.ts`                              |
| Variables de entorno (`server-only`)               | `src/lib/server/env.ts`                                    |
| Validación de la sesión en el servidor (`GET /me`) | `src/lib/server/api.ts` y `src/app/(protected)/layout.tsx` |
| Redirección sin cookie                             | `src/proxy.ts` (ver la nota abajo)                         |
| Cliente tipado del navegador y manejo del 401      | `src/lib/api/client.ts`, `src/lib/api/session.ts`          |

> **Ojo con el nombre.** `src/proxy.ts` es la convención de Next 16 que antes se llamaba
> `middleware.ts`: solo redirige a `/login` si falta la cookie. **No** es el proxy BFF.

### Lista blanca

Rutas relativas a `/api/v1`:

- `POST auth/login`
- `POST auth/logout`
- `GET me`
- `GET models`
- `POST classify`
- `POST classify/batch`
- `GET classifications`
- `GET classifications/{uuid}`
- `GET metrics/summary`

Cualquier otra ruta o método (incluidos `HEAD` y `OPTIONS`) responde 404 `not_found`. Para
añadir una ruta, se agrega a `ROUTES` en `bff.ts`, con su prueba.

### Lo que hace el proxy en cada petición

1. **Parte de cabeceras vacías.** Solo copia `accept`, `accept-language` y `content-type`. Así,
   `X-API-Key`, `Authorization`, `X-Forwarded-*`, cualquier `X-PQRS-*` del navegador y las
   cookies ajenas nunca llegan a la API.
2. **Reenvía solo la cookie de sesión** (`SESSION_COOKIE_NAME`).
3. **Añade siempre** `X-PQRS-Proxy-Secret`.
4. **Añade `X-PQRS-Client-IP`** si hay una IP válida (ver abajo).
5. **Añade `X-PQRS-CSRF: 1`** en `POST`, `PUT`, `PATCH` y `DELETE`, salvo en el login, y solo
   después de pasar la verificación CSRF.
6. **Devuelve el status y el cuerpo** de la API sin cambios. Al navegador solo pasan
   `Set-Cookie` (cada uno, con sus atributos), `Retry-After` y `content-type`, más
   `Cache-Control: no-store`.
7. **Si la API no responde** (error de red o timeout de 120 s), devuelve 502 con
   `{"detail":{"code":"api_unreachable","message":"..."}}`.
8. **Cuerpo de más de 2 MiB:** 413 `payload_too_large`, sin llamar a la API.
9. **No registra** cuerpos, cookies ni cabeceras. Solo, ante un fallo de red, el método, la ruta
   y el tipo de error.

### CSRF del lado del navegador

En los métodos que modifican datos, **incluido el login**, el proxy exige **las dos** cosas:

- `X-Requested-With: pqrs-web`, que el cliente de `src/lib/api/client.ts` pone en toda petición;
- `Origin` con el mismo host que la cabecera `Host` o, si no hay `Origin`,
  `Sec-Fetch-Site: same-origin`. Un `Origin` ajeno se rechaza siempre.

Si falta cualquiera de las dos, responde 403 `csrf_required`.

### IP del navegador y `WEB_TRUSTED_PROXY_HOPS`

Next 16 **no expone la IP del socket** a un Route Handler. Además, solo escribe esa IP en
`X-Forwarded-For` si el navegador no envió la cabecera
(`req.headers['x-forwarded-for'] ??= socket.remoteAddress` en
`next/dist/server/base-server.js`, verificado en 16.4.0). Por eso:

| `WEB_TRUSTED_PROXY_HOPS`                            | Regla                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `N ≥ 1` (despliegue)                                | Toma la entrada N **contando desde la derecha** de `X-Forwarded-For`. Si hay menos de N entradas o no es una IP válida, no se envía la cabecera. |
| `0` (**solo desarrollo**, sin nada delante de Next) | Usa `X-Forwarded-For` solo si tiene **exactamente una** entrada y es una IP válida. Si no, no se envía.                                          |

- **Nunca** se usa la primera entrada de la izquierda.
- **En Azure Container Apps el valor es `1`:** la ingress agrega la IP real al final y el `??=`
  de Next no la toca.
- Con `HOPS=0`, un cliente directo podría falsificar su IP enviando una sola entrada. Por eso,
  si `ENVIRONMENT` no es `development` y `HOPS` es `0`, la aplicación **no arranca**.
- Leer la IP del socket con un preload de Node solo haría falta si el dashboard se expusiera sin
  ningún proxy delante, lo que no es el caso.

### Sesión

- **`src/proxy.ts`:** si no hay cookie de sesión, redirige a `/login`.
- **`(protected)/layout.tsx`:** llama a `GET /me` desde el servidor, a través del mismo
  `proxyRequest` y con las mismas cabeceras. Un 401 redirige a `/login`.
- **En el cliente:** cualquier 401 fuera del login y el logout limpia la caché de TanStack Query
  y redirige a `/login?expirada=1`.

### Secretos

- `PROXY_SHARED_SECRET` y `API_BASE_URL` son **solo del servidor**. Nunca llevan el prefijo
  `NEXT_PUBLIC_`.
- `env.ts` importa `server-only` y se valida al arrancar desde `src/instrumentation.ts`.
- La imagen Docker no contiene secretos: se inyectan al ejecutarla.

## Variables de entorno

| Variable                 | Por defecto                                             | Notas                                                                                                           |
| ------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `ENVIRONMENT`            | `development` solo con `next dev`                       | Fuera de `development` son obligatorias `API_BASE_URL` y `PROXY_SHARED_SECRET`, y `WEB_TRUSTED_PROXY_HOPS ≥ 1`. |
| `API_BASE_URL`           | `http://localhost:8000` (solo en desarrollo)            | Sin `/api/v1`.                                                                                                  |
| `PROXY_SHARED_SECRET`    | `dev-proxy-secret-solo-para-local` (solo en desarrollo) | Igual al de la API.                                                                                             |
| `SESSION_COOKIE_NAME`    | `pqrs_session`                                          |                                                                                                                 |
| `WEB_TRUSTED_PROXY_HOPS` | `0`                                                     | `1` en Azure.                                                                                                   |

## Clasificar

- **Motor:** `useEngineSelection` preselecciona una sola vez (el LLM si está disponible; si no,
  el clasificador). Después solo cambia por acción del usuario. Toda petición lleva `model`.
- **Lote:**
  - `src/lib/batch/batch-machine.ts` tiene un reducer puro y un runner con dependencias
    inyectadas, probados sin React;
  - `use-batch-runner.ts` lo conecta a React con `useSyncExternalStore`;
  - el texto del CSV vive solo en memoria: ni `localStorage` ni logs.
- **CSV:**
  - entrada (`csv-parse.ts`): UTF-8 estricto, separador `,` o `;` y encabezados normalizados;
  - salida (`csv-export.ts`): BOM, separador `;` y neutralización de fórmulas.

## Tipos de la API

`openapi/openapi.json` es una copia del spec de `pqrs-api`. Cuando la API cambie:

1. Copia el nuevo `openapi.json` desde `pqrs-api` a `openapi/openapi.json`, tal cual.
2. Ejecuta `pnpm gen:api`, que regenera `src/lib/api/schema.d.ts`.
3. Haz commit de los dos archivos.

La CI ejecuta `pnpm check:api` y falla si `schema.d.ts` no corresponde al spec.

## Pruebas

- Vitest con jsdom, Testing Library y MSW 3 (`onUnhandledFrame: "error"`). Las pruebas del
  proxy usan el entorno `node` y simulan la API en `http://api.test`.
- El cliente de jsdom habla con `http://localhost:3000/api/proxy`.
