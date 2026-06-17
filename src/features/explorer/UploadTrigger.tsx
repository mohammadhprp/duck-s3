import { useEffect, useRef, useState } from "react";
import { ChevronDown, File, Folder, Upload } from "lucide-react";

import { Button } from "@cloudflare/kumo/components/button";
import { useConnectionStore } from "@/stores/connectionStore";
import { useObjectExplorerStore } from "@/stores/objectExplorerStore";
import { useUploadStore } from "@/stores/uploadStore";
import type { UploadSelection } from "@/types/upload";

export function UploadTrigger() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const { activeProfileId, profiles } = useConnectionStore();
  const { currentBucketName, currentPrefix, refreshCurrentPath } = useObjectExplorerStore();
  const { activeCount, enqueueUploads } = useUploadStore();

  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const canUpload = Boolean(activeProfile && currentBucketName);

  const prevActiveCountRef = useRef(activeCount);

  useEffect(() => {
    if (prevActiveCountRef.current > 0 && activeCount === 0 && activeProfile && currentBucketName) {
      void refreshCurrentPath(activeProfile);
    }
    prevActiveCountRef.current = activeCount;
  }, [activeCount, activeProfile, currentBucketName, refreshCurrentPath]);

  function queueUploads(selections: UploadSelection[]) {
    if (!activeProfile || !currentBucketName || selections.length === 0) return;
    enqueueUploads({
      profile: activeProfile,
      bucketName: currentBucketName,
      prefix: currentPrefix,
      selections,
    });
    setMenuOpen(false);
  }

  if (!canUpload) return null;

  return (
    <div
      className="relative"
      onDragEnter={(e) => {
        e.preventDefault();
        e.currentTarget.classList.add("ring-2", "ring-primary");
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.currentTarget.classList.remove("ring-2", "ring-primary");
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("ring-2", "ring-primary");
        queueUploads(selectionsFromFileList(e.dataTransfer.files));
      }}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          <Button type="button" size="sm" onClick={() => setMenuOpen(!menuOpen)}>
            <Upload className="mr-1.5 size-3.5" /> Upload
            <ChevronDown className="ml-1 size-3" />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-border bg-background py-1 shadow-xl">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                  onClick={() => {
                    setMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  <File className="size-3.5" /> Upload files
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                  onClick={() => {
                    setMenuOpen(false);
                    folderInputRef.current?.click();
                  }}
                >
                  <Folder className="size-3.5" /> Upload folder
                </button>
              </div>
            </>
          )}
        </div>
        {activeCount > 0 && (
          <span className="text-xs text-muted-foreground">{activeCount} uploading...</span>
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
