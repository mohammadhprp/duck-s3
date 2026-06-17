import { create } from "zustand";

import { getPreviewContent } from "@/services/s3/preview";
import type { S3PreviewContent } from "@/services/s3/preview";

export type PreviewStatus = "idle" | "loading" | "loaded" | "error";

export interface PreviewFile {
  key: string;
  name: string;
}

export interface PreviewState {
  isOpen: boolean;
  file: PreviewFile | null;
  content: S3PreviewContent | null;
  status: PreviewStatus;
  error: string | null;
}

export interface PreviewActions {
  openPreview: (file: PreviewFile) => void;
  closePreview: () => void;
  loadContent: (
    profile: Parameters<typeof getPreviewContent>[0],
    bucketName: string,
  ) => Promise<void>;
}

export const usePreviewStore = create<PreviewState & PreviewActions>()((set, get) => ({
  isOpen: false,
  file: null,
  content: null,
  status: "idle",
  error: null,

  openPreview(file) {
    set({ isOpen: true, file, content: null, status: "loading", error: null });
  },

  closePreview() {
    set({ isOpen: false, file: null, content: null, status: "idle", error: null });
  },

  async loadContent(profile, bucketName) {
    const { file } = get();
    if (!file) return;

    set({ status: "loading", error: null });

    try {
      const content = await getPreviewContent(profile, bucketName, file.key);
      set({ content, status: "loaded" });
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
