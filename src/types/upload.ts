export type UploadJobStatus = "queued" | "uploading" | "completed" | "failed" | "canceled";

export interface UploadJob {
  id: string;
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
