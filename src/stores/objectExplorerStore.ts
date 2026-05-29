import { create } from "zustand";

import { listObjects } from "@/services/s3/client";
import type { ConnectionProfile } from "@/types/connection";
import type { ObjectExplorerStatus, S3ObjectExplorerPage } from "@/types/object";

interface ObjectExplorerState {
  currentBucketName?: string;
  currentPrefix: string;
  page?: S3ObjectExplorerPage;
  status: ObjectExplorerStatus;
  lastMessage?: string;
  lastLoadedProfileId?: string;
  openPath: (profile: ConnectionProfile, bucketName: string, prefix?: string) => Promise<void>;
  refreshCurrentPath: (profile: ConnectionProfile) => Promise<void>;
  resetExplorer: () => void;
}

export const useObjectExplorerStore = create<ObjectExplorerState>((set, get) => ({
  currentPrefix: "",
  status: "idle",
  async openPath(profile, bucketName, prefix = "") {
    const normalizedPrefix = normalizePrefix(prefix);

    set({
      currentBucketName: bucketName,
      currentPrefix: normalizedPrefix,
      status: "loading",
      lastMessage: `Loading s3://${bucketName}/${normalizedPrefix}`,
    });

    try {
      const page = await listObjects(profile, bucketName, normalizedPrefix);

      set({
        currentBucketName: bucketName,
        currentPrefix: normalizedPrefix,
        page,
        status: "idle",
        lastLoadedProfileId: profile.id,
        lastMessage: `Loaded ${page.folderCount} folder${page.folderCount === 1 ? "" : "s"} and ${page.objectCount} file${page.objectCount === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      set({
        status: "error",
        lastLoadedProfileId: profile.id,
        lastMessage: getObjectExplorerErrorMessage(error),
      });
    }
  },
  async refreshCurrentPath(profile) {
    const { currentBucketName, currentPrefix } = get();

    if (!currentBucketName) {
      return;
    }

    await get().openPath(profile, currentBucketName, currentPrefix);
  },
  resetExplorer() {
    set({
      currentBucketName: undefined,
      currentPrefix: "",
      page: undefined,
      status: "idle",
      lastMessage: undefined,
      lastLoadedProfileId: undefined,
    });
  },
}));

function normalizePrefix(prefix: string): string {
  const trimmedPrefix = prefix.trim().replace(/^\/+/, "");

  if (!trimmedPrefix) {
    return "";
  }

  return trimmedPrefix.endsWith("/") ? trimmedPrefix : `${trimmedPrefix}/`;
}

function getObjectExplorerErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load objects for the current path.";
}
