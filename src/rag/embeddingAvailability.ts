let embeddingsUnavailableUntil = 0;

function nowMs(): number {
  return Date.now();
}

export function markEmbeddingsUnavailable(cooldownMs: number): void {
  if (cooldownMs <= 0) {
    return;
  }

  embeddingsUnavailableUntil = Math.max(embeddingsUnavailableUntil, nowMs() + cooldownMs);
}

export function areEmbeddingsTemporarilyUnavailable(): boolean {
  return embeddingsUnavailableUntil > nowMs();
}

export function getEmbeddingCooldownRemainingMs(): number {
  return Math.max(0, embeddingsUnavailableUntil - nowMs());
}

export function resetEmbeddingAvailabilityState(): void {
  embeddingsUnavailableUntil = 0;
}
