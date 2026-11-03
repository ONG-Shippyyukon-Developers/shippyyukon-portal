import { createServer, type IncomingMessage } from "node:http";
import { handler as healthHandler } from "./handlers/health";
import { handler as listConsejeros } from "./handlers/consejeros/list";
import { handler as createConsejero } from "./handlers/consejeros/create";
import { handler as approveConsejero } from "./handlers/consejeros/approve";
import { createHttpHandler } from "./http/adapter";

const handle = createHttpHandler({
  health: async () => healthHandler(),
  listConsejeros,
  createConsejero,
  approveConsejero,
});

async function readBody(request: IncomingMessage): Promise<Buffer | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) headers.set(name, value.join(", "));
      else if (value !== undefined) headers.set(name, value);
    }

    const host = headers.get("host") ?? "localhost";
    const url = new URL(incoming.url ?? "/", `http://${host}`);
    const body = await readBody(incoming);
    const request = new Request(url, {
      method: incoming.method ?? "GET",
      headers,
      body,
    });

    const response = await handle(request);
    outgoing.writeHead(
      response.status,
      Object.fromEntries(response.headers.entries())
    );
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    // Do not leak stack traces, database errors, or environment configuration.
    outgoing.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    outgoing.end(JSON.stringify({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
    }));
  }
});

/**
 * Vercel Services Node.js entrypoint.
 * Vercel owns the HTTP listener; do not call listen() during deployment.
 */
export default server;
