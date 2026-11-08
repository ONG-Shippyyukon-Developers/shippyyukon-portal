import { createApiRouter } from "./router";
import { handleApprove } from "../src/handlers/consejeros/approve-handler";
import { handleCreate } from "../src/handlers/consejeros/create-handler";
import { handleList } from "../src/handlers/consejeros/list-handler";
import { authenticateRequest } from "../src/middleware/auth";

const handleApiRequest = createApiRouter({
  authenticate: authenticateRequest,
  listConsejeros: handleList,
  createConsejero: handleCreate,
  approveConsejero: handleApprove,
});

export default {
  fetch: handleApiRequest,
};
