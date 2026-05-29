export interface S3BucketSummary {
  name: string;
  creationDate?: string;
}

export type BucketOperationStatus = "idle" | "loading" | "creating" | "deleting" | "error";
