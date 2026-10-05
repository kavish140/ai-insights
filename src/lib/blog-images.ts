const imageBase = "https://gutvbukqlqutjwlbmfpr.supabase.co/storage/v1/object/public/blog-images/";

export function isBlogImageUrl(value: string) {
  return (
    value.startsWith(imageBase) &&
    /^articles\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(value.slice(imageBase.length))
  );
}
