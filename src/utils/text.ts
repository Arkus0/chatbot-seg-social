export function normalizeWhitespace(input: string): string {
  return input.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function truncateText(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }

  return `${input.slice(0, maxLength - 3).trimEnd()}...`;
}

export function normalizeSearchText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function tokenizeSearchText(
  input: string,
  options?: {
    minLength?: number;
    stopwords?: Iterable<string>;
  },
): string[] {
  const minLength = options?.minLength ?? 3;
  const stopwords = new Set(options?.stopwords ?? []);

  return normalizeSearchText(input)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= minLength && !stopwords.has(token));
}

export function countTokenMatches(tokens: string[], haystack: string): number {
  const normalizedHaystack = normalizeSearchText(haystack);
  return tokens.filter((token) => normalizedHaystack.includes(token)).length;
}

export function dedupeBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function splitTelegramMessage(input: string, maxLength = 3900): string[] {
  if (input.length <= maxLength) {
    return [input];
  }

  const parts: string[] = [];
  let remaining = input;

  while (remaining.length > maxLength) {
    const candidate = remaining.slice(0, maxLength);
    const breakIndex = Math.max(candidate.lastIndexOf("\n\n"), candidate.lastIndexOf("\n"), candidate.lastIndexOf(" "));
    const splitIndex = breakIndex > 0 ? breakIndex : maxLength;

    parts.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}

export function extractMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object" && "text" in item) {
          return String((item as { text?: unknown }).text ?? "");
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (content == null) {
    return "";
  }

  return String(content);
}
