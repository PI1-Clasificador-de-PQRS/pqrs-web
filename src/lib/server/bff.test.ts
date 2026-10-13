// @vitest-environment node
import { http, HttpResponse } from "msw";
import { proxyRequest } from "@/lib/server/bff";
import type { ServerEnv } from "@/lib/server/env";
import { API, server } from "@/test/msw/server";

const env: ServerEnv = {
  environment: "development",
  apiBaseUrl: API,
  proxySharedSecret: "test-secret",
  sessionCookieName: "pqrs_session",
  trustedProxyHops: 1,
};

const DASHBOARD = "http://dashboard.test";

/** Cabeceras que pone el navegador en una petición legítima que modifica datos. */
const sameOrigin = {
  host: "dashboard.test",
  origin: DASHBOARD,
  "x-requested-with": "pqrs-web",
  "content-type": "application/json",
};

function browserRequest(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
) {
  return new Request(`${DASHBOARD}/api/proxy/${path}`, {
    method: init.method ?? "GET",
    headers: init.headers,
    body: init.body,
  });
}

function segments(path: string) {
  return path.split("?")[0]!.split("/");
}

/** Registra un handler de la API y devuelve la última petición que recibió. */
function captureApi(
  method: "get" | "post",
  path: string,
  respond: () => Response = () => HttpResponse.json({ ok: true }),
) {
  const seen: { request?: Request } = {};
  server.use(
    http[method](`${API}/api/v1/${path}`, ({ request }) => {
      seen.request = request.clone();
      return respond();
    }),
  );
  return seen;
}

