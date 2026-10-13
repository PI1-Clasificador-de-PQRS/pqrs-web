import { isIP } from "node:net";

/**
 * IP del navegador a partir de X-Forwarded-For, con la misma regla que la API.
 *
 * - `hops >= 1`: la entrada N contando desde la derecha (las de la izquierda las puede inventar
 *   el cliente). En Azure Container Apps, `hops = 1`: la ingress agrega la IP real al final.
 * - `hops = 0` (solo desarrollo, sin nada delante de Next): Next 16 no expone la IP del socket a
 *   un Route Handler; solo la escribe en X-Forwarded-For si el navegador no envió esa cabecera
 *   (`??=` en `next/dist/server/base-server.js`). Por eso se acepta únicamente una cabecera con
 *   exactamente una entrada; con varias no se sabe cuál es la real.
 *
 * Devuelve `undefined` si no hay una IP válida; en ese caso no se envía X-PQRS-Client-IP.
 */
export function clientIpFromForwardedFor(
  forwardedFor: string | null | undefined,
  hops: number,
): string | undefined {
  if (!forwardedFor) return undefined;
  const entries = forwardedFor.split(",").map((entry) => entry.trim());
  let candidate: string | undefined;
  if (hops === 0) {
    candidate = entries.length === 1 ? entries[0] : undefined;
  } else if (entries.length >= hops) {
    candidate = entries[entries.length - hops];
  }
  return candidate && isIP(candidate) !== 0 ? candidate : undefined;
}
