"use client";

import { supabase } from "./supabase";
import { compressImage } from "./image";

/*
 * Employee profile photos, uploaded the same way vehicle photos are (vehicle-media.ts): compress
 * in the browser, upload to Supabase Storage, save the public URL - falling back to the local data
 * URL if Supabase isn't configured or the upload fails, so capture keeps working either way.
 *
 * Reuses the already-provisioned `vehicle-media` bucket (already public, already has anon/
 * authenticated read+write policies - see supabase/migrations/0002_remaining_collections_and_storage.sql)
 * under its own `avatars/` prefix, rather than requiring a brand new bucket + RLS policies to be
 * provisioned before this feature works at all. The name is a pre-existing artifact, not a sign
 * this mixes with vehicle data - objects are namespaced by folder and employees are a distinct
 * table entirely.
 */

const BUCKET = "vehicle-media";

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** An employee's profile photo: compressed small (it's only ever shown as a thumbnail), then uploaded. */
export async function uploadEmployeePhoto(file: File): Promise<string> {
  const dataUrl = await compressImage(file, 480, 0.82);
  if (!supabase) return dataUrl;
  try {
    const path = `avatars/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, await dataUrlToBlob(dataUrl), { contentType: "image/jpeg", upsert: true });
    if (error) return dataUrl;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return dataUrl;
  }
}
