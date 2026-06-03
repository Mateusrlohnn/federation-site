import { createClient } from "@/lib/supabase/client";

/** Public bucket created by supabase/schema-media.sql. */
export const MEDIA_BUCKET = "media";

/**
 * Upload an image file to the public `media` bucket and return its public URL.
 * `folder` namespaces the object (e.g. "teams", "tournaments").
 * Throws on failure so callers can surface the message.
 */
export async function uploadImage(folder: string, file: File): Promise<string> {
  const supabase = createClient();
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${crypto.randomUUID()}.${ext || "png"}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
