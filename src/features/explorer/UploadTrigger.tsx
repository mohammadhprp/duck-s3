import { useRef, useState } from "react";
import { Upload, X, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@cloudflare/kumo/components/button";
import { useConnectionStore } from "@/stores/connectionStore";
import { useObjectExplorerStore } from "@/stores/objectExplorerStore";
import { useUploadStore } from "@/stores/uploadStore";
import type { UploadSelection } from "@/types/upload";

export function UploadTrigger() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const { activeProfileId, profiles } = useConnectionStore();
  const { currentBucketName, currentPrefix, refreshCurrentPath } = useObjectExplorerStore();
  const { jobs, activeCount, enqueueUploads, cancelUpload, retryUpload, clearFinished } =
    useUploadStore();

  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const canUpload = Boolean(activeProfile && currentBucketName);

  function queueUploads(selections: UploadSelection[]) {
    if (!activeProfile || !currentBucketName || selections.length === 0) return;
    enqueueUploads({
      profile: activeProfile,
      bucketName: currentBucketName,
      prefix: currentPrefix,
      selections,
    });
    setShowProgress(true);
  }

  const finishedJobs = jobs.filter((j) => ["completed", "failed", "canceled"].includes(j.status));

  if (!canUpload) return null;

  return (
    <>
      <div
        className="relative"
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          queueUploads(selectionsFromFileList(e.dataTransfer.files));
        }}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10">
            <div className="text-center">
              <Upload className="mx-auto size-8 text-primary" />
              <p className="mt-2 text-sm font-medium text-primary">Drop files to upload</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-1.5 size-3.5" /> Upload
          </Button>
          {activeCount > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowProgress(!showProgress)}
            >
              {activeCount} uploading...
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            queueUploads(selectionsFromFileList(e.target.files));
            e.currentTarget.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          // @ts-expect-error React types don't include webkitdirectory
          webkitdirectory="true"
          onChange={(e) => {
            queueUploads(selectionsFromFileList(e.target.files));
            e.currentTarget.value = "";
          }}
        />
      </div>

      {showProgress && jobs.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Upload queue</h3>
            <div className="flex items-center gap-2">
              {finishedJobs.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearFinished();
                    if (activeProfile && currentBucketName) void refreshCurrentPath(activeProfile);
                  }}
                >
                  Clear finished
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                shape="square"
                aria-label="Close upload queue"
                onClick={() => setShowProgress(false)}
              >
                <X className="size-3" />
              </Button>
            </div>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {jobs.slice(0, 10).map((job) => (
              <div key={job.id} className="flex items-center gap-2 text-xs">
                {job.status === "completed" ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                ) : job.status === "failed" || job.status === "canceled" ? (
                  <XCircle className="size-3.5 shrink-0 text-destructive" />
                ) : (
                  <Upload className="size-3.5 shrink-0 text-primary" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">
                  {job.key.split("/").pop()}
                </span>
                <span className="shrink-0 text-muted-foreground">{job.progress}%</span>
                {job.status === "uploading" || job.status === "queued" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => cancelUpload(job.id)}
                  >
                    <X className="size-3" />
                  </Button>
                ) : job.status === "failed" || job.status === "canceled" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => activeProfile && retryUpload(activeProfile, job.id)}
                  >
                    <RotateCcw className="size-3" />
                  </Button>
                ) : null}
              </div>
            ))}
            {jobs.length > 10 && (
              <p className="text-center text-muted-foreground">+{jobs.length - 10} more</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function selectionsFromFileList(fileList: FileList | null): UploadSelection[] {
  return Array.from(fileList ?? []).map((file) => ({ file, relativePath: getRelativePath(file) }));
}

function getRelativePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}
