import { invoke, isTauri } from "@tauri-apps/api/core";

import type { ConnectionProfileInput } from "@/types/connection";
import { normalizeEndpoint } from "@/services/s3/validation";

interface TauriS3Profile {
  endpoint: string | null;
  region: string;
  use_ssl: boolean;
  force_path_style: boolean;
  access_key_id: string;
  secret_access_key: string;
}

interface TauriS3ObjectBody {
  content_type: string;
  body_base64: string;
  size: number;
}

export interface S3PreviewContent {
  contentType: string;
  bodyBase64: string;
  size: number;
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

export function getPreviewContent(
  profile: ConnectionProfileInput,
  bucketName: string,
  key: string,
): Promise<S3PreviewContent> {
  if (!isTauri()) {
    throw new Error("S3 preview requires running inside Tauri. Use `bun run tauri dev`.");
  }

  return invoke<TauriS3ObjectBody>("s3_get_object_body", {
    profile: toTauriProfile(profile),
    bucketName,
    key,
  }).then((res) => ({
    contentType: res.content_type,
    bodyBase64: res.body_base64,
    size: res.size,
  }));
}
