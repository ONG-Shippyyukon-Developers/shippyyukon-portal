import { handler as healthHandler } from "../src/handlers/health";
import { handler as listConsejeros } from "../src/handlers/consejeros/list";
import { handler as createConsejero } from "../src/handlers/consejeros/create";
import { handler as approveConsejero } from "../src/handlers/consejeros/approve";
import { createHttpHandler } from "../src/http/adapter";

const handle = createHttpHandler({
  health: async () => healthHandler(),
  listConsejeros,
  createConsejero,
  approveConsejero,
});

/**
 * Vercel Node.js Web Handler entrypoint for the API service.
 * The health route is public; all consejero operations retain server-side
 * authentication and authorization checks in their existing handlers.
 */
export default {
  fetch(request: Request): Promise<Response> {
    return handle(request);
  },
};
