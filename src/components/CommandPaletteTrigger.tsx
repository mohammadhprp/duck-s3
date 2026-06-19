import { FolderPlus, RefreshCw, Search, ArrowLeft, Upload } from "lucide-react";

import { CommandPalette } from "@cloudflare/kumo/components/command-palette";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteTriggerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
  onNewFolder: () => void;
  onFocusSearch: () => void;
  onGoUp: () => void;
  onUpload: () => void;
}

export function CommandPaletteTrigger({
  open,
  onOpenChange,
  onRefresh,
  onNewFolder,
  onFocusSearch,
  onGoUp,
  onUpload,
}: CommandPaletteTriggerProps) {
  const commands: CommandItem[] = [
    {
      id: "refresh",
      label: "Refresh",
      description: "Reload the current folder",
      icon: <RefreshCw className="size-4" />,
      action: onRefresh,
    },
    {
      id: "focus-search",
      label: "Search files",
      description: "Focus the search input",
      icon: <Search className="size-4" />,
      action: onFocusSearch,
    },
    {
      id: "go-up",
      label: "Go up",
      description: "Navigate to parent folder",
      icon: <ArrowLeft className="size-4" />,
      action: onGoUp,
    },
    {
      id: "new-folder",
      label: "New folder",
      description: "Create a new folder in the current path",
      icon: <FolderPlus className="size-4" />,
      action: onNewFolder,
    },
    {
      id: "upload",
      label: "Upload files",
      description: "Upload files to the current folder",
      icon: <Upload className="size-4" />,
      action: onUpload,
    },
  ];

  return (
    <CommandPalette.Root
      open={open}
      onOpenChange={onOpenChange}
      items={commands}
      itemToStringValue={(item) => item.label}
      onSelect={(item) => {
        item.action();
        onOpenChange(false);
      }}
    >
      <CommandPalette.Input placeholder="Type a command..." autoFocus />
      <CommandPalette.List>
        <CommandPalette.Results>
          {(group: { items: CommandItem[] }) => (
            <CommandPalette.Group items={group.items}>
              <CommandPalette.GroupLabel>Actions</CommandPalette.GroupLabel>
              <CommandPalette.Items>
                {(item: CommandItem) => (
                  <CommandPalette.Item
                    value={item}
                    onClick={() => {
                      item.action();
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{item.icon}</span>
                      <div>
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                  </CommandPalette.Item>
                )}
              </CommandPalette.Items>
            </CommandPalette.Group>
          )}
        </CommandPalette.Results>
        <CommandPalette.Empty>No matching commands</CommandPalette.Empty>
      </CommandPalette.List>
      <CommandPalette.Footer>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            <kbd className="rounded border border-border px-1">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="rounded border border-border px-1">↵</kbd> Select
          </span>
          <span>
            <kbd className="rounded border border-border px-1">Esc</kbd> Close
          </span>
        </span>
      </CommandPalette.Footer>
    </CommandPalette.Root>
  );
}
