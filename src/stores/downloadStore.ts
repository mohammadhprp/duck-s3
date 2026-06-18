import { create } from "zustand";

import { downloadFolder, downloadObject, listenDownloadProgress } from "@/services/s3/download";
import { openInFinder } from "@/services/s3/download";
import { useFileOpNotificationStore } from "@/stores/fileOpNotificationStore";
import { save, open } from "@tauri-apps/plugin-dialog";
import type { ConnectionProfile } from "@/types/connection";
import type { DownloadJob, DownloadSelection } from "@/types/download";

const MAX_CONCURRENT_DOWNLOADS = 3;

const downloadControllers = new Map<string, AbortController>();

interface DownloadState {
  jobs: DownloadJob[];
  activeCount: number;
  lastMessage?: string;
  isInitialized: boolean;
  enqueueDownloads: (options: {
    profile: ConnectionProfile;
    bucketName: string;
    selections: DownloadSelection[];
  }) => void;
  cancelDownload: (jobId: string) => void;
  retryDownload: (profile: ConnectionProfile, jobId: string) => void;
  clearFinished: () => void;
  openInFinderForJob: (jobId: string) => void;
  runQueue: () => Promise<void>;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  jobs: [],
  activeCount: 0,
  lastMessage: undefined,
  isInitialized: false,
  enqueueDownloads({ profile, bucketName, selections }) {
    const createdJobs = selections.map((selection) => {
      const fileName = selection.isFolder
        ? selection.name
        : selection.key.split("/").pop() || selection.name;

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
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
        bucketName,
        key: selection.key,
        isFolder: selection.isFolder,
        destinationPath: "",
        status: "queued" as const,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: selection.size ?? 0,
        createdAt: Date.now(),
      };
    });

    if (createdJobs.length === 0) {
      return;
    }

    set((state) => ({
      jobs: [...createdJobs, ...state.jobs],
      lastMessage: `Queued ${createdJobs.length} download${createdJobs.length === 1 ? "" : "s"}.`,
    }));

    void get().runQueue();
  },
  cancelDownload(jobId) {
    const controller = downloadControllers.get(jobId);
    controller?.abort();

    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId && job.status === "queued"
          ? {
              ...job,
              status: "canceled",
              completedAt: Date.now(),
              error: "Download canceled before it started.",
            }
          : job,
      ),
      lastMessage: "Download cancellation requested.",
    }));
  },
  retryDownload(profile, jobId) {
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
                createdAt: profile.createdAt,
                updatedAt: profile.updatedAt,
              },
              status: "queued",
              progress: 0,
              downloadedBytes: 0,
              error: undefined,
              startedAt: undefined,
              completedAt: undefined,
            }
          : job,
      ),
      lastMessage: "Download queued for retry.",
    }));

    void get().runQueue();
  },
  clearFinished() {
    set((state) => ({
      jobs: state.jobs.filter((job) => !["completed", "failed", "canceled"].includes(job.status)),
      lastMessage: "Cleared finished downloads.",
    }));
  },
  openInFinderForJob(jobId) {
    const { jobs } = get();
    const job = jobs.find((j) => j.id === jobId);

    if (!job || job.status !== "completed" || !job.destinationPath) {
      return;
    }

    openInFinder(job.destinationPath).catch(() => {
      set({ lastMessage: "Failed to open in Finder." });
    });
  },
  async runQueue() {
    const state = get();
    const availableSlots = MAX_CONCURRENT_DOWNLOADS - state.activeCount;

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
          ? { ...job, status: "downloading", startedAt: Date.now(), error: undefined }
          : job,
      ),
      lastMessage: `Downloading ${nextJobs.length} item${nextJobs.length === 1 ? "" : "s"}...`,
    }));

    await Promise.all(nextJobs.map((job) => downloadJob(job)));
    void get().runQueue();
  },
}));

