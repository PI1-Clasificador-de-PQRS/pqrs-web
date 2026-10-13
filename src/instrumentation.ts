/** Se ejecuta una vez al arrancar el servidor: sin una configuración válida, no arranca. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/lib/server/env");
    getEnv();
  }
}
