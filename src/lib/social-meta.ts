import { SITE } from "./posts";

export const DEFAULT_SOCIAL_IMAGE = `${SITE.url}/images/og-cover.jpg`;

export function socialMeta({
  title,
  description,
  path,
  image = DEFAULT_SOCIAL_IMAGE,
  imageAlt = "Abstract blue network illustration for AI Insights",
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string | undefined;
  type?: "website" | "article";
}) {
  const imageType = image.endsWith(".png")
    ? "image/png"
    : image.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  return [
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: `${SITE.url}${path}` },
    { property: "og:image", content: image },
    { property: "og:image:secure_url", content: image },
    { property: "og:image:type", content: imageType },
    { property: "og:image:alt", content: imageAlt },
    ...(image === DEFAULT_SOCIAL_IMAGE
      ? [
          { property: "og:image:width", content: "1200" },
          { property: "og:image:height", content: "640" },
        ]
      : []),
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: imageAlt },
  ];
}
