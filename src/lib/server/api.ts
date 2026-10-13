import "server-only";

import { headers } from "next/headers";
import type { MeResponse } from "@/lib/api/client";
import { proxyRequest } from "@/lib/server/bff";

export type MeResult =
  { kind: "ok"; me: MeResponse } | { kind: "unauthorized" } | { kind: "error" };

/**
 * Valida la sesión desde el servidor con `GET /me`. Pasa por el mismo `proxyRequest` que el
 * navegador, así que lleva exactamente las mismas cabeceras (secreto, cookie de sesión e IP).
 */
export async function fetchMe(): Promise<MeResult> {
  const incoming = await headers();
  const forwarded = new Headers({ accept: "application/json" });
  for (const name of ["cookie", "x-forwarded-for"]) {
    const value = incoming.get(name);
    if (value) forwarded.set(name, value);
  }
  const response = await proxyRequest(
    new Request("http://dashboard.internal/api/proxy/me", { headers: forwarded }),
    ["me"],
  );
  if (response.status === 401) return { kind: "unauthorized" };
  if (!response.ok) return { kind: "error" };
  return { kind: "ok", me: (await response.json()) as MeResponse };
}
