import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  ChevronRight,
  File,
  FileSymlink,
  Folder,
  FolderOpen,
  RefreshCw,
  Search,
  ArrowLeft,
  Download,
  Trash2,
  Pencil,
  Copy,
  FolderPlus,
  MoreHorizontal,
} from "lucide-react";

import { Button } from "@cloudflare/kumo/components/button";
import { useConnectionStore } from "@/features/connections/stores/connectionStore";
import { useObjectExplorerStore } from "@/features/explorer/stores/objectExplorerStore";
import { useDownloadStore } from "@/features/explorer/stores/downloadStore";
import {
  deleteObject,
  deleteObjects,
  copyObject,
  createFolder,
  listAllKeys,
} from "@/services/s3/client";
import type {
  ObjectExplorerSortDirection,
  ObjectExplorerSortField,
  S3ObjectFile,
  S3ObjectFolder,
} from "@/features/explorer/types/object";
import { UploadTrigger } from "./UploadTrigger";
import { FolderPickerDialog } from "./FolderPickerDialog";
import { PreviewModal } from "./PreviewModal";
import { useFileOpNotificationStore } from "@/features/explorer/stores/fileOpNotificationStore";
import { usePreviewStore } from "@/features/explorer/stores/previewStore";
import { useDebounce, useKeyboardShortcuts } from "@/shared/hooks";
import { CommandPaletteTrigger } from "@/shared/components/CommandPaletteTrigger";

type ExplorerRow =
  | { type: "folder"; folder: S3ObjectFolder; name: string }
  | { type: "file"; file: S3ObjectFile; name: string };

