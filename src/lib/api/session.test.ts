import { QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { createApiClient, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { EXPIRED_LOGIN_URL, handleUnauthorized, resetUnauthorizedState } from "@/lib/api/session";
import { PROXY, server } from "@/test/msw/server";

afterEach(() => resetUnauthorizedState());

describe("sesión en el cliente", () => {
  it.each(["session_expired", "missing_credentials", "invalid_credentials"])(
    "un 401 %s limpia la caché y redirige a /login?expirada=1",
    async (code) => {
      server.use(
        http.get(`${PROXY}/models`, () =>
          HttpResponse.json({ detail: { code, message: "x" } }, { status: 401 }),
        ),
      );
      const queryClient = new QueryClient();
      queryClient.setQueryData(["models"], [{ id: "llm" }]);
      const navigate = vi.fn();
      const client = createApiClient({
        baseUrl: PROXY,
        onUnauthorized: () => handleUnauthorized(queryClient, navigate),
      });

      await expect(unwrap(client.GET("/models"))).rejects.toMatchObject({ status: 401, code });
      expect(navigate).toHaveBeenCalledWith(EXPIRED_LOGIN_URL);
      expect(queryClient.getQueryData(["models"])).toBeUndefined();
    },
  );

  it("un 401 del login no redirige: lo maneja el formulario", async () => {
    server.use(
      http.post(`${PROXY}/auth/login`, () =>
        HttpResponse.json(
          { detail: { code: "invalid_credentials", message: "Credenciales inválidas." } },
          { status: 401 },
        ),
      ),
    );
    const onUnauthorized = vi.fn();
    const client = createApiClient({ baseUrl: PROXY, onUnauthorized });
    await expect(
      unwrap(client.POST("/auth/login", { body: { email: "a@b.co", password: "x" } })),
    ).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("toda petición lleva X-Requested-With: pqrs-web", async () => {
    let header: string | null = null;
    server.use(
      http.post(`${PROXY}/classify`, ({ request }) => {
        header = request.headers.get("x-requested-with");
        return HttpResponse.json({});
      }),
    );
    const client = createApiClient({ baseUrl: PROXY, onUnauthorized: vi.fn() });
    await client.POST("/classify", { body: { text: "hola", model: "classifier" } });
    expect(header).toBe("pqrs-web");
  });

  it("un fallo de red se convierte en ApiError network_error", async () => {
    server.use(http.get(`${PROXY}/me`, () => HttpResponse.error()));
    const client = createApiClient({ baseUrl: PROXY, onUnauthorized: vi.fn() });
    await expect(unwrap(client.GET("/me"))).rejects.toMatchObject({ code: "network_error" });
  });
});
