import { invoke, isTauri } from "@tauri-apps/api/core";

import { normalizeEndpoint } from "@/services/s3/validation";
import type { S3BucketSummary } from "@/types/bucket";
import type { ConnectionProfileInput, ConnectionTestResult } from "@/types/connection";

interface TauriS3Profile {
  endpoint: string | null;
  region: string;
  use_ssl: boolean;
  force_path_style: boolean;
  access_key_id: string;
  secret_access_key: string;
}

interface TauriS3Bucket {
  name: string;
  creation_date: string | null;
}

interface TauriConnectionTestResult {
  ok: boolean;
  message: string;
  bucket_count: number | null;
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

function fromTauriBucket(bucket: TauriS3Bucket): S3BucketSummary {
  return {
    name: bucket.name,
    creationDate: bucket.creation_date ?? undefined,
  };
}

function fromTauriTestResult(result: TauriConnectionTestResult): ConnectionTestResult {
  return {
    ok: result.ok,
    message: result.message,
    bucketCount: result.bucket_count ?? undefined,
  };
}

export async function listBuckets(profile: ConnectionProfileInput): Promise<S3BucketSummary[]> {
  if (!isTauri()) {
    throw new Error("S3 operations require running inside Tauri. Use `bun run tauri dev`.");
  }

  const buckets = await invoke<TauriS3Bucket[]>("s3_list_buckets", {
    profile: toTauriProfile(profile),
  });
  return buckets.map(fromTauriBucket).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createBucket(
  profile: ConnectionProfileInput,
  bucketName: string,
): Promise<void> {
  if (!isTauri()) {
    throw new Error("S3 operations require running inside Tauri. Use `bun run tauri dev`.");
  }

  await invoke("s3_create_bucket", {
    profile: toTauriProfile(profile),
    bucketName,
  });
}

export async function deleteBucket(
  profile: ConnectionProfileInput,
  bucketName: string,
): Promise<void> {
  if (!isTauri()) {
    throw new Error("S3 operations require running inside Tauri. Use `bun run tauri dev`.");
  }

  await invoke("s3_delete_bucket", {
    profile: toTauriProfile(profile),
    bucketName,
  });
}

export async function testS3Connection(
  profile: ConnectionProfileInput,
): Promise<ConnectionTestResult> {
  if (!isTauri()) {
    return {
      ok: false,
      message: "S3 operations require running inside Tauri. Use `bun run tauri dev`.",
    };
  }

  const result = await invoke<TauriConnectionTestResult>("s3_test_connection", {
    profile: toTauriProfile(profile),
  });
  return fromTauriTestResult(result);
}
