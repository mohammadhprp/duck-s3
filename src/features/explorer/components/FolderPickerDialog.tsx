import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Folder, Loader2, X } from "lucide-react";

import { Button } from "@cloudflare/kumo/components/button";
import { listObjects } from "@/services/s3/client";
import type { ConnectionProfile } from "@/features/connections/types/connection";
import type { S3ObjectFolder } from "@/features/explorer/types/object";

interface FolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ConnectionProfile;
  bucketName: string;
  title: string;
  onSelect: (prefix: string) => void;
}

export function FolderPickerDialog({
  open,
  onOpenChange,
  profile,
  bucketName,
  title,
  onSelect,
}: FolderPickerDialogProps) {
  const [currentPrefix, setCurrentPrefix] = useState("");
  const [folders, setFolders] = useState<S3ObjectFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCurrentPrefix("");
    setFolders([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listObjects(profile, bucketName, currentPrefix)
      .then((page) => {
        if (!cancelled) {
          setFolders(page.folders);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load folders");
          setFolders([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, currentPrefix, profile, bucketName]);

  const breadcrumbItems = useMemo(() => {
    const parts = currentPrefix.split("/").filter(Boolean);
    return parts.map((part, index) => ({
      name: part,
      prefix: `${parts.slice(0, index + 1).join("/")}/`,
    }));
  }, [currentPrefix]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2 text-xs">
          <Button
            type="button"
            variant={currentPrefix === "" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCurrentPrefix("")}
          >
            Root
          </Button>
          {breadcrumbItems.map((item) => (
            <div key={item.prefix} className="flex items-center gap-1">
              <ChevronRight className="size-3 text-muted-foreground" />
              <Button
                type="button"
                variant={item.prefix === currentPrefix ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setCurrentPrefix(item.prefix)}
              >
                {item.name}
              </Button>
            </div>
          ))}
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : folders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No subfolders</p>
          ) : (
            folders.map((folder) => (
              <button
                key={folder.prefix}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => setCurrentPrefix(folder.prefix)}
              >
                <Folder className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{folder.name}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="truncate text-xs text-muted-foreground">
            Selected: <span className="font-mono">{currentPrefix || "(root)"}</span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onSelect(currentPrefix);
                onOpenChange(false);
              }}
            >
              Select this folder
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
