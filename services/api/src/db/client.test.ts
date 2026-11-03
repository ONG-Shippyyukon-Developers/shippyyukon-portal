import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("database client initialization", () => {
  it("does not require DATABASE_URL merely to import the API module", async () => {
    vi.stubEnv("DATABASE_URL", "");

    await expect(import("./client")).resolves.toHaveProperty("withTenantContext");
  });
});
