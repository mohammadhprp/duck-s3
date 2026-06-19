import type { S3Provider } from "@/features/connections/types/connection";

export type UploadJobStatus = "queued" | "uploading" | "completed" | "failed" | "canceled";

export interface UploadJob {
  id: string;
  profile: {
    id: string;
    name: string;
    provider: S3Provider;
    endpoint: string;
    region: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    };
    forcePathStyle: boolean;
    useSsl: boolean;
  };
  file: File;
  bucketName: string;
  key: string;
  status: UploadJobStatus;
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  uploadId?: string;
}

export interface UploadSelection {
  file: File;
  relativePath: string;
}
