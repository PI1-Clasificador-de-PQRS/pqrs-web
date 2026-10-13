// Sirve el build `standalone` igual que la imagen Docker: copia los estáticos junto a
// `server.js` y lo arranca. Las variables (API_BASE_URL, PROXY_SHARED_SECRET, …) llegan del
// `webServer` de Playwright.
import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const standalone = `${root}.next/standalone/`;
if (!existsSync(`${standalone}server.js`)) {
  console.error("No existe .next/standalone/server.js: ejecuta `pnpm build` antes.");
  process.exit(1);
}
cpSync(`${root}.next/static`, `${standalone}.next/static`, { recursive: true });
if (existsSync(`${root}public`))
  cpSync(`${root}public`, `${standalone}public`, { recursive: true });

await import(`${standalone}server.js`);
