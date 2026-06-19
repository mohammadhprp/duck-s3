import { create } from "zustand";

import { isUploadAbortError, uploadFileMultipart } from "@/services/s3/upload";
import { categorizeS3Error } from "@/services/s3/errors";
import { useFileOpNotificationStore } from "@/stores/fileOpNotificationStore";
import type { ConnectionProfile } from "@/types/connection";
import type { UploadJob, UploadSelection } from "@/types/upload";

const MAX_CONCURRENT_UPLOADS = 3;

const uploadControllers = new Map<string, AbortController>();

interface UploadState {
  jobs: UploadJob[];
  activeCount: number;
  lastMessage?: string;
  enqueueUploads: (options: {
    profile: ConnectionProfile;
    bucketName: string;
    prefix: string;
    selections: UploadSelection[];
  }) => void;
  cancelUpload: (jobId: string) => void;
  retryUpload: (profile: ConnectionProfile, jobId: string) => void;
  clearFinished: () => void;
  runQueue: () => Promise<void>;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  jobs: [],
  activeCount: 0,
  enqueueUploads({ profile, bucketName, prefix, selections }) {
    const createdJobs = selections.map((selection) => {
      const key = buildObjectKey(prefix, selection.relativePath || selection.file.name);

      return {
        id: crypto.randomUUID(),
        profile: {
          id: profile.id,
          name: profile.name,
          provider: profile.provider,
          endpoint: profile.endpoint,
          region: profile.region,
          credentials: {
            accessKeyId: profile.credentials.accessKeyId,
            secretAccessKey: profile.credentials.secretAccessKey,
          },
          forcePathStyle: profile.forcePathStyle,
          useSsl: profile.useSsl,
        },
        file: selection.file,
        bucketName,
        key,
        status: "queued" as const,
        progress: 0,
        uploadedBytes: 0,
        totalBytes: selection.file.size,
        createdAt: Date.now(),
      };
    });

    if (createdJobs.length === 0) {
      return;
    }

    set((state) => ({
      jobs: [...createdJobs, ...state.jobs],
      lastMessage: `Queued ${createdJobs.length} upload${createdJobs.length === 1 ? "" : "s"}.`,
    }));

    void get().runQueue();
  },
  cancelUpload(jobId) {
    const controller = uploadControllers.get(jobId);
    controller?.abort();

    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId && job.status === "queued"
          ? {
              ...job,
              status: "canceled",
              completedAt: Date.now(),
              error: "Upload canceled before it started.",
            }
          : job,
      ),
      lastMessage: "Upload cancellation requested.",
    }));
  },
  retryUpload(profile, jobId) {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              profile: {
                id: profile.id,
                name: profile.name,
                provider: profile.provider,
                endpoint: profile.endpoint,
                region: profile.region,
                credentials: {
                  accessKeyId: profile.credentials.accessKeyId,
                  secretAccessKey: profile.credentials.secretAccessKey,
                },
                forcePathStyle: profile.forcePathStyle,
                useSsl: profile.useSsl,
              },
              status: "queued",
              progress: 0,
              uploadedBytes: 0,
              error: undefined,
              startedAt: undefined,
              completedAt: undefined,
              uploadId: undefined,
            }
          : job,
      ),
      lastMessage: "Upload queued for retry.",
    }));

    void get().runQueue();
  },
  clearFinished() {
    set((state) => ({
      jobs: state.jobs.filter((job) => !["completed", "failed", "canceled"].includes(job.status)),
      lastMessage: "Cleared finished uploads.",
    }));
  },
  async runQueue() {
    const state = get();
    const availableSlots = MAX_CONCURRENT_UPLOADS - state.activeCount;

    if (availableSlots <= 0) {
      return;
    }

    const nextJobs = state.jobs.filter((job) => job.status === "queued").slice(0, availableSlots);

    if (nextJobs.length === 0) {
      return;
    }

    set((currentState) => ({
      activeCount: currentState.activeCount + nextJobs.length,
      jobs: currentState.jobs.map((job) =>
        nextJobs.some((nextJob) => nextJob.id === job.id)
          ? { ...job, status: "uploading", startedAt: Date.now(), error: undefined }
          : job,
      ),
      lastMessage: `Uploading ${nextJobs.length} file${nextJobs.length === 1 ? "" : "s"}...`,
    }));

    await Promise.all(nextJobs.map((job) => uploadJob(job)));
    void get().runQueue();
  },
}));

async function uploadJob(job: UploadJob) {
  const controller = new AbortController();
  uploadControllers.set(job.id, controller);

  const fileName = job.key.split("/").pop() || job.key;
  const notifId = useFileOpNotificationStore.getState().addNotification({
    message: `Uploading "${fileName}"...`,
    status: "running",
    progress: 0,
    canCancel: true,
    metadata: { source: "upload", jobId: job.id, profileId: job.profile.id },
  });

  try {
    await uploadFileMultipart({
      profile: job.profile,
      bucketName: job.bucketName,
      key: job.key,
      file: job.file,
      signal: controller.signal,
      onUploadStarted(uploadId) {
        useUploadStore.setState((state) => ({
          jobs: state.jobs.map((candidate) =>
            candidate.id === job.id ? { ...candidate, uploadId } : candidate,
          ),
        }));
      },
      onProgress(uploadedBytes, totalBytes) {
        const progress = totalBytes === 0 ? 100 : Math.round((uploadedBytes / totalBytes) * 100);
        useUploadStore.setState((state) => ({
          jobs: state.jobs.map((candidate) =>
            candidate.id === job.id
              ? { ...candidate, uploadedBytes, totalBytes, progress }
              : candidate,
          ),
        }));
        useFileOpNotificationStore.getState().updateNotification(notifId, { progress });
      },
    });

    useUploadStore.setState((state) => ({
      jobs: state.jobs.map((candidate) =>
        candidate.id === job.id
          ? {
              ...candidate,
              status: "completed",
              progress: 100,
              uploadedBytes: candidate.totalBytes,
              completedAt: Date.now(),
            }
          : candidate,
      ),
      lastMessage: "Upload completed.",
    }));
    useFileOpNotificationStore.getState().updateNotification(notifId, {
      message: `Uploaded "${fileName}"`,
      status: "success",
      canCancel: false,
    });
  } catch (error) {
    const aborted = isUploadAbortError(error);
    useUploadStore.setState((state) => ({
      jobs: state.jobs.map((candidate) =>
        candidate.id === job.id
          ? {
              ...candidate,
              status: aborted ? "canceled" : "failed",
              error: getUploadErrorMessage(error),
              completedAt: Date.now(),
            }
          : candidate,
      ),
      lastMessage: aborted ? "Upload canceled." : "Upload failed.",
    }));
    if (aborted) {
      useFileOpNotificationStore.getState().removeNotification(notifId);
    } else {
      useFileOpNotificationStore.getState().updateNotification(notifId, {
        message: `Failed to upload "${fileName}"`,
        status: "error",
        canCancel: false,
        canRetry: true,
      });
    }
  } finally {
    uploadControllers.delete(job.id);
    useUploadStore.setState((state) => ({ activeCount: Math.max(0, state.activeCount - 1) }));
  }
}

function buildObjectKey(prefix: string, relativePath: string): string {
  const normalizedPrefix = prefix.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  const normalizedPath = relativePath.replace(/^\/+/, "");

  return [normalizedPrefix, normalizedPath].filter(Boolean).join("/");
}

function getUploadErrorMessage(error: unknown): string {
  if (isUploadAbortError(error)) {
    return "Upload canceled.";
  }

  return categorizeS3Error(error).userMessage;
}
