import { normalizeTags } from "./reader-tags";

export type ReaderPreferences = { topics: string[]; audiences: string[] };
export type ReaderTag = { kind: "topic" | "audience"; name: string };
export type TagAlias = { kind: "topic" | "audience"; alias: string; name: string };
export const emptyPreferences: ReaderPreferences = { topics: [], audiences: [] };
export const preferenceKey = "ai-reading-interests-v1";

export function readPreferences(value: string | null): ReaderPreferences {
  try {
    const input = JSON.parse(value ?? "null");
    const clean = (items: unknown) =>
      Array.isArray(items)
        ? normalizeTags(
            items.filter((item): item is string => typeof item === "string" && item.length <= 40),
          ).slice(0, 12)
        : [];
    return { topics: clean(input?.topics), audiences: clean(input?.audiences) };
  } catch {
    return { topics: [], audiences: [] };
  }
}

export function resolvePreferences(
  input: ReaderPreferences,
  aliases: TagAlias[],
): ReaderPreferences {
  const resolve = (kind: TagAlias["kind"], names: string[]) =>
    normalizeTags(
      names.map(
        (name) =>
          aliases.find((alias) => alias.kind === kind && alias.alias === name)?.name ?? name,
      ),
    );
  return {
    topics: resolve("topic", input.topics),
    audiences: resolve("audience", input.audiences),
  };
}

export function completionEstimate(visibleSeconds: number, scroll: number) {
  return visibleSeconds >= 30 && scroll >= 90;
}

export function rate(numerator: number, denominator: number): string {
  return denominator ? `${Math.round((numerator / denominator) * 100)}%` : "—";
}
