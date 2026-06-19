import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type { ConnectionProfileInput } from "@/features/connections/types/connection";
import { normalizeEndpoint } from "@/services/s3/validation";

interface TauriS3Profile {
  endpoint: string | null;
  region: string;
  use_ssl: boolean;
  force_path_style: boolean;
  access_key_id: string;
  secret_access_key: string;
}

interface TauriS3ObjectInfo {
  key: string;
  size: number;
  content_type: string | null;
  last_modified: string | null;
}

interface TauriDownloadFolderResult {
  files_downloaded: number;
  files_failed: number;
  destination_path: string;
}

function toTauriProfile(profile: ConnectionProfileInput): TauriS3Profile {
  return {
    endpoint: normalizeEndpoint(profile.endpoint, profile.useSsl) || null,
    region: profile.region,
    use_ssl: profile.useSsl,
    force_path_style: profile.forcePathStyle,
    access_key_id: profile.credentials.accessKeyId,
    secret_access_key: profile.credentials.secretAccessKey,
  };
}

function assertTauri() {
  if (!isTauri()) {
    throw new Error("S3 downloads require running inside Tauri. Use `pnpm tauri dev`.");
  }
}

export interface DownloadProgressEvent {
  id: string;
  status: string;
  downloaded_bytes: number;
  total_bytes: number;
  destination_path: string;
  error: string | null;
}

export interface S3ObjectInfo {
  key: string;
  size: number;
  contentType?: string;
  lastModified?: string;
}

export async function getObjectInfo(
  profile: ConnectionProfileInput,
  bucketName: string,
  key: string,
): Promise<S3ObjectInfo> {
  assertTauri();

  const info = await invoke<TauriS3ObjectInfo>("s3_get_object_info", {
    profile: toTauriProfile(profile),
    bucketName,
    key,
  });

  return {
    key: info.key,
    size: info.size,
    contentType: info.content_type ?? undefined,
    lastModified: info.last_modified ?? undefined,
  };
}

export async function downloadObject(
  profile: ConnectionProfileInput,
  bucketName: string,
  key: string,
  destinationPath: string,
): Promise<void> {
  assertTauri();

  await invoke("s3_download_object", {
    profile: toTauriProfile(profile),
    bucketName,
    key,
    destinationPath,
  });
}

export async function downloadFolder(
  profile: ConnectionProfileInput,
  bucketName: string,
  prefix: string,
  destinationPath: string,
): Promise<{ filesDownloaded: number; filesFailed: number }> {
  assertTauri();

  const result = await invoke<TauriDownloadFolderResult>("s3_download_folder", {
    profile: toTauriProfile(profile),
    bucketName,
    prefix,
    destinationPath,
  });

  return {
    filesDownloaded: result.files_downloaded,
    filesFailed: result.files_failed,
  };
}

export async function openInFinder(path: string): Promise<void> {
  assertTauri();

  await invoke("s3_open_in_finder", { path });
}

export async function listenDownloadProgress(
  callback: (event: DownloadProgressEvent) => void,
): Promise<() => void> {
  assertTauri();

  const unlisten = await listen<DownloadProgressEvent>("download_progress", (event) => {
    callback(event.payload);
  });

  return unlisten;
}
