export type S3Provider = "aws" | "minio" | "r2" | "custom";

export type ConnectionStatus = "idle" | "testing" | "connected" | "error";

export interface ConnectionCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface ConnectionProfileInput {
  id?: string;
  name: string;
  provider: S3Provider;
  endpoint: string;
  region: string;
  credentials: ConnectionCredentials;
  forcePathStyle: boolean;
  useSsl: boolean;
}

export interface ConnectionProfile extends ConnectionProfileInput {
  id: string;
  endpoint: string;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  bucketCount?: number;
}
