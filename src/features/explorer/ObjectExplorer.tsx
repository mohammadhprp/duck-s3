import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronRight,
  Database,
  File,
  Folder,
  FolderOpen,
  RefreshCw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBucketStore } from "@/stores/bucketStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useObjectExplorerStore } from "@/stores/objectExplorerStore";
import type {
  ObjectExplorerSortDirection,
  ObjectExplorerSortField,
  S3ObjectFile,
  S3ObjectFolder,
} from "@/types/object";

type ExplorerRow =
  | { type: "folder"; folder: S3ObjectFolder; name: string }
  | { type: "file"; file: S3ObjectFile; name: string };

const sortLabels: Record<ObjectExplorerSortField, string> = {
  name: "Name",
  size: "Size",
  lastModified: "Last Modified",
  storageClass: "Storage Class",
};

export function ObjectExplorer() {
  const {
    activeProfileId,
    hydrated,
    hydrate,
    profiles,
    status: connectionStatus,
  } = useConnectionStore();
  const {
    buckets,
    selectedBucketName,
    status: bucketStatus,
    lastLoadedProfileId: lastLoadedBucketProfileId,
    selectBucket,
    refreshBuckets,
    resetBuckets,
  } = useBucketStore();
  const {
    currentBucketName,
    currentPrefix,
    page,
    status,
    lastMessage,
    lastLoadedProfileId,
    openPath,
    refreshCurrentPath,
    resetExplorer,
  } = useObjectExplorerStore();
  const [bucketSearchTerm, setBucketSearchTerm] = useState("");
  const [objectSearchTerm, setObjectSearchTerm] = useState("");
  const [sortField, setSortField] = useState<ObjectExplorerSortField>("name");
  const [sortDirection, setSortDirection] = useState<ObjectExplorerSortDirection>("asc");

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrate, hydrated]);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId),
    [activeProfileId, profiles],
  );

  useEffect(() => {
    if (!activeProfile) {
      resetBuckets();
      resetExplorer();
      return;
    }

    if (lastLoadedBucketProfileId !== activeProfile.id && bucketStatus !== "loading") {
      void refreshBuckets(activeProfile);
    }
  }, [
    activeProfile,
    bucketStatus,
    lastLoadedBucketProfileId,
    refreshBuckets,
    resetBuckets,
    resetExplorer,
  ]);

  const selectedBucket = selectedBucketName ?? buckets[0]?.name;

  useEffect(() => {
    if (!activeProfile || !selectedBucket) {
      return;
    }

    if (
      currentBucketName !== selectedBucket ||
      lastLoadedProfileId !== activeProfile.id ||
      (status === "idle" && !page)
    ) {
      void openPath(activeProfile, selectedBucket, "");
    }
  }, [
    activeProfile,
    currentBucketName,
    lastLoadedProfileId,
    openPath,
    page,
    selectedBucket,
    status,
  ]);

  const filteredBuckets = useMemo(() => {
    const normalizedSearchTerm = bucketSearchTerm.trim().toLowerCase();

    if (!normalizedSearchTerm) {
      return buckets;
    }

    return buckets.filter((bucket) => bucket.name.toLowerCase().includes(normalizedSearchTerm));
  }, [buckets, bucketSearchTerm]);

  const rows = useMemo(() => {
    const normalizedSearchTerm = objectSearchTerm.trim().toLowerCase();
    const folderRows: ExplorerRow[] = (page?.folders ?? []).map((folder) => ({
      type: "folder",
      folder,
      name: folder.name,
    }));
    const fileRows: ExplorerRow[] = (page?.files ?? []).map((file) => ({
      type: "file",
      file,
      name: file.name,
    }));

    return [...folderRows, ...fileRows]
      .filter(
        (row) => !normalizedSearchTerm || row.name.toLowerCase().includes(normalizedSearchTerm),
      )
      .sort((a, b) => compareRows(a, b, sortField, sortDirection));
  }, [objectSearchTerm, page, sortDirection, sortField]);

  const breadcrumbItems = useMemo(() => buildBreadcrumbItems(currentPrefix), [currentPrefix]);
  const isBusy = status === "loading" || bucketStatus === "loading";

  function handleSort(nextSortField: ObjectExplorerSortField) {
    if (sortField === nextSortField) {
      setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(nextSortField);
    setSortDirection("asc");
  }

  async function handleBucketSelect(bucketName: string) {
    selectBucket(bucketName);
    setObjectSearchTerm("");

    if (activeProfile) {
      await openPath(activeProfile, bucketName, "");
    }
  }

  async function handlePathOpen(prefix: string) {
    if (!activeProfile || !currentBucketName) {
      return;
    }

    setObjectSearchTerm("");
    await openPath(activeProfile, currentBucketName, prefix);
  }

  if (!activeProfile) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <section className="max-w-xl rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <FolderOpen className="mx-auto mb-4 size-10 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Connect before exploring objects
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The object explorer needs an active S3 profile before it can list buckets, folders, and
            files.
          </p>
          <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            {hydrated
              ? "No active profile is connected."
              : connectionStatus === "testing"
                ? "Loading connection state..."
                : "Preparing connection state..."}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="grid flex-1 grid-cols-[300px_minmax(0,1fr)] gap-6 p-6">
      <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Buckets</h2>
              <p className="mt-1 text-xs text-muted-foreground">{activeProfile.name}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isBusy}
              onClick={() => void refreshBuckets(activeProfile)}
              aria-label="Refresh buckets"
            >
              <RefreshCw className={`size-4 ${bucketStatus === "loading" ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <label className="relative block text-sm font-medium">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              placeholder="Search buckets"
              value={bucketSearchTerm}
              onChange={(event) => setBucketSearchTerm(event.target.value)}
              aria-label="Search buckets"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {filteredBuckets.length === 0 ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {buckets.length === 0
                ? "No buckets found for this profile."
                : "No buckets match your search."}
            </p>
          ) : (
            <nav className="space-y-2" aria-label="Explorer bucket sidebar">
              {filteredBuckets.map((bucket) => (
                <button
                  key={bucket.name}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
                    bucket.name === currentBucketName
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                  onClick={() => void handleBucketSelect(bucket.name)}
                >
                  <Database className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{bucket.name}</span>
                </button>
              ))}
            </nav>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Object explorer
              </p>
              <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight">
                {currentBucketName ? `s3://${currentBucketName}` : "Choose a bucket"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Browse S3 prefixes as folders, search the current folder, and sort object metadata.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy || !currentBucketName}
              onClick={() => void refreshCurrentPath(activeProfile)}
            >
              <RefreshCw className={`mr-2 size-4 ${status === "loading" ? "animate-spin" : ""}`} />
              Refresh path
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <Button
              type="button"
              variant={currentPrefix ? "outline" : "secondary"}
              size="sm"
              disabled={!currentBucketName || isBusy}
              onClick={() => void handlePathOpen("")}
            >
              Root
            </Button>
            {breadcrumbItems.map((item) => (
              <div key={item.prefix} className="flex items-center gap-2">
                <ChevronRight className="size-4 text-muted-foreground" />
                <Button
                  type="button"
                  variant={item.prefix === currentPrefix ? "secondary" : "outline"}
                  size="sm"
                  disabled={isBusy}
                  onClick={() => void handlePathOpen(item.prefix)}
                >
                  {item.name}
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <label className="relative block text-sm font-medium">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                placeholder="Search current folder"
                value={objectSearchTerm}
                onChange={(event) => setObjectSearchTerm(event.target.value)}
                aria-label="Search objects"
              />
            </label>
            <p className="text-sm text-muted-foreground">
              {page
                ? `${page.folderCount} folder${page.folderCount === 1 ? "" : "s"} · ${page.objectCount} file${page.objectCount === 1 ? "" : "s"} · ${page.pageCount} S3 page${page.pageCount === 1 ? "" : "s"}`
                : "No path loaded yet."}
            </p>
          </div>

          {lastMessage ? (
            <p className="mt-4 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              {lastMessage}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {!currentBucketName ? (
            <EmptyExplorerState
              icon={Database}
              title="No bucket selected"
              description="Choose a bucket from the sidebar to start browsing objects."
            />
          ) : rows.length === 0 ? (
            <EmptyExplorerState
              icon={FolderOpen}
              title={objectSearchTerm ? "No matching objects" : "This folder is empty"}
              description={
                objectSearchTerm
                  ? "Clear the current-folder search to see all folders and files in this path."
                  : "S3 returned no common prefixes or objects for this prefix."
              }
            />
          ) : (
            <table className="w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-lg border border-border text-sm">
              <thead className="bg-muted/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {(["name", "size", "lastModified", "storageClass"] as const).map((field) => (
                    <th key={field} className="border-b border-border px-4 py-3 font-medium">
                      <button
                        type="button"
                        className="flex items-center gap-2 hover:text-foreground"
                        onClick={() => handleSort(field)}
                      >
                        {sortLabels[field]}
                        <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.type === "folder" ? row.folder.prefix : row.file.key}
                    className="bg-background"
                  >
                    <td className="border-b border-border px-4 py-3">
                      {row.type === "folder" ? (
                        <button
                          type="button"
                          className="flex min-w-0 items-center gap-3 text-left font-medium text-primary hover:underline"
                          disabled={isBusy}
                          onClick={() => void handlePathOpen(row.folder.prefix)}
                        >
                          <Folder className="size-4 shrink-0" />
                          <span className="truncate">{row.name}/</span>
                        </button>
                      ) : (
                        <div className="flex min-w-0 items-center gap-3">
                          <File className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium">{row.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="border-b border-border px-4 py-3 text-muted-foreground">
                      {row.type === "folder" ? "—" : formatBytes(row.file.size)}
                    </td>
                    <td className="border-b border-border px-4 py-3 text-muted-foreground">
                      {row.type === "folder" ? "—" : formatDate(row.file.lastModified)}
                    </td>
                    <td className="border-b border-border px-4 py-3 text-muted-foreground">
                      {row.type === "folder" ? "Folder" : (row.file.storageClass ?? "Standard")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyExplorerState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FolderOpen;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
      <Icon className="mx-auto mb-4 size-8 text-muted-foreground" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function buildBreadcrumbItems(prefix: string) {
  const parts = prefix.split("/").filter(Boolean);

  return parts.map((part, index) => ({
    name: part,
    prefix: `${parts.slice(0, index + 1).join("/")}/`,
  }));
}

function compareRows(
  a: ExplorerRow,
  b: ExplorerRow,
  sortField: ObjectExplorerSortField,
  sortDirection: ObjectExplorerSortDirection,
): number {
  if (a.type !== b.type && sortField === "name") {
    return a.type === "folder" ? -1 : 1;
  }

  const directionMultiplier = sortDirection === "asc" ? 1 : -1;
  const comparison = compareRowValues(a, b, sortField);

  if (comparison === 0 && a.type !== b.type) {
    return a.type === "folder" ? -1 : 1;
  }

  return comparison * directionMultiplier;
}

function compareRowValues(
  a: ExplorerRow,
  b: ExplorerRow,
  sortField: ObjectExplorerSortField,
): number {
  switch (sortField) {
    case "size":
      return getRowSize(a) - getRowSize(b);
    case "lastModified":
      return getRowModifiedTime(a) - getRowModifiedTime(b);
    case "storageClass":
      return getRowStorageClass(a).localeCompare(getRowStorageClass(b));
    case "name":
    default:
      return a.name.localeCompare(b.name);
  }
}

function getRowSize(row: ExplorerRow): number {
  return row.type === "file" ? row.file.size : -1;
}

function getRowModifiedTime(row: ExplorerRow): number {
  return row.type === "file" && row.file.lastModified
    ? new Date(row.file.lastModified).getTime()
    : 0;
}

function getRowStorageClass(row: ExplorerRow): string {
  return row.type === "file" ? (row.file.storageClass ?? "Standard") : "Folder";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
