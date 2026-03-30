import { describe, expect, it } from "vitest";

import { isTelegramSecretValid } from "../src/services/security.js";

describe("isTelegramSecretValid", () => {
  it("accepts the correct secret", () => {
    expect(isTelegramSecretValid("abc123", "abc123")).toBe(true);
  });

  it("rejects the wrong secret", () => {
    expect(isTelegramSecretValid("abc123", "xyz789")).toBe(false);
  });
});
