import { randomBytes, randomUUID } from "node:crypto";
import type { components } from "../../src/lib/api/schema";

/** Estado en memoria de la API simulada. Se reinicia con `POST /__test/reset`. */

export type Schemas = components["schemas"];
export type Category = Schemas["Category"];
export type Engine = Schemas["Engine"];
export type Source = Schemas["Source"];

export const CATEGORIES: readonly Category[] = [
  "Petición",
  "Reclamo",
  "Denuncia",
  "Solicitud de información",
];
export const ENGINES: readonly Engine[] = ["llm", "classifier"];
export const SOURCES: readonly Source[] = ["ui", "ui_batch", "api"];

export const MODEL_VERSIONS: Record<Engine, string> = {
  llm: "mock-llm-2026-10",
  classifier: "mock-clf-1.0",
};

export type StoredClassification = Schemas["ClassificationOut"] & {
  organizationId: string;
  /** Orden de inserción, para desempatar `created_at` iguales. */
  seq: number;
};

type User = { id: string; email: string; name: string; password: string; organizationId: string };
type Session = { userId: string; expired: boolean };

export const E2E_ORGANIZATION = { id: randomUUID(), name: "Alcaldía de Prueba E2E" };
export const OTHER_ORGANIZATION = { id: randomUUID(), name: "Otra organización" };

export function createStore(password: string) {
  const users: User[] = [
    {
      id: randomUUID(),
      email: "e2e@ejemplo.gov.co",
      name: "Persona de Prueba",
      password,
      organizationId: E2E_ORGANIZATION.id,
    },
  ];
  const organizations = [E2E_ORGANIZATION, OTHER_ORGANIZATION];
  let sessions = new Map<string, Session>();
  let classifications: StoredClassification[] = [];
  let seq = 0;
  let models: Schemas["ModelInfo"][] = defaultModels();

  return {
    findUser(email: string, password: string): User | undefined {
      return users.find(
        (user) => user.email === email.trim().toLowerCase() && user.password === password,
      );
    },
    userById(id: string) {
      return users.find((user) => user.id === id);
    },
    organization(id: string) {
      return organizations.find((organization) => organization.id === id)!;
    },
    createSession(userId: string): string {
      const token = randomBytes(24).toString("base64url");
      sessions.set(token, { userId, expired: false });
      return token;
    },
    session(token: string | undefined): Session | undefined {
      return token ? sessions.get(token) : undefined;
    },
    deleteSession(token: string | undefined) {
      if (token) sessions.delete(token);
    },
    expireSessions() {
      for (const session of sessions.values()) session.expired = true;
    },
    models() {
      return models;
    },
    setModels(next: Schemas["ModelInfo"][]) {
      models = next;
    },
    add(item: Omit<StoredClassification, "seq">): StoredClassification {
      const stored = { ...item, seq: seq++ };
      classifications.push(stored);
      return stored;
    },
    classifications(organizationId: string): StoredClassification[] {
      return classifications.filter((item) => item.organizationId === organizationId);
    },
    reset() {
      sessions = new Map();
      classifications = [];
      seq = 0;
      models = defaultModels();
    },
  };
}

export type Store = ReturnType<typeof createStore>;

/** Por defecto: el LLM sin configurar y el clasificador disponible. */
export function defaultModels(): Schemas["ModelInfo"][] {
  return [
    {
      id: "llm",
      label: "LLM (zero-shot)",
      available: false,
      reason: "not_configured",
      retry_after: null,
      evaluation: { f1_macro: null },
    },
    {
      id: "classifier",
      label: "Clasificador local",
      available: true,
      reason: null,
      retry_after: null,
      evaluation: { f1_macro: 0.78 },
    },
  ];
}

/** Clasificación determinista por palabras clave (suficiente para las pruebas). */
export function classifyText(text: string): Category {
  const value = text.toLowerCase();
  if (/denunci|soborno|corrupci/.test(value)) return "Denuncia";
  if (/reclamo|queja|no funciona|mal servicio|da[ñn]ad/.test(value)) return "Reclamo";
  if (/c[oó]mo|horario|requisito|informaci[oó]n|cu[aá]l/.test(value)) {
    return "Solicitud de información";
  }
  return "Petición";
}

/** Anonimización mínima: correos y números largos. */
export function anonymize(text: string): string {
  return text.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[CORREO]").replace(/\d{6,}/g, "[NÚMERO]");
}