describe("proxy BFF: cabeceras hacia la API", () => {
  it("elimina X-API-Key, X-PQRS-* del navegador, Authorization, X-Forwarded-* y cookies ajenas", async () => {
    const seen = captureApi("get", "me");
    const response = await proxyRequest(
      browserRequest("me", {
        headers: {
          "x-api-key": "pqrs_robada",
          "x-pqrs-proxy-secret": "inventado",
          "x-pqrs-client-ip": "6.6.6.6",
          "x-pqrs-csrf": "1",
          authorization: "Bearer abc",
          "x-forwarded-host": "evil.test",
          "x-forwarded-for": "203.0.113.7",
          cookie: "otra=1; pqrs_session=sesion-valida; _ga=xyz",
        },
      }),
      ["me"],
      env,
    );

    expect(response.status).toBe(200);
    const headers = seen.request!.headers;
    expect(headers.get("x-api-key")).toBeNull();
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("x-forwarded-host")).toBeNull();
    expect(headers.get("x-forwarded-for")).toBeNull();
    expect(headers.get("x-pqrs-csrf")).toBeNull();
    expect(headers.get("x-pqrs-proxy-secret")).toBe("test-secret");
    expect(headers.get("x-pqrs-client-ip")).toBe("203.0.113.7");
    expect(headers.get("cookie")).toBe("pqrs_session=sesion-valida");
  });

  it("siempre añade el secreto, aunque no haya cookie", async () => {
    const seen = captureApi("get", "models", () => HttpResponse.json([]));
    await proxyRequest(browserRequest("models"), ["models"], env);
    expect(seen.request!.headers.get("x-pqrs-proxy-secret")).toBe("test-secret");
    expect(seen.request!.headers.get("cookie")).toBeNull();
  });

  describe("X-PQRS-Client-IP", () => {
    async function ipSent(forwardedFor: string | undefined, hops: number) {
      const seen = captureApi("get", "me");
      await proxyRequest(
        browserRequest("me", {
          headers: forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor },
        }),
        ["me"],
        { ...env, trustedProxyHops: hops },
      );
      return seen.request!.headers.get("x-pqrs-client-ip");
    }

    it("HOPS=1 con entradas falsificadas a la izquierda usa la de más a la derecha", async () => {
      expect(await ipSent("1.2.3.4, 6.6.6.6, 198.51.100.20", 1)).toBe("198.51.100.20");
    });

    it("HOPS=2 toma la segunda desde la derecha", async () => {
      expect(await ipSent("1.2.3.4, 198.51.100.20, 10.0.0.1", 2)).toBe("198.51.100.20");
    });

    it("HOPS=0 con una sola entrada válida la envía", async () => {
      expect(await ipSent("::1", 0)).toBe("::1");
    });

    it("HOPS=0 con varias entradas no la envía", async () => {
      expect(await ipSent("6.6.6.6, 127.0.0.1", 0)).toBeNull();
    });

    it("HOPS=0 con una entrada inválida o sin cabecera no la envía", async () => {
      expect(await ipSent("no-es-ip", 0)).toBeNull();
      expect(await ipSent(undefined, 0)).toBeNull();
    });

    it("con menos entradas que HOPS no la envía", async () => {
      expect(await ipSent("198.51.100.20", 2)).toBeNull();
    });
  });

  describe("X-PQRS-CSRF", () => {
    it("se añade en un POST de clasificación que pasó la verificación", async () => {
      const seen = captureApi("post", "classify");
      await proxyRequest(
        browserRequest("classify", { method: "POST", headers: sameOrigin, body: '{"text":"x"}' }),
        ["classify"],
        env,
      );
      expect(seen.request!.headers.get("x-pqrs-csrf")).toBe("1");
      expect(await seen.request!.text()).toBe('{"text":"x"}');
    });

    it("se añade en el logout", async () => {
      const seen = captureApi("post", "auth/logout", () => new HttpResponse(null, { status: 204 }));
      const response = await proxyRequest(
        browserRequest("auth/logout", { method: "POST", headers: sameOrigin }),
        ["auth", "logout"],
        env,
      );
      expect(response.status).toBe(204);
      expect(seen.request!.headers.get("x-pqrs-csrf")).toBe("1");
    });

    it("no se añade en el login", async () => {
      const seen = captureApi("post", "auth/login");
      await proxyRequest(
        browserRequest("auth/login", { method: "POST", headers: sameOrigin, body: "{}" }),
        ["auth", "login"],
        env,
      );
      expect(seen.request!.headers.get("x-pqrs-csrf")).toBeNull();
      expect(seen.request!.headers.get("x-pqrs-proxy-secret")).toBe("test-secret");
    });

    it("no se añade en un GET y el query string se reenvía", async () => {
      let url = "";
      server.use(
        http.get(`${API}/api/v1/classifications`, ({ request }) => {
          url = request.url;
          return HttpResponse.json({ items: [] });
        }),
      );
      const seen = captureApi("get", "me");
      await proxyRequest(browserRequest("me"), ["me"], env);
      expect(seen.request!.headers.get("x-pqrs-csrf")).toBeNull();
      await proxyRequest(
        browserRequest("classifications?page=2&category=Reclamo"),
        segments("classifications"),
        env,
      );
      expect(url).toBe(`${API}/api/v1/classifications?page=2&category=Reclamo`);
    });
  });

  describe("verificación CSRF del navegador", () => {
    it.each([
      ["sin X-Requested-With", { host: "dashboard.test", origin: DASHBOARD }],
      ["con Origin ajeno", { ...sameOrigin, origin: "http://evil.test" }],
      [
        "con Origin ajeno aunque diga same-origin",
        { ...sameOrigin, origin: "http://evil.test", "sec-fetch-site": "same-origin" },
      ],
      ["sin Origin ni Sec-Fetch-Site", { host: "dashboard.test", "x-requested-with": "pqrs-web" }],
      [
        "sin Origin y con Sec-Fetch-Site cross-site",
        { host: "dashboard.test", "x-requested-with": "pqrs-web", "sec-fetch-site": "cross-site" },
      ],
    ])("rechaza con 403 un POST %s", async (_name, headers) => {
      // Sin handler de MSW: si la petición llegara a la API, la prueba fallaría.
      const response = await proxyRequest(
        browserRequest("classify", { method: "POST", headers, body: "{}" }),
        ["classify"],
        env,
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        detail: { code: "csrf_required", message: expect.any(String) },
      });
    });

    it("también protege el login", async () => {
      const response = await proxyRequest(
        browserRequest("auth/login", {
          method: "POST",
          headers: {
            host: "dashboard.test",
            origin: "http://evil.test",
            "x-requested-with": "pqrs-web",
          },
          body: "{}",
        }),
        ["auth", "login"],
        env,
      );
      expect(response.status).toBe(403);
    });

    it("acepta Sec-Fetch-Site: same-origin sin Origin", async () => {
      captureApi("post", "classify");
      const response = await proxyRequest(
        browserRequest("classify", {
          method: "POST",
          headers: { "x-requested-with": "pqrs-web", "sec-fetch-site": "same-origin" },
          body: "{}",
        }),
        ["classify"],
        env,
      );
      expect(response.status).toBe(200);
    });
  });

  describe("lista blanca", () => {
    it.each([
      ["GET", "health"],
      ["GET", "auth/login"],
      ["DELETE", "classifications/0b9d6c58-4d6f-4f7e-9d8e-3c1d2e0f9a11"],
      ["GET", "classifications/no-es-uuid"],
      ["GET", "classifications/../me"],
      ["PUT", "me"],
      ["HEAD", "me"],
      ["GET", "me/extra"],
      ["POST", "admin/users"],
    ])("%s %s responde 404", async (method, path) => {
      const response = await proxyRequest(
        browserRequest(path.replace("../", ""), { method, headers: sameOrigin }),
        path.split("/"),
        env,
      );
      expect(response.status).toBe(404);
      if (method !== "HEAD") {
        expect(await response.json()).toMatchObject({ detail: { code: "not_found" } });
      }
    });

    it("acepta classifications/{uuid}", async () => {
      const id = "0b9d6c58-4d6f-4f7e-9d8e-3c1d2e0f9a11";
      captureApi("get", `classifications/${id}`);
      const response = await proxyRequest(
        browserRequest(`classifications/${id}`),
        ["classifications", id],
        env,
      );
      expect(response.status).toBe(200);
    });
  });

  describe("respuesta al navegador", () => {
    it("reenvía cada Set-Cookie con sus atributos y no otras cabeceras internas", async () => {
      server.use(
        http.post(`${API}/api/v1/auth/login`, () => {
          const headers = new Headers({ "x-request-id": "interno", server: "uvicorn" });
          headers.append("set-cookie", "pqrs_session=abc; HttpOnly; Path=/; SameSite=Lax");
          headers.append("set-cookie", "otra=1; Path=/");
          return HttpResponse.json({ user: {}, organization: {} }, { headers });
        }),
      );
      const response = await proxyRequest(
        browserRequest("auth/login", { method: "POST", headers: sameOrigin, body: "{}" }),
        ["auth", "login"],
        env,
      );
      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie()).toEqual([
        "pqrs_session=abc; HttpOnly; Path=/; SameSite=Lax",
        "otra=1; Path=/",
      ]);
      expect(response.headers.get("x-request-id")).toBeNull();
      expect(response.headers.get("server")).toBeNull();
    });

    it("reenvía Retry-After y copia el status y el cuerpo sin cambios", async () => {
      const body = { detail: { code: "rate_limited", message: "Espera." } };
      server.use(
        http.post(`${API}/api/v1/classify/batch`, () =>
          HttpResponse.json(body, { status: 429, headers: { "retry-after": "17" } }),
        ),
      );
      const response = await proxyRequest(
        browserRequest("classify/batch", { method: "POST", headers: sameOrigin, body: "{}" }),
        ["classify", "batch"],
        env,
      );
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("17");
      expect(await response.json()).toEqual(body);
    });

    it("con la API caída responde 502 api_unreachable", async () => {
      server.use(http.get(`${API}/api/v1/me`, () => HttpResponse.error()));
      const response = await proxyRequest(browserRequest("me"), ["me"], env);
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        detail: { code: "api_unreachable", message: expect.any(String) },
      });
    });

    it("rechaza un cuerpo de más de 2 MiB sin llamar a la API", async () => {
      const response = await proxyRequest(
        browserRequest("classify/batch", {
          method: "POST",
          headers: sameOrigin,
          body: "x".repeat(2 * 1024 * 1024 + 1),
        }),
        ["classify", "batch"],
        env,
      );
      expect(response.status).toBe(413);
    });
  });
});
