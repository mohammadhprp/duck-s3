import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FolderOpen,
  Trash2,
  X,
  RotateCcw,
} from "lucide-react";

import { Button } from "@cloudflare/kumo/components/button";
import { useDownloadStore } from "@/stores/downloadStore";
import type { DownloadJob } from "@/types/download";

export function DownloadPanel() {
  const { jobs, lastMessage, clearFinished, cancelDownload, retryDownload, openInFinderForJob } =
    useDownloadStore();
  const [isExpanded, setIsExpanded] = useState(true);

  if (jobs.length === 0) {
    return null;
  }

  const activeJobs = jobs.filter((j) => j.status === "downloading");
  const queuedJobs = jobs.filter((j) => j.status === "queued");
  const finishedJobs = jobs.filter((j) => ["completed", "failed", "canceled"].includes(j.status));

  return (
    <div className="border-t border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium hover:text-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
            Downloads
          </button>
          <span className="text-xs text-muted-foreground">
            {activeJobs.length > 0 && `${activeJobs.length} active`}
            {activeJobs.length > 0 && queuedJobs.length > 0 && " · "}
            {queuedJobs.length > 0 && `${queuedJobs.length} queued`}
            {(activeJobs.length > 0 || queuedJobs.length > 0) && finishedJobs.length > 0 && " · "}
            {finishedJobs.length > 0 && `${finishedJobs.length} finished`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {finishedJobs.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => clearFinished()}
            >
              <Trash2 className="size-3" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <X className="size-3" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="max-h-48 overflow-y-auto">
          {jobs.map((job) => (
            <DownloadJobRow
              key={job.id}
              job={job}
              onCancel={() => cancelDownload(job.id)}
              onRetry={() => retryDownload({
                ...job.profile,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }, job.id)}
              onOpenInFinder={() => openInFinderForJob(job.id)}
            />
          ))}
          {lastMessage && (
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {lastMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DownloadJobRow({
  job,
  onCancel,
  onRetry,
  onOpenInFinder,
}: {
  job: DownloadJob;
  onCancel: () => void;
  onRetry: () => void;
  onOpenInFinder: () => void;
}) {
  const fileName = job.isFolder
    ? job.key.split("/").filter(Boolean).pop() || "folder"
    : job.key.split("/").pop() || job.key;

  const statusIcon = getStatusIcon(job.status);
  const statusColor = getStatusColor(job.status);

  return (
    <div className="border-b border-border/50 px-4 py-2">
      <div className="flex items-center gap-2">
        {statusIcon}
        <span className="truncate text-xs font-medium">{fileName}</span>
        <span className={`ml-auto shrink-0 text-xs ${statusColor}`}>{statusLabel(job.status)}</span>
      </div>
      {job.status === "downloading" && (
        <div className="mt-1.5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{job.progress}%</span>
            <span>
              {formatBytes(job.downloadedBytes)} / {formatBytes(job.totalBytes)}
            </span>
          </div>
        </div>
      )}
      {job.status === "queued" && (
        <div className="mt-1.5 flex items-center gap-1">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      )}
      {job.status === "downloading" && (
        <div className="mt-1.5 flex items-center gap-1">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      )}
      {job.status === "failed" && (
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={onRetry}
          >
            <RotateCcw className="size-3" /> Retry
          </button>
          {job.error && (
            <span className="text-xs text-destructive">{job.error}</span>
          )}
        </div>
      )}
      {job.status === "completed" && (
        <div className="mt-1.5 flex items-center gap-1">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={onOpenInFinder}
          >
            <FolderOpen className="size-3" /> Open in Finder
          </button>
        </div>
      )}
    </div>
  );
}

function getStatusIcon(status: string) {
  switch (status) {
    case "downloading":
      return <Download className="size-3 text-primary animate-pulse" />;
    case "completed":
      return <Download className="size-3 text-green-500" />;
    case "failed":
      return <X className="size-3 text-destructive" />;
    case "canceled":
      return <X className="size-3 text-muted-foreground" />;
    case "queued":
      return <Download className="size-3 text-muted-foreground" />;
    default:
      return null;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "downloading":
      return "text-primary";
    case "completed":
      return "text-green-500";
    case "failed":
      return "text-destructive";
    case "canceled":
      return "text-muted-foreground";
    case "queued":
      return "text-muted-foreground";
    default:
      return "";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "downloading":
      return "Downloading";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    case "queued":
      return "Queued";
    default:
      return status;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
