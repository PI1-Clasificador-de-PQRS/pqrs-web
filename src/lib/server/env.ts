import "server-only";

/**
 * Configuración del servidor. Estas variables son secretas o internas: nunca se exponen al
 * navegador (no llevan el prefijo NEXT_PUBLIC_) y solo este módulo las lee.
 */
export type ServerEnv = {
  environment: string;
  apiBaseUrl: string;
  proxySharedSecret: string;
  sessionCookieName: string;
  trustedProxyHops: number;
};

const DEV_API_BASE_URL = "http://localhost:8000";
const DEV_PROXY_SHARED_SECRET = "dev-proxy-secret-solo-para-local";

export class EnvError extends Error {
  constructor(problems: string[]) {
    super(`Configuración inválida de pqrs-web:\n- ${problems.join("\n- ")}`);
    this.name = "EnvError";
  }
}

type Source = Record<string, string | undefined>;

export function parseEnv(source: Source): ServerEnv {
  const problems: string[] = [];
  const read = (name: string) => {
    const value = source[name]?.trim();
    return value ? value : undefined;
  };

  // Sin ENVIRONMENT solo se asume desarrollo con `next dev`; así un despliegue sin configurar
  // nunca arranca con los valores por defecto de desarrollo.
  let environment = read("ENVIRONMENT");
  if (!environment) {
    if (source.NODE_ENV === "development") environment = "development";
    else problems.push("Falta ENVIRONMENT (development, staging o production).");
  }
  const isDev = environment === "development";

  let apiBaseUrl = read("API_BASE_URL") ?? (isDev ? DEV_API_BASE_URL : undefined);
  if (!apiBaseUrl) {
    problems.push("Falta API_BASE_URL (URL base de pqrs-api, sin /api/v1).");
  } else {
    try {
      const url = new URL(apiBaseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
    } catch {
      problems.push("API_BASE_URL no es una URL http(s) válida.");
    }
  }

  const proxySharedSecret =
    read("PROXY_SHARED_SECRET") ?? (isDev ? DEV_PROXY_SHARED_SECRET : undefined);
  if (!proxySharedSecret)
    problems.push("Falta PROXY_SHARED_SECRET (secreto compartido con la API).");

  const sessionCookieName = read("SESSION_COOKIE_NAME") ?? "pqrs_session";
  if (!/^[A-Za-z0-9_-]+$/.test(sessionCookieName)) {
    problems.push("SESSION_COOKIE_NAME solo admite letras, números, '_' y '-'.");
  }

  const rawHops = read("WEB_TRUSTED_PROXY_HOPS") ?? "0";
  const trustedProxyHops = /^\d+$/.test(rawHops) ? Number(rawHops) : NaN;
  if (!Number.isSafeInteger(trustedProxyHops)) {
    problems.push("WEB_TRUSTED_PROXY_HOPS debe ser un entero mayor o igual que 0.");
  } else if (environment && !isDev && trustedProxyHops === 0) {
    problems.push(
      "En un entorno desplegado WEB_TRUSTED_PROXY_HOPS debe ser ≥ 1 (en Azure Container Apps, 1).",
    );
  }

  if (problems.length > 0) throw new EnvError(problems);
  return {
    environment: environment!,
    apiBaseUrl: apiBaseUrl!,
    proxySharedSecret: proxySharedSecret!,
    sessionCookieName,
    trustedProxyHops,
  };
}

let cached: ServerEnv | undefined;

/** Lee y valida el entorno una sola vez. Lanza `EnvError` con un mensaje claro si falta algo. */
export function getEnv(): ServerEnv {
  cached ??= parseEnv(process.env);
  return cached;
}
