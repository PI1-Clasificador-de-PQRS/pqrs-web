import { MOCK_API_URL } from "./env.ts";

/** Rutas de control de la API simulada. Solo existen en modo `mock`. */
async function control(method: string, path: string, body?: unknown): Promise<Response> {
  const response = await fetch(`${MOCK_API_URL}/__test/${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} /__test/${path}: ${response.status}`);
  return response;
}

export type SeedItem = {
  created_at: string;
  text: string;
  category?: "Petición" | "Reclamo" | "Denuncia" | "Solicitud de información";
  model?: "llm" | "classifier";
  source?: "ui" | "ui_batch" | "api";
  batch_id?: string;
};

export const mockApi = {
  reset: () => control("POST", "reset"),
  expireSessions: () => control("POST", "expire-sessions"),
  async seed(items: SeedItem[]): Promise<{ id: string }[]> {
    return (await control("POST", "seed", { items })).json() as Promise<{ id: string }[]>;
  },
  async violations(): Promise<unknown[]> {
    return (await control("GET", "violations")).json() as Promise<unknown[]>;
  },
};
