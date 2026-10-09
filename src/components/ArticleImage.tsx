import { useLoaderData } from "@tanstack/react-router";

export function ArticleImage({
  src,
  alt,
  featured = false,
  className = "",
}: {
  src?: string | undefined;
  alt?: string | undefined;
  featured?: boolean;
  className?: string;
}) {
  const { imageTransforms } = useLoaderData({ from: "__root__" });
  const sizes = featured
    ? "(max-width: 767px) 100vw, 768px"
    : "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 384px";
  const transformed = (width: number) =>
    src?.replace("/object/public/", "/render/image/public/") + `?width=${width}&quality=80`;
  if (!src)
    return (
      <div aria-hidden="true" className={`article-art ${className}`}>
        <span className="article-art__node">Input</span>
        <span>→</span>
        <span className="article-art__node">AI + review</span>
        <span>→</span>
        <span className="article-art__node">Result</span>
      </div>
    );
  return (
    <img
      src={src}
      alt={alt ?? ""}
      width={1200}
      height={675}
      srcSet={
        imageTransforms
          ? [400, 640, 960, 1200].map((width) => `${transformed(width)} ${width}w`).join(", ")
          : undefined
      }
      sizes={sizes}
      loading={featured ? "eager" : "lazy"}
      fetchPriority={featured ? "high" : "auto"}
      decoding="async"
      className={`aspect-video w-full object-cover ${className}`}
    />
  );
}
