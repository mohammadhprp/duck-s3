import { create } from "zustand";

export type FileOpStatus = "running" | "success" | "error";

export interface FileOpNotification {
  id: string;
  message: string;
  status: FileOpStatus;
  createdAt: number;
  progress?: number;
  canCancel?: boolean;
  canRetry?: boolean;
  canOpenInFinder?: boolean;
  destinationPath?: string;
  metadata?: {
    source?: "upload" | "download" | "fileop";
    jobId?: string;
    profileId?: string;
    bucketName?: string;
    key?: string;
    isFolder?: boolean;
  };
}

interface FileOpNotificationState {
  notifications: FileOpNotification[];
  addNotification: (opts: {
    message: string;
    status: FileOpStatus;
    progress?: number;
    canCancel?: boolean;
    canRetry?: boolean;
    canOpenInFinder?: boolean;
    destinationPath?: string;
    metadata?: FileOpNotification["metadata"];
  }) => string;
  updateNotification: (
    id: string,
    updates: Partial<
      Pick<
        FileOpNotification,
        | "message"
        | "status"
        | "progress"
        | "canCancel"
        | "canRetry"
        | "canOpenInFinder"
        | "destinationPath"
      >
    >,
  ) => void;
  removeNotification: (id: string) => void;
}

export const useFileOpNotificationStore = create<FileOpNotificationState>((set) => ({
  notifications: [],
  addNotification: (opts) => {
    const id = crypto.randomUUID();
    set((state) => ({
      notifications: [...state.notifications, { id, ...opts, createdAt: Date.now() }],
    }));
    return id;
  },
  updateNotification: (id, updates) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
  },
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
}));
