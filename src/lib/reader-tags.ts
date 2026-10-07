export function normalizeTags(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

export function parseTags(value: string): string[] {
  const tags = normalizeTags(value.split(","));
  if (tags.length > 12 || tags.some((tag) => tag.length > 40))
    throw new Error("Use up to 12 tags per field, with at most 40 characters each.");
  return tags;
}
