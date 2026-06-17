import { useEffect } from "react";
import { CheckCircle2, FolderOpen, Loader2, RotateCcw, X, XCircle } from "lucide-react";

import { Button } from "@cloudflare/kumo/components/button";
import { useFileOpNotificationStore } from "@/stores/fileOpNotificationStore";
import type { FileOpNotification } from "@/stores/fileOpNotificationStore";

export function FileOpNotifications() {
  const notifications = useFileOpNotificationStore((state) => state.notifications);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {notifications.map((notification) => (
        <Toast key={notification.id} notification={notification} />
      ))}
    </div>
  );
}

function Toast({ notification }: { notification: FileOpNotification }) {
  const removeNotification = useFileOpNotificationStore((state) => state.removeNotification);

  useEffect(() => {
    if (notification.status === "success") {
      const timer = setTimeout(() => removeNotification(notification.id), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification.status, notification.id, removeNotification]);

  const isProgress = notification.status === "running" && notification.progress !== undefined;

  return (
    <div className="w-80 rounded-lg border border-border bg-background shadow-lg">
      <div className="flex items-start gap-2.5 p-3">
        {notification.status === "running" ? (
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
        ) : notification.status === "success" ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
        ) : (
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        )}
        <p className="flex-1 text-xs leading-relaxed">{notification.message}</p>
        <button
          type="button"
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => removeNotification(notification.id)}
        >
          <X className="size-3.5" />
        </button>
      </div>

      {isProgress && notification.progress !== undefined && (
        <div className="px-3 pb-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${notification.progress}%` }}
            />
          </div>
        </div>
      )}

      {(notification.canCancel || notification.canRetry || notification.canOpenInFinder) && (
        <div className="flex items-center gap-1 border-t border-border px-3 py-2">
          {notification.canCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={() => cancelJob(notification)}>
              <X className="mr-1 size-3" /> Cancel
            </Button>
          )}
          {notification.canRetry && (
            <Button type="button" variant="ghost" size="sm" onClick={() => retryJob(notification)}>
              <RotateCcw className="mr-1 size-3" /> Retry
            </Button>
          )}
          {notification.canOpenInFinder && notification.destinationPath && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                import("@/services/s3/download").then((mod) =>
                  mod.openInFinder(notification.destinationPath!),
                );
                removeNotification(notification.id);
              }}
            >
              <FolderOpen className="mr-1 size-3" /> Open in Finder
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function cancelJob(notification: FileOpNotification) {
  const meta = notification.metadata;
  if (!meta?.jobId) return;

  if (meta.source === "upload") {
    import("@/stores/uploadStore").then(({ useUploadStore }) => {
      useUploadStore.getState().cancelUpload(meta.jobId!);
    });
  } else if (meta.source === "download") {
    import("@/stores/downloadStore").then(({ useDownloadStore }) => {
      useDownloadStore.getState().cancelDownload(meta.jobId!);
    });
  }
}

function retryJob(notification: FileOpNotification) {
  const meta = notification.metadata;
  if (!meta?.jobId || !meta.profileId) return;

  import("@/stores/connectionStore").then(({ useConnectionStore }) => {
    const profile = useConnectionStore.getState().profiles.find((p) => p.id === meta!.profileId);
    if (!profile) return;

    if (meta!.source === "upload") {
      import("@/stores/uploadStore").then(({ useUploadStore }) => {
        useUploadStore.getState().retryUpload(profile, meta!.jobId!);
      });
    } else if (meta!.source === "download") {
      import("@/stores/downloadStore").then(({ useDownloadStore }) => {
        useDownloadStore.getState().retryDownload(profile, meta!.jobId!);
      });
    }
  });
}
