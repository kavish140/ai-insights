import { createServerFn } from "@tanstack/react-start";

export const listPublishedPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { publishedPosts } = await import("./supabase.server");
  return publishedPosts();
});

export const getPublicConfiguration = createServerFn({ method: "GET" }).handler(async () => {
  const { publicConfiguration } = await import("./supabase.server");
  return publicConfiguration();
});
