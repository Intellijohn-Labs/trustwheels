"use client";

import { supabase } from "./supabase";
import { compressImage, readDocumentFile } from "./image";

/*
 * Vehicle photos and documents are captured as a File in the browser, then handed to one of
 * these two functions, which upload it to the `vehicle-media` Supabase Storage bucket and
 * return its public URL - that URL is the only thing callers save onto the vehicle/document
 * record, never the raw file or a data URL. If Supabase isn't configured (or the upload
 * fails), the previous behaviour - a local data URL, held only in this browser's storage -
 * is used instead, so capture keeps working either way.
 */

const BUCKET = "vehicle-media";

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

function objectPath(folder: "photos" | "documents", file: File) {
  const dot = file.name.lastIndexOf(".");
  const ext = dot > -1 ? file.name.slice(dot) : "";
  return `${folder}/${crypto.randomUUID()}${ext}`;
}

async function uploadToBucket(path: string, blob: Blob, contentType: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType, upsert: true });
    if (error) return null;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

/**
 * A vehicle photo (intake gallery, recon job-card): compressed, then uploaded to the bucket.
 * `onPreview`, if given, fires as soon as the (fast, local) compression is done - callers can
 * show that right away instead of waiting on the (slower) network upload before updating the UI.
 * It's the same data URL used as the fallback return value, so it's always a valid, persistable
 * result even if the caller never gets a second update.
 */
export async function uploadVehiclePhoto(file: File, onPreview?: (dataUrl: string) => void): Promise<string> {
  const dataUrl = await compressImage(file);
  onPreview?.(dataUrl);
  const uploaded = await uploadToBucket(objectPath("photos", file), await dataUrlToBlob(dataUrl), "image/jpeg");
  return uploaded ?? dataUrl;
}

/** A vehicle document (PDF or a photo of a paper document): read, then uploaded to the bucket. */
export async function uploadVehicleDocument(file: File): Promise<string> {
  const dataUrl = await readDocumentFile(file);
  const uploaded = await uploadToBucket(objectPath("documents", file), await dataUrlToBlob(dataUrl), file.type || "application/octet-stream");
  return uploaded ?? dataUrl;
}
