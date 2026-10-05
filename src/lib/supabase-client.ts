import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicConfiguration } from "./post-functions";

let client: Promise<SupabaseClient> | undefined;
export function browserClient() {
  if (typeof window === "undefined") throw new Error("The auth client is browser-only.");
  client ??= getPublicConfiguration()
    .then(({ url, key }) => createClient(url, key))
    .catch((error) => {
      client = undefined;
      throw error;
    });
  return client;
}
