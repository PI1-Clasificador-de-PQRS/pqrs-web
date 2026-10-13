import "server-only";

import { EnvError, getEnv } from "@/lib/server/env";

/**
 * Valida el entorno al arrancar. Next solo registra el fallo de `register()` y sigue escuchando,
 * así que aquí se termina el proceso para que el orquestador vea que el contenedor no arrancó.
 */
export function validateEnvOrExit() {
  try {
    getEnv();
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    console.error(error.message);
    process.exit(1);
  }
}
