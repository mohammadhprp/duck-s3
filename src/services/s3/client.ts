import {
  CreateBucketCommand,
  DeleteBucketCommand,
  ListBucketsCommand,
  S3Client,
  type BucketLocationConstraint,
  type CreateBucketCommandInput,
} from "@aws-sdk/client-s3";

import { normalizeEndpoint } from "@/services/s3/validation";
import type { S3BucketSummary } from "@/types/bucket";
import type { ConnectionProfileInput, ConnectionTestResult } from "@/types/connection";

export function createS3Client(profile: ConnectionProfileInput): S3Client {
  const endpoint = normalizeEndpoint(profile.endpoint, profile.useSsl);

  return new S3Client({
    region: profile.region,
    endpoint: endpoint || undefined,
    forcePathStyle: profile.forcePathStyle,
    credentials: {
      accessKeyId: profile.credentials.accessKeyId,
      secretAccessKey: profile.credentials.secretAccessKey,
    },
  });
}

export async function listBuckets(profile: ConnectionProfileInput): Promise<S3BucketSummary[]> {
  const client = createS3Client(profile);

  try {
    const response = await client.send(new ListBucketsCommand({}));

    return (response.Buckets ?? [])
      .filter((bucket) => Boolean(bucket.Name))
      .map((bucket) => ({
        name: bucket.Name!,
        creationDate: bucket.CreationDate?.toISOString(),
      }))
      .sort((leftBucket, rightBucket) => leftBucket.name.localeCompare(rightBucket.name));
  } catch (error) {
    throw new Error(getS3ErrorMessage(error));
  } finally {
    client.destroy();
  }
}

export async function createBucket(
  profile: ConnectionProfileInput,
  bucketName: string,
): Promise<void> {
  const client = createS3Client(profile);
  const input: CreateBucketCommandInput = { Bucket: bucketName };

  if (profile.provider === "aws" && profile.region !== "us-east-1") {
    input.CreateBucketConfiguration = {
      LocationConstraint: profile.region as BucketLocationConstraint,
    };
  }

  try {
    await client.send(new CreateBucketCommand(input));
  } catch (error) {
    throw new Error(getS3ErrorMessage(error));
  } finally {
    client.destroy();
  }
}

export async function deleteBucket(
  profile: ConnectionProfileInput,
  bucketName: string,
): Promise<void> {
  const client = createS3Client(profile);

  try {
    await client.send(new DeleteBucketCommand({ Bucket: bucketName }));
  } catch (error) {
    throw new Error(getS3ErrorMessage(error));
  } finally {
    client.destroy();
  }
}

export async function testS3Connection(
  profile: ConnectionProfileInput,
): Promise<ConnectionTestResult> {
  const client = createS3Client(profile);

  try {
    const response = await client.send(new ListBucketsCommand({}));

    return {
      ok: true,
      message: "Connection test succeeded.",
      bucketCount: response.Buckets?.length ?? 0,
    };
  } catch (error) {
    return {
      ok: false,
      message: getS3ErrorMessage(error),
    };
  } finally {
    client.destroy();
  }
}

function getS3ErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to connect with the provided credentials.";
}
