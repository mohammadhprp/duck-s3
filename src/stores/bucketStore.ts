import { create } from "zustand";

import {
  createBucket as createS3Bucket,
  deleteBucket as deleteS3Bucket,
  listBuckets,
} from "@/services/s3/client";
import { categorizeS3Error } from "@/services/s3/errors";
import type { S3BucketSummary, BucketOperationStatus } from "@/types/bucket";
import type { ConnectionProfile } from "@/types/connection";

interface BucketState {
  buckets: S3BucketSummary[];
  selectedBucketName?: string;
  status: BucketOperationStatus;
  lastMessage?: string;
  lastLoadedProfileId?: string;
  selectBucket: (bucketName: string) => void;
  refreshBuckets: (profile: ConnectionProfile) => Promise<void>;
  createBucket: (profile: ConnectionProfile, bucketName: string) => Promise<boolean>;
  deleteBucket: (profile: ConnectionProfile, bucketName: string) => Promise<boolean>;
  resetBuckets: () => void;
}

export const useBucketStore = create<BucketState>((set, get) => ({
  buckets: [],
  status: "idle",
  selectBucket(bucketName) {
    set({ selectedBucketName: bucketName });
  },
  async refreshBuckets(profile) {
    set({ status: "loading", lastMessage: `Loading buckets for ${profile.name}...` });

    try {
      const buckets = await listBuckets(profile);
      const selectedBucketName = buckets.some((bucket) => bucket.name === get().selectedBucketName)
        ? get().selectedBucketName
        : buckets[0]?.name;

      set({
        buckets,
        selectedBucketName,
        status: "idle",
        lastLoadedProfileId: profile.id,
        lastMessage: `Loaded ${buckets.length} bucket${buckets.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      set({
        status: "error",
        lastLoadedProfileId: profile.id,
        lastMessage: getBucketErrorMessage(error),
      });
    }
  },
  async createBucket(profile, bucketName) {
    const trimmedBucketName = bucketName.trim();

    if (!trimmedBucketName) {
      set({ status: "error", lastMessage: "Bucket name is required." });
      return false;
    }

    set({ status: "creating", lastMessage: `Creating ${trimmedBucketName}...` });

    try {
      await createS3Bucket(profile, trimmedBucketName);
      const buckets = await listBuckets(profile);

      set({
        buckets,
        selectedBucketName: trimmedBucketName,
        status: "idle",
        lastLoadedProfileId: profile.id,
        lastMessage: `Created bucket ${trimmedBucketName}.`,
      });
      return true;
    } catch (error) {
      set({ status: "error", lastMessage: getBucketErrorMessage(error) });
      return false;
    }
  },
  async deleteBucket(profile, bucketName) {
    set({ status: "deleting", lastMessage: `Deleting ${bucketName}...` });

    try {
      await deleteS3Bucket(profile, bucketName);
      const buckets = await listBuckets(profile);

      set({
        buckets,
        selectedBucketName: buckets.find((bucket) => bucket.name !== bucketName)?.name,
        status: "idle",
        lastLoadedProfileId: profile.id,
        lastMessage: `Deleted bucket ${bucketName}.`,
      });
      return true;
    } catch (error) {
      set({ status: "error", lastMessage: getBucketErrorMessage(error) });
      return false;
    }
  },
  resetBuckets() {
    set({
      buckets: [],
      selectedBucketName: undefined,
      status: "idle",
      lastMessage: undefined,
      lastLoadedProfileId: undefined,
    });
  },
}));

function getBucketErrorMessage(error: unknown): string {
  return categorizeS3Error(error).userMessage;
}
