import { invoke, isTauri } from "@tauri-apps/api/core";

import { normalizeEndpoint } from "@/services/s3/validation";
import type { S3BucketSummary } from "@/types/bucket";
import type { S3ObjectExplorerPage, S3ObjectFile, S3ObjectFolder } from "@/types/object";
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

interface TauriS3ObjectFolder {
  name: string;
  prefix: string;
}

interface TauriS3ObjectFile {
  key: string;
  name: string;
  size: number;
  last_modified: string | null;
  storage_class: string | null;
}

interface TauriS3ObjectExplorerPage {
  bucket_name: string;
  prefix: string;
  folders: TauriS3ObjectFolder[];
  files: TauriS3ObjectFile[];
  object_count: number;
  folder_count: number;
  page_count: number;
  continuation_token: string | null;
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

function fromTauriObjectFolder(folder: TauriS3ObjectFolder): S3ObjectFolder {
  return {
    name: folder.name,
    prefix: folder.prefix,
  };
}

function fromTauriObjectFile(file: TauriS3ObjectFile): S3ObjectFile {
  return {
    key: file.key,
    name: file.name,
    size: file.size,
    lastModified: file.last_modified ?? undefined,
    storageClass: file.storage_class ?? undefined,
  };
}

function fromTauriObjectPage(page: TauriS3ObjectExplorerPage): S3ObjectExplorerPage {
  return {
    bucketName: page.bucket_name,
    prefix: page.prefix,
    folders: page.folders.map(fromTauriObjectFolder),
    files: page.files.map(fromTauriObjectFile),
    objectCount: page.object_count,
    folderCount: page.folder_count,
    pageCount: page.page_count,
    continuationToken: page.continuation_token ?? undefined,
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

export async function listObjects(
  profile: ConnectionProfileInput,
  bucketName: string,
  prefix = "",
  continuationToken?: string,
): Promise<S3ObjectExplorerPage> {
  if (!isTauri()) {
    throw new Error("S3 operations require running inside Tauri. Use `bun run tauri dev`.");
  }

  const page = await invoke<TauriS3ObjectExplorerPage>("s3_list_objects", {
    profile: toTauriProfile(profile),
    bucketName,
    prefix,
    continuationToken: continuationToken ?? null,
  });

  return fromTauriObjectPage(page);
}

interface TauriDeleteObjectsResult {
  deleted: string[];
  errors: string[];
}

export async function deleteObject(
  profile: ConnectionProfileInput,
  bucketName: string,
  key: string,
): Promise<void> {
  if (!isTauri()) {
    throw new Error("S3 operations require running inside Tauri. Use `bun run tauri dev`.");
  }

  await invoke("s3_delete_object", {
    profile: toTauriProfile(profile),
    bucketName,
    key,
  });
}

export async function deleteObjects(
  profile: ConnectionProfileInput,
  bucketName: string,
  keys: string[],
): Promise<{ deleted: string[]; errors: string[] }> {
  if (!isTauri()) {
    throw new Error("S3 operations require running inside Tauri. Use `bun run tauri dev`.");
  }

  const result = await invoke<TauriDeleteObjectsResult>("s3_delete_objects", {
    profile: toTauriProfile(profile),
    bucketName,
    keys,
  });

  return { deleted: result.deleted, errors: result.errors };
}

interface TauriListAllKeysResult {
  keys: string[];
}

export async function listAllKeys(
  profile: ConnectionProfileInput,
  bucketName: string,
  prefix: string,
): Promise<string[]> {
  if (!isTauri()) {
    throw new Error("S3 operations require running inside Tauri. Use `bun run tauri dev`.");
  }

  const result = await invoke<TauriListAllKeysResult>("s3_list_all_keys", {
    profile: toTauriProfile(profile),
    bucketName,
    prefix,
  });

  return result.keys;
}

export async function copyObject(
  profile: ConnectionProfileInput,
  sourceBucket: string,
  sourceKey: string,
  destinationBucket: string,
  destinationKey: string,
): Promise<void> {
  if (!isTauri()) {
    throw new Error("S3 operations require running inside Tauri. Use `bun run tauri dev`.");
  }

  await invoke("s3_copy_object", {
    profile: toTauriProfile(profile),
    sourceBucket,
    sourceKey,
    destinationBucket,
    destinationKey,
  });
}

export async function createFolder(
  profile: ConnectionProfileInput,
  bucketName: string,
  prefix: string,
): Promise<void> {
  if (!isTauri()) {
    throw new Error("S3 operations require running inside Tauri. Use `bun run tauri dev`.");
  }

  await invoke("s3_create_folder", {
    profile: toTauriProfile(profile),
    bucketName,
    prefix,
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
