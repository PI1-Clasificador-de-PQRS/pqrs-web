/**
 * Modo del E2E:
 * - `mock` (por defecto, CI): API simulada de `e2e/mock-api/` con estado en memoria.
 * - `real` (`E2E_TARGET=real`): el `docker compose` de pqrs-api, con un usuario creado por la
 *   CLI. Las credenciales llegan por variables de entorno, nunca en el código.
 */
export const target = process.env.E2E_TARGET === "real" ? "real" : "mock";
export const isMock = target === "mock";

export const MOCK_API_PORT = Number(process.env.MOCK_API_PORT ?? 4010);
export const MOCK_API_URL = `http://127.0.0.1:${MOCK_API_PORT}`;
export const MOCK_PROXY_SECRET = "e2e-proxy-secret";
const MOCK_PASSWORD = "clave-de-prueba-e2e";

export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100);
export const WEB_URL = `http://localhost:${WEB_PORT}`;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Con E2E_TARGET=real falta la variable ${name}.`);
  return value;
}

export function credentials() {
  if (isMock) {
    return {
      email: "e2e@ejemplo.gov.co",
      password: process.env.E2E_PASSWORD ?? MOCK_PASSWORD,
      organization: "Alcaldía de Prueba E2E",
    };
  }
  return {
    email: required("E2E_EMAIL"),
    password: required("E2E_PASSWORD"),
    organization: required("E2E_ORG_NAME"),
  };
}
