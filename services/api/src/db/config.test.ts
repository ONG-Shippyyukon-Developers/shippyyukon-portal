import { describe, expect, it } from "vitest";
import { databasePoolConfig } from "./config";

describe("databasePoolConfig", () => {
  it("requires a server-side DATABASE_URL", () => {
    expect(() => databasePoolConfig({})).toThrow("DATABASE_URL is required");
  });

  it("uses a bounded pool and validates TLS by default", () => {
    const config = databasePoolConfig({
      DATABASE_URL: "postgresql://app:secret@example.neon.tech/app?sslmode=require",
    });

    expect(config.connectionString).toContain("example.neon.tech");
    expect(config.max).toBeLessThanOrEqual(5);
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("rejects unsafe or unbounded pool sizes", () => {
    expect(() =>
      databasePoolConfig({
        DATABASE_URL: "postgresql://app:secret@example.neon.tech/app",
        DB_POOL_MAX: "0",
      })
    ).toThrow("DB_POOL_MAX must be an integer between 1 and 5");
  });

  it("does not permit TLS verification to be disabled", () => {
    const config = databasePoolConfig({
      DATABASE_URL: "postgresql://app:secret@example.neon.tech/app",
      DB_SSL: "false",
    });

    expect(config.ssl).toEqual({ rejectUnauthorized: true });
  });
});
