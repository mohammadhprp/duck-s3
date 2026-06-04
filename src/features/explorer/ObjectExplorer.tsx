import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  RefreshCw,
  Search,
  ArrowLeft,
} from "lucide-react";

import { Button } from "@cloudflare/kumo/components/button";
import { useConnectionStore } from "@/stores/connectionStore";
import { useObjectExplorerStore } from "@/stores/objectExplorerStore";
import type {
  ObjectExplorerSortDirection,
  ObjectExplorerSortField,
  S3ObjectFile,
  S3ObjectFolder,
} from "@/types/object";
import { UploadTrigger } from "./UploadTrigger";

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
  const { activeProfileId, profiles } = useConnectionStore();
  const { currentBucketName, currentPrefix, page, status, openPath, refreshCurrentPath } =
    useObjectExplorerStore();
  const [objectSearchTerm, setObjectSearchTerm] = useState("");
  const [sortField, setSortField] = useState<ObjectExplorerSortField>("name");
  const [sortDirection, setSortDirection] = useState<ObjectExplorerSortDirection>("asc");

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId),
    [activeProfileId, profiles],
  );

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
  const isBusy = status === "loading";

  function handleSort(nextSortField: ObjectExplorerSortField) {
    if (sortField === nextSortField) {
      setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(nextSortField);
    setSortDirection("asc");
  }

  async function handlePathOpen(prefix: string) {
    if (!activeProfile || !currentBucketName) {
      return;
    }

    setObjectSearchTerm("");
    await openPath(activeProfile, currentBucketName, prefix);
  }

  async function handleGoUp() {
    if (!currentPrefix || !activeProfile || !currentBucketName) {
      return;
    }

    const parts = currentPrefix.split("/").filter(Boolean);
    parts.pop();
    const parentPrefix = parts.length > 0 ? parts.join("/") + "/" : "";
    await handlePathOpen(parentPrefix);
  }

  if (!activeProfile) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <FolderOpen className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Select a connection</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a connection from the sidebar to start browsing files.
          </p>
        </div>
      </div>
    );
  }

  if (!currentBucketName) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <FolderOpen className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No bucket selected</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a bucket from the bucket panel to browse its contents.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="flex h-full min-w-0 flex-col bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{currentBucketName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <UploadTrigger />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => void refreshCurrentPath(activeProfile)}
            >
              <RefreshCw className={`size-3 ${status === "loading" ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {currentPrefix && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => void handleGoUp()}
            >
              <ArrowLeft className="mr-1 size-3" /> Up
            </Button>
          )}
          <Button
            type="button"
            variant={!currentPrefix ? "secondary" : "ghost"}
            size="sm"
            disabled={isBusy}
            onClick={() => void handlePathOpen("")}
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
                disabled={isBusy}
                onClick={() => void handlePathOpen(item.prefix)}
              >
                {item.name}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <label className="relative block flex-1 text-sm font-medium">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              placeholder="Search current folder"
              value={objectSearchTerm}
              onChange={(event) => setObjectSearchTerm(event.target.value)}
            />
          </label>
          <p className="shrink-0 text-xs text-muted-foreground">
            {page
              ? `${page.folderCount} folder${page.folderCount === 1 ? "" : "s"} · ${page.objectCount} file${page.objectCount === 1 ? "" : "s"}`
              : "Loading..."}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="text-center">
              <FolderOpen className="mx-auto mb-4 size-8 text-muted-foreground" />
              <h3 className="text-sm font-semibold">
                {objectSearchTerm ? "No matching objects" : "This folder is empty"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {objectSearchTerm
                  ? "Clear the search to see all items."
                  : "S3 returned no common prefixes or objects for this path."}
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 bg-muted/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {(["name", "size", "lastModified", "storageClass"] as const).map((field) => (
                  <th key={field} className="border-b border-border px-4 py-2.5 font-medium">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 hover:text-foreground"
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
                  className="bg-background transition hover:bg-accent/50"
                >
                  <td className="border-b border-border px-4 py-2.5">
                    {row.type === "folder" ? (
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-2 text-left font-medium text-primary hover:underline"
                        disabled={isBusy}
                        onClick={() => void handlePathOpen(row.folder.prefix)}
                      >
                        <Folder className="size-4 shrink-0" />
                        <span className="truncate">{row.name}</span>
                      </button>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <File className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{row.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="border-b border-border px-4 py-2.5 text-muted-foreground">
                    {row.type === "folder" ? "—" : formatBytes(row.file.size)}
                  </td>
                  <td className="border-b border-border px-4 py-2.5 text-muted-foreground">
                    {row.type === "folder" ? "—" : formatDate(row.file.lastModified)}
                  </td>
                  <td className="border-b border-border px-4 py-2.5 text-muted-foreground">
                    {row.type === "folder" ? "Folder" : (row.file.storageClass ?? "Standard")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
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
