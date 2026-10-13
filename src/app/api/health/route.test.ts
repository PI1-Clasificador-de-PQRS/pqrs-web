// @vitest-environment node
import { http, HttpResponse } from "msw";
import { GET } from "@/app/api/health/route";
import { config } from "@/proxy";
import { API, server } from "@/test/msw/server";

describe("GET /api/health", () => {
  it("responde 200 {status: ok} sin llamar a la API", async () => {
    let apiCalls = 0;
    server.use(
      http.all(`${API}/*`, () => {
        apiCalls += 1;
        return HttpResponse.json({});
      }),
    );

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
    expect(apiCalls).toBe(0);
  });

  it("queda fuera del matcher de src/proxy.ts (no exige sesión)", () => {
    const matchers = config.matcher.map((pattern) => new RegExp(`^${pattern}$`));
    const matches = (path: string) => matchers.some((matcher) => matcher.test(path));

    expect(matches("/api/health")).toBe(false);
    expect(matches("/historial")).toBe(true);
  });
});
