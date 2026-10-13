# pqrs-web

Dashboard del MVP del Clasificador automático de PQRS (Proyecto Integrador I, Universidad de
Antioquia). Es una aplicación Next.js (App Router) que habla con `pqrs-api` **solo** a través de
un proxy BFF del lado del servidor: el navegador nunca maneja credenciales.

Páginas:

- **Inicio y cierre de sesión.** Tras el login se llega a Métricas.
- **Métricas** (`/metricas`): total, categoría más frecuente, porcentaje por motor, gráficos por
  categoría, por día o semana, por motor y por origen (cada uno con «Ver como tabla»), y la
  evaluación F1-macro de los motores. Período: últimos 7 o 30 días, este mes, todo el historial
  o un rango personalizado.
- **Historial** (`/historial`): tabla paginada con filtros por fechas, categoría, motor, origen y
  lote, todos en la URL. El detalle de cada clasificación está en `/historial/<id>`.
- **Clasificar:** un texto o un lote CSV de hasta 500 filas, con enlaces al detalle y al lote en
  el Historial.

Todas las fechas se calculan y se muestran en la hora de Colombia (`America/Bogota`), sin
importar la zona del navegador.

La arquitectura del proxy y sus reglas están en [AGENTS.md](AGENTS.md).

## Requisitos

- Node 24 LTS (`.nvmrc`) y pnpm 12 (`corepack enable`).
- Para desarrollo: `pqrs-api` corriendo localmente.

## Comandos

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm lint
pnpm typecheck
pnpm test           # Vitest + Testing Library + MSW
pnpm build          # salida standalone
pnpm start          # sirve el build
pnpm format         # Prettier
pnpm gen:api        # regenera src/lib/api/schema.d.ts desde openapi/openapi.json
pnpm check:api      # falla si los tipos generados no están al día (lo usa la CI)
pnpm e2e            # Playwright: build de producción contra la API simulada
pnpm mock-api       # solo la API simulada, en http://127.0.0.1:4010
```

`GET /api/health` responde `200 {"status":"ok"}` sin llamar a la API: lo usa el `HEALTHCHECK`
de la imagen.

## Variables de entorno

Copia `.env.example` a `.env.local`. Todas las variables son **solo del servidor**.

| Variable                 | Para qué                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `ENVIRONMENT`            | `development`, `staging` o `production`.                                                          |
| `API_BASE_URL`           | URL de `pqrs-api`, sin `/api/v1`. Por defecto `http://localhost:8000`.                            |
| `PROXY_SHARED_SECRET`    | Secreto compartido con la API.                                                                    |
| `SESSION_COOKIE_NAME`    | Cookie de sesión. Por defecto `pqrs_session`.                                                     |
| `WEB_TRUSTED_PROXY_HOPS` | Proxies de confianza delante del dashboard: `0` solo en desarrollo y `1` en Azure Container Apps. |

Fuera de `development`, la aplicación no arranca si faltan `API_BASE_URL` o
`PROXY_SHARED_SECRET`, o si `WEB_TRUSTED_PROXY_HOPS` es `0`.

## Entorno local con la API

1. **Levanta la API** en el repositorio `pqrs-api`:

   ```bash
   docker compose up -d
   ```

   Su `docker-compose.yml` usa el secreto `dev-proxy-secret-solo-para-local`, el mismo de
   `.env.example`, y publica la API en `http://localhost:8000`.

2. **Crea una organización y un usuario**, también desde `pqrs-api`:

   ```bash
   docker compose exec api pqrs-admin create-org "Alcaldía de ejemplo"
   # imprime el id de la organización

   docker compose exec api pqrs-admin create-user \
     --org-id <id-de-la-organizacion> \
     --email ana@ejemplo.gov.co \
     --name "Ana Pérez"
   # pide la contraseña (mínimo 12 caracteres)
   ```

   Para pasar la contraseña sin que la pida:

   ```bash
   echo 'una-clave-larga' | docker compose exec -T api pqrs-admin create-user ... --password-stdin
   ```

3. **Arranca el dashboard:**

   ```bash
   cp .env.example .env.local
   pnpm install
   pnpm dev
   ```

