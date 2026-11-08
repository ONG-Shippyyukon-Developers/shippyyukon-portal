import { describe, expect, it } from "vitest";
import { handleHealth } from "./health";

describe("health HTTP handler", () => {
  it("uses the runtime-independent HTTP contract", async () => {
    const response = await handleHealth({
      headers: { "x-request-id": "health-test" },
      query: {},
      params: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(response.body)).toMatchObject({
      ok: true,
      data: {
        status: "ok",
        service: "shippiyyukon-api",
      },
    });
  });
});
