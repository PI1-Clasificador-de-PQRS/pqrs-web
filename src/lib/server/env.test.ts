import { EnvError, parseEnv } from "@/lib/server/env";

const deployed = {
  ENVIRONMENT: "production",
  API_BASE_URL: "https://api.example.org/",
  PROXY_SHARED_SECRET: "s3cr3t",
  WEB_TRUSTED_PROXY_HOPS: "1",
};

describe("parseEnv", () => {
  it("acepta un entorno desplegado completo", () => {
    expect(parseEnv(deployed)).toEqual({
      environment: "production",
      apiBaseUrl: "https://api.example.org",
      proxySharedSecret: "s3cr3t",
      sessionCookieName: "pqrs_session",
      trustedProxyHops: 1,
    });
  });

  it("en desarrollo usa los valores locales por defecto", () => {
    expect(parseEnv({ ENVIRONMENT: "development" })).toMatchObject({
      apiBaseUrl: "http://localhost:8000",
      proxySharedSecret: "dev-proxy-secret-solo-para-local",
      trustedProxyHops: 0,
    });
  });

  it("con ENVIRONMENT=production y HOPS=0 falla con un mensaje claro", () => {
    expect(() => parseEnv({ ...deployed, WEB_TRUSTED_PROXY_HOPS: "0" })).toThrow(
      "En un entorno desplegado WEB_TRUSTED_PROXY_HOPS debe ser ≥ 1 (en Azure Container Apps, 1).",
    );
    expect(() => parseEnv({ ...deployed, WEB_TRUSTED_PROXY_HOPS: undefined })).toThrow(EnvError);
  });

  it("fuera de desarrollo falla si falta el secreto o la URL de la API", () => {
    expect(() => parseEnv({ ...deployed, PROXY_SHARED_SECRET: undefined })).toThrow(
      /PROXY_SHARED_SECRET/,
    );
    expect(() => parseEnv({ ...deployed, API_BASE_URL: "" })).toThrow(/API_BASE_URL/);
  });

  it("sin ENVIRONMENT solo asume desarrollo con NODE_ENV=development", () => {
    expect(parseEnv({ NODE_ENV: "development" }).environment).toBe("development");
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(/ENVIRONMENT/);
  });

  it("rechaza HOPS no numérico", () => {
    expect(() => parseEnv({ ENVIRONMENT: "development", WEB_TRUSTED_PROXY_HOPS: "-1" })).toThrow(
      /entero/,
    );
  });
});
