import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FolderUp, RefreshCw, RotateCcw, Upload, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBucketStore } from "@/stores/bucketStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useObjectExplorerStore } from "@/stores/objectExplorerStore";
import { useUploadStore } from "@/stores/uploadStore";
import type { UploadSelection } from "@/types/upload";

export function UploadPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { activeProfileId, hydrated, hydrate, profiles } = useConnectionStore();
  const { selectedBucketName } = useBucketStore();
  const { currentBucketName, currentPrefix, refreshCurrentPath } = useObjectExplorerStore();
  const {
    jobs,
    activeCount,
    lastMessage,
    enqueueUploads,
    cancelUpload,
    retryUpload,
    clearFinished,
  } = useUploadStore();

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrate, hydrated]);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId),
    [activeProfileId, profiles],
  );
  const targetBucket = currentBucketName ?? selectedBucketName;
  const canUpload = Boolean(activeProfile && targetBucket);
  const completedCount = jobs.filter((job) => job.status === "completed").length;
  const failedCount = jobs.filter((job) => job.status === "failed").length;

  function queueUploads(selections: UploadSelection[]) {
    if (!activeProfile || !targetBucket || selections.length === 0) {
      return;
    }

    enqueueUploads({
      profile: activeProfile,
      bucketName: targetBucket,
      prefix: currentPrefix,
      selections,
    });
  }

  async function refreshExplorerAfterUploads() {
    if (activeProfile && currentBucketName) {
      await refreshCurrentPath(activeProfile);
    }
  }

  return (
    <div
      className="flex flex-1 flex-col gap-6 p-6"
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          setIsDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        queueUploads(selectionsFromFileList(event.dataTransfer.files));
      }}
    >
      <section
        className={`rounded-xl border border-dashed bg-card p-8 shadow-sm transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Upload className="size-6" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Upload files and folders</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Drop files here or pick a file/folder. Uploads target{" "}
              {targetBucket ? "bucket" : "a selected bucket"}{" "}
              <span className="font-medium text-foreground">
                {targetBucket ?? "No bucket selected"}
              </span>
              {currentPrefix ? ` under ${currentPrefix}` : " at the bucket root"}.
            </p>
            {!canUpload ? (
              <p className="mt-3 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                Connect to S3 and select a bucket before uploading.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={!canUpload}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 size-4" /> Upload file
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!canUpload}
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderUp className="mr-2 size-4" /> Upload folder
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!activeProfile || !currentBucketName}
              onClick={() => void refreshExplorerAfterUploads()}
            >
              <RefreshCw className="mr-2 size-4" /> Refresh explorer
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            queueUploads(selectionsFromFileList(event.target.files));
            event.currentTarget.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          // @ts-expect-error React's DOM types do not expose the Chromium folder picker attribute.
          webkitdirectory="true"
          onChange={(event) => {
            queueUploads(selectionsFromFileList(event.target.files));
            event.currentTarget.value = "";
          }}
        />
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Upload queue</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCount} active · {completedCount} completed · {failedCount} failed
              {lastMessage ? ` · ${lastMessage}` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={jobs.length === activeCount}
            onClick={clearFinished}
          >
            Clear finished
          </Button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No uploads queued yet. Drag files into this page to start.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {jobs.map((job) => (
              <article
                key={job.id}
                className="grid gap-4 p-5 lg:grid-cols-[1fr_180px_180px] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {job.status === "completed" ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : job.status === "failed" || job.status === "canceled" ? (
                      <XCircle className="size-4 text-destructive" />
                    ) : (
                      <Upload className="size-4 text-primary" />
                    )}
                    <h4 className="truncate text-sm font-medium">{job.key}</h4>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatBytes(job.uploadedBytes)} / {formatBytes(job.totalBytes)} · {job.status}
                    {job.error ? ` · ${job.error}` : ""}
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">{job.progress}% complete</p>

                <div className="flex justify-start gap-2 lg:justify-end">
                  {job.status === "uploading" || job.status === "queued" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => cancelUpload(job.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  {job.status === "failed" || job.status === "canceled" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!activeProfile}
                      onClick={() => activeProfile && retryUpload(activeProfile, job.id)}
                    >
                      <RotateCcw className="mr-2 size-3" /> Retry
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function selectionsFromFileList(fileList: FileList | null): UploadSelection[] {
  return Array.from(fileList ?? []).map((file) => ({
    file,
    relativePath: getRelativePath(file),
  }));
}

function getRelativePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
