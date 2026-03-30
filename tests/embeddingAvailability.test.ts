import { describe, expect, it, vi } from "vitest";

import {
  areEmbeddingsTemporarilyUnavailable,
  markEmbeddingsUnavailable,
  resetEmbeddingAvailabilityState,
} from "../src/rag/embeddingAvailability.js";

describe("embedding availability cooldown", () => {
  it("marks embeddings unavailable during cooldown and restores availability after timeout", () => {
    vi.useFakeTimers();
    resetEmbeddingAvailabilityState();

    markEmbeddingsUnavailable(2_000);
    expect(areEmbeddingsTemporarilyUnavailable()).toBe(true);

    vi.advanceTimersByTime(2_100);
    expect(areEmbeddingsTemporarilyUnavailable()).toBe(false);

    vi.useRealTimers();
  });
});
