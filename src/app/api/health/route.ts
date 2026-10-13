/**
 * Salud del dashboard para el `HEALTHCHECK` del contenedor. No llama a la API ni lee secretos:
 * solo dice que el servidor de Next responde.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}
