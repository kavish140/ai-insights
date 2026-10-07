import { useState } from "react";
import { uploadImage, type Media } from "@/lib/admin";
export function MediaTools({
  image,
  run,
}: {
  image: Media;
  run: (action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [dimensions, setDimensions] = useState(
    image.width && image.height ? `${image.width} × ${image.height}` : "Dimensions not recorded",
  );
  async function load() {
    const response = await fetch(image.url);
    if (!response.ok) throw new Error("Could not load the original image.");
    const bitmap = await createImageBitmap(await response.blob());
    setDimensions(`${bitmap.width} × ${bitmap.height}`);
    return bitmap;
  }
  async function compress() {
    const bitmap = await load();
    try {
      const factor = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * factor));
      canvas.height = Math.max(1, Math.round(bitmap.height * factor));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser cannot convert this image.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("WebP conversion failed."))),
          "image/webp",
          0.82,
        ),
      );
      if (blob.type !== "image/webp" || blob.size >= image.byte_size)
        throw new Error("A smaller WebP could not be produced. The original is already efficient.");
      await uploadImage(new File([blob], "optimized.webp", { type: "image/webp" }), {
        alt: image.alt,
        source_url: image.source_url,
        credit: image.credit,
        license_note: image.license_note,
      });
    } finally {
      bitmap.close();
    }
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {dimensions} · {image.mime_type === "image/webp" ? "WebP" : "Not WebP"}
        {image.byte_size > 512 * 1024 && " · Large image"}
      </p>
      <div className="flex flex-wrap gap-2">
        {!(image.width && image.height) && (
          <button
            className="rounded-lg border border-border px-3 py-2 text-xs"
            onClick={() =>
              void run(async () => {
                const bitmap = await load();
                bitmap.close();
              }, "Image dimensions inspected.")
            }
          >
            Inspect dimensions
          </button>
        )}
        <button
          className="rounded-lg border border-border px-3 py-2 text-xs"
          onClick={() =>
            void run(
              compress,
              "Smaller WebP copy added. Select it in the article editor to replace the featured image; the original is preserved.",
            )
          }
        >
          Create smaller WebP copy
        </button>
      </div>
    </div>
  );
}
