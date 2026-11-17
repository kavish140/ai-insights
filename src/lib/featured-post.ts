type FeatureCandidate = {
  id?: string;
  slug: string;
  date: string;
  status: string;
  featured: boolean;
};

export function homepageCandidates<T extends FeatureCandidate>(articles: T[], today: string): T[] {
  return articles
    .filter((article) => article.id && article.status === "published" && article.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

export function currentHomepagePick<T extends FeatureCandidate>(
  articles: T[],
  today: string,
): T | undefined {
  const live = homepageCandidates(articles, today);
  return live.find((article) => article.featured) ?? live[0];
}

export function featureSelectionMatches(articles: FeatureCandidate[], selected: string): boolean {
  const flagged = articles.filter((article) => article.featured);
  return selected ? flagged.length === 1 && flagged[0]?.id === selected : flagged.length === 0;
}
