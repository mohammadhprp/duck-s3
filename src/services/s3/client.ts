import { ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";

import { normalizeEndpoint } from "@/services/s3/validation";
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
