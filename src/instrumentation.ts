/** Se ejecuta una vez al arrancar el servidor: sin una configuración válida, no arranca. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnvOrExit } = await import("@/lib/server/validate-env");
    validateEnvOrExit();
  }
}