async function downloadJob(job: DownloadJob) {
  const controller = new AbortController();
  downloadControllers.set(job.id, controller);

  let notifId: string | null = null;

  try {
    const defaultFileName = job.isFolder
      ? job.key.split("/").filter(Boolean).pop() || "folder"
      : job.key.split("/").pop() || "download";

    const basePath = await chooseDownloadPath(defaultFileName, job.isFolder);

    if (!basePath) {
      useDownloadStore.setState((state) => ({
        jobs: state.jobs.map((candidate) =>
          candidate.id === job.id
            ? {
                ...candidate,
                status: "canceled",
                error: "Download canceled: no destination selected.",
                completedAt: Date.now(),
              }
            : candidate,
        ),
        lastMessage: "Download canceled.",
      }));
      return;
    }

    useDownloadStore.setState((state) => ({
      jobs: state.jobs.map((candidate) =>
        candidate.id === job.id ? { ...candidate, destinationPath: basePath } : candidate,
      ),
    }));

    notifId = useFileOpNotificationStore.getState().addNotification({
      message: job.isFolder
        ? `Downloading folder "${defaultFileName}"...`
        : `Downloading "${defaultFileName}"...`,
      status: "running",
      progress: 0,
      canCancel: true,
      metadata: {
        source: "download",
        jobId: job.id,
        profileId: job.profile.id,
      },
    });

    const expectedEventId = job.isFolder
      ? `folder:${job.bucketName}:${job.key}`
      : `${job.bucketName}:${job.key}`;

    const unlisten = await listenDownloadProgress((event) => {
      if (event.id !== expectedEventId) return;

      const progress =
        event.total_bytes > 0 ? Math.round((event.downloaded_bytes / event.total_bytes) * 100) : 0;

      useDownloadStore.setState((state) => ({
        jobs: state.jobs.map((candidate) => {
          if (candidate.id !== job.id) return candidate;

          return {
            ...candidate,
            downloadedBytes: event.downloaded_bytes,
            totalBytes: event.total_bytes,
            progress,
            status:
              event.status === "completed"
                ? "completed"
                : event.status === "failed"
                  ? "failed"
                  : candidate.status,
            destinationPath: event.destination_path || candidate.destinationPath,
            error: event.error ?? candidate.error,
            completedAt:
              event.status === "completed" || event.status === "failed"
                ? Date.now()
                : candidate.completedAt,
          };
        }),
      }));

      if (notifId) {
        useFileOpNotificationStore.getState().updateNotification(notifId, { progress });
      }

      if (event.status === "completed" && notifId) {
        useFileOpNotificationStore.getState().updateNotification(notifId, {
          message: `Downloaded "${defaultFileName}"`,
          status: "success",
          canCancel: false,
          canOpenInFinder: true,
          destinationPath: event.destination_path || basePath,
        });
      }

      if (event.status === "failed" && notifId) {
        useFileOpNotificationStore.getState().updateNotification(notifId, {
          message: `Failed to download "${defaultFileName}"`,
          status: "error",
          canCancel: false,
          canRetry: true,
        });
      }
    });

    if (job.isFolder) {
      await downloadFolder(job.profile, job.bucketName, job.key, basePath);
    } else {
      await downloadObject(job.profile, job.bucketName, job.key, basePath);
    }

    unlisten();

    useDownloadStore.setState((state) => ({
      jobs: state.jobs.map((candidate) =>
        candidate.id === job.id
          ? {
              ...candidate,
              status: "completed",
              progress: 100,
              completedAt: Date.now(),
            }
          : candidate,
      ),
      lastMessage: "Download completed.",
    }));

    if (notifId) {
      useFileOpNotificationStore.getState().updateNotification(notifId, {
        message: `Downloaded "${defaultFileName}"`,
        status: "success",
        canCancel: false,
        canOpenInFinder: true,
        destinationPath: basePath,
      });
    }
  } catch (error) {
    const errorMessage = getDownloadErrorMessage(error);
    const failedFileName = job.isFolder
      ? job.key.split("/").filter(Boolean).pop() || "folder"
      : job.key.split("/").pop() || "download";

    useDownloadStore.setState((state) => ({
      jobs: state.jobs.map((candidate) =>
        candidate.id === job.id
          ? {
              ...candidate,
              status: controller.signal.aborted ? "canceled" : "failed",
              error: errorMessage,
              completedAt: Date.now(),
            }
          : candidate,
      ),
      lastMessage: controller.signal.aborted
        ? "Download canceled."
        : `Download failed: ${errorMessage}`,
    }));

    if (notifId) {
      if (controller.signal.aborted) {
        useFileOpNotificationStore.getState().removeNotification(notifId);
      } else {
        useFileOpNotificationStore.getState().updateNotification(notifId, {
          message: `Failed to download "${failedFileName}"`,
          status: "error",
          canCancel: false,
          canRetry: true,
        });
      }
    }
  } finally {
    downloadControllers.delete(job.id);
    useDownloadStore.setState((state) => ({
      activeCount: Math.max(0, state.activeCount - 1),
    }));
  }
}

async function chooseDownloadPath(defaultName: string, isFolder: boolean): Promise<string | null> {
  try {
    if (isFolder) {
      const selected = await open({
        title: "Select folder to download to",
        directory: true,
      });
      return selected ? `${selected}/${defaultName}` : null;
    }

    const selected = await save({
      title: "Save file",
      defaultPath: defaultName,
    });
    return selected;
  } catch (error) {
    const homeDir = await getHomeDir();
    return `${homeDir}/Downloads/${defaultName}`;
  }
}

async function getHomeDir(): Promise<string> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("get_home_dir");
  } catch {
    return "~/Downloads";
  }
}

function getDownloadErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const errorObj = error as Record<string, unknown>;
    if ("message" in errorObj && typeof errorObj.message === "string") {
      return errorObj.message;
    }
    if ("error" in errorObj && typeof errorObj.error === "string") {
      return errorObj.error;
    }
  }

  return "Unable to download.";
}