4. **Entra a <http://localhost:3000>** e inicia sesión con el correo y la contraseña del paso 2.

Sin `LLM_API_KEY` en la API, el motor LLM aparece deshabilitado con «No configurado» y el
clasificador queda preseleccionado.

## Formato del CSV para el lote

- UTF-8, con o sin BOM. En Excel: «Guardar como» y elegir «CSV UTF-8».
- Separador `,` o `;`: se detecta solo.
- Encabezado con una columna `texto` (obligatoria) y otra `referencia` (opcional). No importan
  las mayúsculas ni las tildes.
- Máximo 500 filas.
- Una fila con el texto vacío o de más de 5.000 caracteres, o con una referencia de más de 100
  caracteres, se marca como inválida y no se envía.

Los resultados se descargan en CSV con:

- UTF-8 con BOM y separador `;`;
- las columnas `referencia;texto;categoria;motor;estado;error`;
- las celdas que empiezan por `=`, `+`, `-`, `@`, tabulador o retorno de carro antepuestas con
  `'`, para evitar la inyección de fórmulas.

## Tipos de la API

Los tipos se generan desde `openapi/openapi.json`, una copia del spec de `pqrs-api`. Cuando la
API cambie:

1. Copia el nuevo `openapi.json` desde `pqrs-api` a `openapi/openapi.json`.
2. Ejecuta `pnpm gen:api`.
3. Haz commit de los dos archivos.

La CI falla si `src/lib/api/schema.d.ts` no está al día.

## Docker

```bash
docker build -t pqrs-web .
docker run --rm -p 3000:3000 \
  -e ENVIRONMENT=production \
  -e API_BASE_URL=https://api.ejemplo.org \
  -e PROXY_SHARED_SECRET=... \
  -e WEB_TRUSTED_PROXY_HOPS=1 \
  pqrs-web
```

La imagen usa la salida `standalone` y corre con el usuario no root `node`. No contiene
secretos: se pasan al ejecutarla.

## Pruebas de extremo a extremo (Playwright)

Las mismas especificaciones (`e2e/specs/`) corren en dos modos. En los dos, Playwright compila el
dashboard (`pnpm build`) y sirve la salida `standalone` en <http://localhost:3100> con
`ENVIRONMENT=production` y `WEB_TRUSTED_PROXY_HOPS=1`, como en un despliegue. El navegador usa a
propósito la zona `Europe/Madrid`. Para no recompilar, usa `E2E_SKIP_BUILD=1`.

La primera vez, instala el navegador:

```bash
pnpm exec playwright install chromium
```

### Con la API simulada (por defecto; lo usa la CI)

```bash
pnpm e2e
```

Playwright levanta también `e2e/mock-api/server.mts`: una API en memoria que sigue
`openapi/openapi.json` y verifica en cada petición las cabeceras del proxy. Si algo falla,
responde con el error y la prueba falla. Más detalles en [AGENTS.md](AGENTS.md#api-simulada-del-e2e).

### Contra la API real (manual)

1. Levanta `pqrs-api` (versión con `tz`) con `docker compose up -d` y crea una organización y un
   usuario con `pqrs-admin`, como en [Entorno local con la API](#entorno-local-con-la-api).
2. Ejecuta, con las credenciales de ese usuario:

   ```bash
   E2E_TARGET=real \
   E2E_EMAIL=ana@ejemplo.gov.co \
   E2E_PASSWORD='la-clave-del-paso-1' \
   E2E_ORG_NAME='Alcaldía de ejemplo' \
   pnpm e2e
   ```

   `API_BASE_URL` (por defecto `http://localhost:8000`) y `PROXY_SHARED_SECRET` (por defecto el
   de `docker-compose.yml`) se pueden cambiar con variables de entorno.

En este modo se omiten las pruebas que necesitan la API simulada: la de zona horaria, que siembra
fechas, y la de sesión expirada. Las pruebas crean clasificaciones reales en la base de datos
local.

## CI

GitHub Actions (`.github/workflows/ci.yml`):

- `pnpm install --frozen-lockfile`
- `pnpm check:api`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Un job aparte, `e2e`, instala Chromium y ejecuta `pnpm e2e` con la API simulada. Si falla, sube
el informe de Playwright como artefacto.
