import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "menu-media";

export type MediaKind = "image" | "video_360" | "model_3d";

export const MEDIA_RULES: Record<
  MediaKind,
  { label: string; accept: string; maxBytes: number; extensions: string[] }
> = {
  image: {
    label: "Imagem",
    accept: "image/jpeg,image/png,image/webp",
    maxBytes: 8 * 1024 * 1024,
    extensions: ["jpg", "jpeg", "png", "webp"],
  },
  video_360: {
    label: "Vídeo 360°",
    accept: "video/mp4,video/webm",
    maxBytes: 50 * 1024 * 1024,
    extensions: ["mp4", "webm"],
  },
  model_3d: {
    label: "Modelo 3D",
    accept: ".glb,.gltf,model/gltf-binary,model/gltf+json",
    maxBytes: 50 * 1024 * 1024,
    extensions: ["glb", "gltf"],
  },
};

export function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function validateMediaFile(kind: MediaKind, file: File): string | null {
  const rule = MEDIA_RULES[kind];
  const ext = fileExtension(file.name);
  if (!rule.extensions.includes(ext)) {
    return `Formato inválido. Aceitos: ${rule.extensions.join(", ")}.`;
  }
  if (file.size > rule.maxBytes) {
    return `Arquivo muito grande. Máximo de ${Math.round(rule.maxBytes / (1024 * 1024))} MB.`;
  }
  return null;
}

export function buildStoragePath(establishmentId: string, folder: string, file: File): string {
  const ext = fileExtension(file.name);
  const id = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
  return `${establishmentId}/${folder}/${id}${ext ? `.${ext}` : ""}`;
}

export async function uploadToBucket(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
}

export async function removeFromBucket(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(MEDIA_BUCKET).remove(paths);
}

const SIGNED_TTL = 60 * 60;

export async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_TTL);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function storagePathFromValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) {
    return decodeURIComponent(value.slice(markerIndex + marker.length).split("?")[0]);
  }
  if (/^https?:\/\//i.test(value)) return null;
  return value.replace(/^\/+/, "");
}

export async function resolveStoredMediaUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const path = storagePathFromValue(value);
  return path ? signedUrl(path) : value;
}

export async function signedUrlMap(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(unique, SIGNED_TTL);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  data.forEach((entry) => {
    if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
  });
  return map;
}