type DialogState =
  | { type: "none" }
  | { type: "confirmDelete"; key: string; name: string; isFolder: boolean }
  | { type: "confirmBulkDelete"; keys: string[]; count: number }
  | { type: "rename"; key: string; name: string }
  | { type: "move"; key: string; name: string }
  | { type: "copy"; key: string; name: string }
  | { type: "createFolder" };

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
  const { enqueueDownloads } = useDownloadStore();
  const [objectSearchTerm, setObjectSearchTerm] = useState("");
  const debouncedSearch = useDebounce(objectSearchTerm, 200);
  const [sortField, setSortField] = useState<ObjectExplorerSortField>("name");
  const [sortDirection, setSortDirection] = useState<ObjectExplorerSortDirection>("asc");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [promptValue, setPromptValue] = useState("");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    row: ExplorerRow;
    rowKey: string;
    x: number;
    y: number;
  } | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [folderPickerFor, setFolderPickerFor] = useState<"move" | "copy" | null>(null);
  const { addNotification, updateNotification } = useFileOpNotificationStore();
  const { openPreview, loadContent: loadPreviewContent } = usePreviewStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId),
    [activeProfileId, profiles],
  );

  const handleContextMenuAction = useCallback(
    (action: string) => {
      if (!contextMenu) return;
      const { row, rowKey } = contextMenu;
      setContextMenu(null);

      switch (action) {
        case "preview":
          if (row.type === "file") {
            openPreview({ key: row.file.key, name: row.name });
            if (activeProfile && currentBucketName) {
              void loadPreviewContent(activeProfile, currentBucketName);
            }
          }
          break;
        case "rename":
          setDialog({ type: "rename", key: rowKey, name: row.name });
          setPromptValue(row.name);
          break;
        case "copy":
          setDialog({ type: "copy", key: rowKey, name: row.name });
          setPromptValue("");
          break;
        case "move":
          setDialog({ type: "move", key: rowKey, name: row.name });
          setPromptValue("");
          break;
        case "download":
          if (row.type === "folder") {
            if (activeProfile && currentBucketName) {
              enqueueDownloads({
                profile: activeProfile,
                bucketName: currentBucketName,
                selections: [{ key: row.folder.prefix, name: row.name, isFolder: true }],
              });
            }
          } else {
            if (activeProfile && currentBucketName) {
              enqueueDownloads({
                profile: activeProfile,
                bucketName: currentBucketName,
                selections: [
                  { key: row.file.key, name: row.name, isFolder: false, size: row.file.size },
                ],
              });
            }
          }
          break;
        case "delete":
          setDialog({
            type: "confirmDelete",
            key: rowKey,
            name: row.name,
            isFolder: row.type === "folder",
          });
          break;
      }
    },
    [
      contextMenu,
      activeProfile,
      currentBucketName,
      openPreview,
      loadPreviewContent,
      enqueueDownloads,
    ],
  );

  useKeyboardShortcuts([
    {
      key: "Escape",
      handler: () => {
        if (contextMenu) {
          setContextMenu(null);
        } else if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (activeMenu) {
          setActiveMenu(null);
        }
      },
    },
    {
      key: "k",
      meta: true,
      handler: () => {
        setCommandPaletteOpen((prev) => !prev);
      },
    },
    {
      key: "r",
      meta: true,
      handler: () => {
        if (activeProfile) void refreshCurrentPath(activeProfile);
      },
    },
    {
      key: "f",
      meta: true,
      handler: () => {
        searchInputRef.current?.focus();
      },
    },
    {
      key: "Backspace",
      alt: true,
      handler: () => {
        void handleGoUp();
      },
    },
  ]);
  const rows = useMemo(() => {
    const normalizedSearchTerm = debouncedSearch.trim().toLowerCase();
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
  }, [debouncedSearch, page, sortDirection, sortField]);

  const breadcrumbItems = useMemo(() => buildBreadcrumbItems(currentPrefix), [currentPrefix]);
  const isBusy = status === "loading";

  const allKeysOnPage = useMemo(() => {
    const keys: string[] = [];
    for (const row of rows) {
      keys.push(row.type === "folder" ? row.folder.prefix : row.file.key);
    }
    return keys;
  }, [rows]);

  const allSelected = allKeysOnPage.length > 0 && allKeysOnPage.every((k) => selectedKeys.has(k));

  function toggleSelect(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(allKeysOnPage));
    }
  }

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
    setSelectedKeys(new Set());
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

  function handleDownloadFile(file: S3ObjectFile) {
    if (!activeProfile || !currentBucketName) {
      return;
    }

    enqueueDownloads({
      profile: activeProfile,
      bucketName: currentBucketName,
      selections: [{ key: file.key, name: file.name, isFolder: false, size: file.size }],
    });
  }

  function handleDownloadFolder(folder: S3ObjectFolder) {
    if (!activeProfile || !currentBucketName) {
      return;
    }

    enqueueDownloads({
      profile: activeProfile,
      bucketName: currentBucketName,
      selections: [{ key: folder.prefix, name: folder.name, isFolder: true }],
    });
  }

  async function handleConfirmDelete() {
    if (dialog.type !== "confirmDelete") return;

    const { key, name, isFolder } = dialog;
    const notifId = addNotification({
      message: `Deleting ${isFolder ? "folder" : "file"} "${name}"...`,
      status: "running",
    });
    setDialog({ type: "none" });
    setActiveMenu(null);

    if (!activeProfile || !currentBucketName) return;

    try {
      if (isFolder) {
        const keys = await listAllKeys(activeProfile, currentBucketName, key);
        if (keys.length > 0) {
          await deleteObjects(activeProfile, currentBucketName, keys);
        }
        await deleteObject(activeProfile, currentBucketName, key);
      } else {
        await deleteObject(activeProfile, currentBucketName, key);
      }
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      updateNotification(notifId, {
        message: `Deleted ${isFolder ? "folder" : "file"} "${name}"`,
        status: "success",
      });
      await refreshCurrentPath(activeProfile);
    } catch {
      updateNotification(notifId, {
        message: `Failed to delete "${name}"`,
        status: "error",
      });
    }
  }

  async function handleConfirmBulkDelete() {
    if (dialog.type !== "confirmBulkDelete") return;

    const { keys, count } = dialog;
    const notifId = addNotification({
      message: `Deleting ${count} object${count === 1 ? "" : "s"}...`,
      status: "running",
    });
    setDialog({ type: "none" });

    if (!activeProfile || !currentBucketName) return;

    try {
      await deleteObjects(activeProfile, currentBucketName, keys);
      setSelectedKeys(new Set());
      updateNotification(notifId, {
        message: `Deleted ${count} object${count === 1 ? "" : "s"}`,
        status: "success",
      });
      await refreshCurrentPath(activeProfile);
    } catch {
      updateNotification(notifId, {
        message: `Failed to delete ${count} object${count === 1 ? "" : "s"}`,
        status: "error",
      });
    }
  }

  async function handleConfirmRename() {
    if (dialog.type !== "rename") return;

    const newName = promptValue.trim();
    if (!newName) return;

    const { name } = dialog;
    const notifId = addNotification({ message: `Renaming "${name}"...`, status: "running" });

    const oldKey = dialog.key;
    const prefix = oldKey.includes("/") ? oldKey.substring(0, oldKey.lastIndexOf("/") + 1) : "";
    const newKey = `${prefix}${newName}`;

    setDialog({ type: "none" });
    setPromptValue("");
    setActiveMenu(null);

    if (!activeProfile || !currentBucketName) return;

    try {
      await copyObject(activeProfile, currentBucketName, oldKey, currentBucketName, newKey);
      await deleteObject(activeProfile, currentBucketName, oldKey);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(oldKey);
        return next;
      });
      updateNotification(notifId, {
        message: `Renamed "${name}" to "${newName}"`,
        status: "success",
      });
      await refreshCurrentPath(activeProfile);
    } catch {
      updateNotification(notifId, {
        message: `Failed to rename "${name}"`,
        status: "error",
      });
    }
  }

  async function handleConfirmMove() {
    if (dialog.type !== "move") return;

    const targetPrefix = promptValue.trim().replace(/\/?$/, "/");
    if (!targetPrefix) return;

    const { name } = dialog;
    const notifId = addNotification({ message: `Moving "${name}"...`, status: "running" });

    const oldKey = dialog.key;
    const fileName = oldKey.split("/").pop() || "";
    const newKey = `${targetPrefix}${fileName}`;

    setDialog({ type: "none" });
    setPromptValue("");
    setActiveMenu(null);

    if (!activeProfile || !currentBucketName) return;

    try {
      await copyObject(activeProfile, currentBucketName, oldKey, currentBucketName, newKey);
      await deleteObject(activeProfile, currentBucketName, oldKey);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(oldKey);
        return next;
      });
      updateNotification(notifId, {
        message: `Moved "${name}" to "${targetPrefix}"`,
        status: "success",
      });
      await refreshCurrentPath(activeProfile);
    } catch {
      updateNotification(notifId, {
        message: `Failed to move "${name}"`,
        status: "error",
      });
    }
  }

  async function handleConfirmCopy() {
    if (dialog.type !== "copy") return;

    const targetPrefix = promptValue.trim().replace(/\/?$/, "/");
    if (!targetPrefix) return;

    const { name } = dialog;
    const notifId = addNotification({ message: `Copying "${name}"...`, status: "running" });

    const fileName = dialog.key.split("/").pop() || "";
    const targetKey = `${targetPrefix}${fileName}`;

    setDialog({ type: "none" });
    setPromptValue("");
    setActiveMenu(null);

    if (!activeProfile || !currentBucketName) return;

    try {
      await copyObject(activeProfile, currentBucketName, dialog.key, currentBucketName, targetKey);
      updateNotification(notifId, {
        message: `Copied "${name}" to "${targetPrefix}"`,
        status: "success",
      });
      await refreshCurrentPath(activeProfile);
    } catch {
      updateNotification(notifId, {
        message: `Failed to copy "${name}"`,
        status: "error",
      });
    }
  }

  async function handleConfirmCreateFolder() {
    if (dialog.type !== "createFolder") return;

    const folderName = promptValue.trim();
    if (!folderName) return;

    const notifId = addNotification({
      message: `Creating folder "${folderName}"...`,
      status: "running",
    });

    setDialog({ type: "none" });
    setPromptValue("");

    if (!activeProfile || !currentBucketName) return;

    try {
      await createFolder(activeProfile, currentBucketName, `${currentPrefix}${folderName}`);
      updateNotification(notifId, {
        message: `Created folder "${folderName}"`,
        status: "success",
      });
      await refreshCurrentPath(activeProfile);
    } catch {
      updateNotification(notifId, {
        message: `Failed to create folder "${folderName}"`,
        status: "error",
      });
    }
  }

  function handleBulkDelete() {
    const keys = Array.from(selectedKeys);
    if (keys.length === 0) return;
    setDialog({ type: "confirmBulkDelete", keys, count: keys.length });
  }

  let dialogTitle = "";
  let dialogDescription = "";
  let dialogPlaceholder = "";
  let dialogButtonLabel = "";
  let showInput = false;
  let isDestructive = false;

  switch (dialog.type) {
    case "confirmDelete":
      dialogTitle = `Delete ${dialog.isFolder ? "folder" : "file"}`;
      dialogDescription = `Are you sure you want to delete "${dialog.name}"?${dialog.isFolder ? " All objects inside this folder will be permanently removed." : ""}`;
      dialogButtonLabel = "Delete";
      isDestructive = true;
      break;
    case "confirmBulkDelete":
      dialogTitle = "Delete selected objects";
      dialogDescription = `Are you sure you want to delete ${dialog.count} selected object${dialog.count === 1 ? "" : "s"}? This cannot be undone.`;
      dialogButtonLabel = `Delete ${dialog.count} object${dialog.count === 1 ? "" : "s"}`;
      isDestructive = true;
      break;
    case "rename":
      dialogTitle = "Rename object";
      dialogDescription = `Enter a new name for "${dialog.name}".`;
      dialogPlaceholder = dialog.name;
      dialogButtonLabel = "Rename";
      showInput = true;
      break;
    case "move":
      dialogTitle = "Move object";
      dialogDescription = `Choose a destination folder for "${dialog.name}".`;
      dialogButtonLabel = "Move";
      break;
    case "copy":
      dialogTitle = "Copy object";
      dialogDescription = `Choose a destination folder for "${dialog.name}".`;
      dialogButtonLabel = "Copy";
      break;
    case "createFolder":
      dialogTitle = "Create folder";
      dialogDescription = "Enter a name for the new folder.";
      dialogPlaceholder = "Folder name";
      dialogButtonLabel = "Create";
      showInput = true;
      break;
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPromptValue("");
                setDialog({ type: "createFolder" });
              }}
            >
              <FolderPlus className="mr-1.5 size-3.5" /> New folder
            </Button>
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
              ref={searchInputRef}
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

      {selectedKeys.size > 0 && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            {selectedKeys.size} selected
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => handleBulkDelete()}
          >
            <Trash2 className="mr-1 size-3" /> Delete
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled title="Coming soon">
            <Copy className="mr-1 size-3" /> Copy
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled title="Coming soon">
            <Folder className="mr-1 size-3" /> Move
          </Button>
          <div className="ml-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedKeys(new Set())}
            >
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="text-center">
              <RefreshCw className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
              <h3 className="text-sm font-semibold">Loading files...</h3>
              <p className="mt-1 text-xs text-muted-foreground">Fetching objects from S3</p>
            </div>
          </div>
        ) : rows.length === 0 ? (
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
                <th className="w-10 border-b border-border px-2 py-2.5">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={isBusy}
                  />
                </th>
                {(["name", "size", "lastModified"] as const).map((field) => (
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
                <th className="border-b border-border px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowKey = row.type === "folder" ? row.folder.prefix : row.file.key;
                const isSelected = selectedKeys.has(rowKey);

                return (
                  <tr
                    key={rowKey}
                    className={`bg-background transition hover:bg-accent/50 ${isSelected ? "bg-accent/30" : ""}`}
                    onDoubleClick={() => {
                      if (isBusy) return;
                      if (row.type === "folder") {
                        void handlePathOpen(row.folder.prefix);
                      } else {
                        openPreview({ key: row.file.key, name: row.name });
                        if (activeProfile && currentBucketName) {
                          void loadPreviewContent(activeProfile, currentBucketName);
                        }
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveMenu(null);
                      setContextMenu({ row, rowKey, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <td className="border-b border-border px-2 py-2.5">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={isSelected}
                        onChange={() => toggleSelect(rowKey)}
                        disabled={isBusy}
                      />
                    </td>
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
                        <button
                          type="button"
                          className="flex min-w-0 items-center gap-2 text-left hover:underline"
                          disabled={isBusy}
                          onClick={() => {
                            openPreview({ key: row.file.key, name: row.name });
                            if (activeProfile && currentBucketName) {
                              void loadPreviewContent(activeProfile, currentBucketName);
                            }
                          }}
                        >
                          <File className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium">{row.name}</span>
                        </button>
                      )}
                    </td>
                    <td className="border-b border-border px-4 py-2.5 text-muted-foreground">
                      {row.type === "folder" ? "\u2014" : formatBytes(row.file.size)}
                    </td>
                    <td className="border-b border-border px-4 py-2.5 text-muted-foreground">
                      {row.type === "folder" ? "\u2014" : formatDate(row.file.lastModified)}
                    </td>
                    <td className="border-b border-border px-4 py-2.5">
                      <div className="relative flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() =>
                            row.type === "folder"
                              ? handleDownloadFolder(row.folder)
                              : handleDownloadFile(row.file)
                          }
                        >
                          <Download className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() =>
                            setDialog({
                              type: "confirmDelete",
                              key: rowKey,
                              name: row.name,
                              isFolder: row.type === "folder",
                            })
                          }
                        >
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                        {row.type === "file" && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isBusy}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(activeMenu === rowKey ? null : rowKey);
                              }}
                            >
                              <MoreHorizontal className="size-3" />
                            </Button>
                            {activeMenu === rowKey && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setActiveMenu(null)}
                                />
                                <div
                                  ref={menuRef}
                                  className="absolute right-0 top-full z-20 w-36 rounded-md border border-border bg-background py-1 shadow-xl"
                                >
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                                    onClick={() => {
                                      openPreview({ key: row.file.key, name: row.name });
                                      if (activeProfile && currentBucketName) {
                                        void loadPreviewContent(activeProfile, currentBucketName);
                                      }
                                    }}
                                  >
                                    <FileSymlink className="size-3" /> Preview
                                  </button>
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                                    onClick={() => {
                                      setDialog({ type: "rename", key: rowKey, name: row.name });
                                      setPromptValue(row.name);
                                    }}
                                  >
                                    <Pencil className="size-3" /> Rename
                                  </button>
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                                    onClick={() => {
                                      setDialog({ type: "copy", key: rowKey, name: row.name });
                                      setPromptValue("");
                                    }}
                                  >
                                    <Copy className="size-3" /> Copy
                                  </button>
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                                    onClick={() => {
                                      setDialog({ type: "move", key: rowKey, name: row.name });
                                      setPromptValue("");
                                    }}
                                  >
                                    <Folder className="size-3" /> Move
                                  </button>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {dialog.type !== "none" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            setDialog({ type: "none" });
            setPromptValue("");
          }}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">{dialogTitle}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{dialogDescription}</p>

            {dialog.type === "move" || dialog.type === "copy" ? (
              <div className="mt-3">
                <label className="text-xs font-medium text-muted-foreground">
                  Destination folder
                </label>
                {promptValue ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="flex-1 truncate rounded-md border border-input bg-muted px-2 py-1.5 text-xs">
                      {promptValue}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPromptValue("")}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1.5"
                    onClick={() => setFolderPickerFor(dialog.type)}
                  >
                    <Folder className="mr-1.5 size-3.5" /> Browse folders...
                  </Button>
                )}
                {promptValue && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Destination:{" "}
                    <span className="font-mono">
                      {promptValue}
                      {dialog.name}
                    </span>
                  </p>
                )}
              </div>
            ) : showInput ? (
              <input
                className="mt-3 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                placeholder={dialogPlaceholder}
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    switch (dialog.type) {
                      case "rename":
                        void handleConfirmRename();
                        break;
                      case "createFolder":
                        void handleConfirmCreateFolder();
                        break;
                    }
                  }
                }}
                autoFocus
              />
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDialog({ type: "none" });
                  setPromptValue("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={isDestructive ? "text-destructive" : ""}
                onClick={() => {
                  switch (dialog.type) {
                    case "confirmDelete":
                      void handleConfirmDelete();
                      break;
                    case "confirmBulkDelete":
                      void handleConfirmBulkDelete();
                      break;
                    case "rename":
                      void handleConfirmRename();
                      break;
                    case "move":
                      void handleConfirmMove();
                      break;
                    case "copy":
                      void handleConfirmCopy();
                      break;
                    case "createFolder":
                      void handleConfirmCreateFolder();
                      break;
                  }
                }}
              >
                {dialogButtonLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {dialog.type !== "none" && ["move", "copy"].includes(dialog.type) && (
        <FolderPickerDialog
          open={folderPickerFor !== null}
          onOpenChange={(open) => {
            if (!open) setFolderPickerFor(null);
          }}
          profile={activeProfile!}
          bucketName={currentBucketName!}
          title={folderPickerFor === "move" ? "Select move destination" : "Select copy destination"}
          onSelect={(prefix) => {
            setPromptValue(prefix);
            setFolderPickerFor(null);
          }}
        />
      )}
      <PreviewModal />

      <CommandPaletteTrigger
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onRefresh={() => {
          if (activeProfile) void refreshCurrentPath(activeProfile);
        }}
        onNewFolder={() => {
          setPromptValue("");
          setDialog({ type: "createFolder" });
        }}
        onFocusSearch={() => searchInputRef.current?.focus()}
        onGoUp={() => void handleGoUp()}
        onUpload={() => {
          const uploadBtn = document.querySelector<HTMLButtonElement>("[data-upload-trigger]");
          uploadBtn?.click();
        }}
      />

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 w-44 rounded-lg border border-border bg-background py-1 shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
              onClick={() => handleContextMenuAction("download")}
            >
              <Download className="size-3.5" /> Download
            </button>
            {contextMenu.row.type === "file" && (
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                onClick={() => handleContextMenuAction("preview")}
              >
                <FileSymlink className="size-3.5" /> Preview
              </button>
            )}
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
              onClick={() => handleContextMenuAction("rename")}
            >
              <Pencil className="size-3.5" /> Rename
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
              onClick={() => handleContextMenuAction("copy")}
            >
              <Copy className="size-3.5" /> Copy
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
              onClick={() => handleContextMenuAction("move")}
            >
              <Folder className="size-3.5" /> Move
            </button>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-destructive hover:bg-accent"
              onClick={() => handleContextMenuAction("delete")}
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        </>
      )}
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
    return "\u2014";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
