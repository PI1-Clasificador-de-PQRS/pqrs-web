import { setupServer } from "msw/node";

/** API simulada para las pruebas del proxy (lado servidor). */
export const API = "http://api.test";

/** Proxy del dashboard tal como lo ve el navegador en jsdom (origen http://localhost:3000). */
export const PROXY = "http://localhost:3000/api/proxy";

export const server = setupServer();
