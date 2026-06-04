import type { S3Provider } from "./connection";

export type DownloadJobStatus = "queued" | "downloading" | "completed" | "failed" | "canceled";

export interface DownloadJob {
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
  bucketName: string;
  key: string;
  isFolder: boolean;
  destinationPath: string;
  status: DownloadJobStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface DownloadSelection {
  key: string;
  name: string;
  isFolder: boolean;
  size?: number;
}
