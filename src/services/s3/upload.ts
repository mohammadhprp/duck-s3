import { invoke, isTauri } from "@tauri-apps/api/core";

import type { ConnectionProfileInput } from "@/types/connection";
import { normalizeEndpoint } from "@/services/s3/validation";

const MULTIPART_CHUNK_SIZE = 1 * 1024 * 1024;

interface TauriS3Profile {
  endpoint: string | null;
  region: string;
  use_ssl: boolean;
  force_path_style: boolean;
  access_key_id: string;
  secret_access_key: string;
}

interface MultipartPartResult {
  part_number: number;
  e_tag: string;
}

interface UploadFileOptions {
  profile: ConnectionProfileInput;
  bucketName: string;
  key: string;
  file: File;
  signal?: AbortSignal;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
  onUploadStarted?: (uploadId: string) => void;
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
    throw new Error("S3 uploads require running inside Tauri. Use `bun run tauri dev`.");
  }
}

export async function uploadFileMultipart({
  profile,
  bucketName,
  key,
  file,
  signal,
  onProgress,
  onUploadStarted,
}: UploadFileOptions): Promise<void> {
  assertTauri();

  const tauriProfile = toTauriProfile(profile);
  const uploadId = await invoke<string>("s3_create_multipart_upload", {
    profile: tauriProfile,
    bucketName,
    key,
    contentType: file.type || null,
  });
  onUploadStarted?.(uploadId);

  const uploadedParts: MultipartPartResult[] = [];
  let uploadedBytes = 0;

  try {
    if (signal?.aborted) {
      throw new DOMException("Upload canceled.", "AbortError");
    }

    const partCount = Math.max(1, Math.ceil(file.size / MULTIPART_CHUNK_SIZE));

    for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
      if (signal?.aborted) {
        throw new DOMException("Upload canceled.", "AbortError");
      }

      const start = partIndex * MULTIPART_CHUNK_SIZE;
      const end = Math.min(file.size, start + MULTIPART_CHUNK_SIZE);
      const body = new Uint8Array(await file.slice(start, end).arrayBuffer());
      const part = await invoke<MultipartPartResult>("s3_upload_part", {
        profile: tauriProfile,
        bucketName,
        key,
        uploadId,
        partNumber: partIndex + 1,
        body: Array.from(body),
      });

      uploadedParts.push(part);
      uploadedBytes += body.byteLength;
      onProgress?.(uploadedBytes, file.size);
    }

    await invoke("s3_complete_multipart_upload", {
      profile: tauriProfile,
      bucketName,
      key,
      uploadId,
      parts: uploadedParts,
    });
    onProgress?.(file.size, file.size);
  } catch (error) {
    await invoke("s3_abort_multipart_upload", {
      profile: tauriProfile,
      bucketName,
      key,
      uploadId,
    }).catch(() => undefined);

    throw error;
  }
}

export function isUploadAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
