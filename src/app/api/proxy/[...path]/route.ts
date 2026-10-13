import { proxyRequest } from "@/lib/server/bff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

async function handler(request: Request, context: Context): Promise<Response> {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

// Se exportan todos los métodos para que cualquiera fuera de la lista blanca responda 404
// (y no el 405 automático de Next).
export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
  handler as OPTIONS,
};
