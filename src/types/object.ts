export interface S3ObjectFolder {
  name: string;
  prefix: string;
}

export interface S3ObjectFile {
  key: string;
  name: string;
  size: number;
  lastModified?: string;
  storageClass?: string;
}

export interface S3ObjectExplorerPage {
  bucketName: string;
  prefix: string;
  folders: S3ObjectFolder[];
  files: S3ObjectFile[];
  objectCount: number;
  folderCount: number;
  pageCount: number;
}

export type ObjectExplorerStatus = "idle" | "loading" | "error";

export type ObjectExplorerSortField = "name" | "size" | "lastModified" | "storageClass";

export type ObjectExplorerSortDirection = "asc" | "desc";
