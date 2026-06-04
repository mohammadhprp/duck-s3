import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@cloudflare/kumo/components/button";
import { useConnectionStore } from "@/stores/connectionStore";
import { ConnectionSheet } from "./ConnectionSheet";
import { useState } from "react";

export function ConnectionSidebar() {
  const { profiles, activeProfileId, connectProfile, disconnect } = useConnectionStore();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <aside className="flex h-full flex-col border-r border-border bg-sidebar">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <img src="/logo.png" alt="Duck S3" className="size-8 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">Duck S3</h1>
            <p className="truncate text-xs text-muted-foreground">
              {activeProfileId ? "Connected" : "No connection"}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">Connections</p>

          {profiles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center">
              <FolderOpen className="mx-auto mb-2 size-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No connections yet</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setSheetOpen(true)}
              >
                <Plus className="mr-1 size-3" /> Add connection
              </Button>
            </div>
          ) : (
            <nav className="space-y-1">
              {profiles.map((profile) => {
                const isActive = profile.id === activeProfileId;
                return (
                  <div
                    key={profile.id}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5"
                  >
                    <button
                      type="button"
                      className={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm transition ${
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                      onClick={() => {
                        if (isActive) {
                          void disconnect();
                        } else {
                          void connectProfile(profile.id);
                        }
                      }}
                    >
                      <span className="flex items-center gap-2 truncate font-medium">
                        <span
                          className={`size-2 shrink-0 rounded-full ${isActive ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                        />
                        <span className="truncate">{profile.name}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {profile.provider.toUpperCase()} · {profile.endpoint || "default"}
                      </span>
                    </button>
                  </div>
                );
              })}
            </nav>
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="mr-2 size-4" /> Add connection
          </Button>
        </div>
      </aside>

      <ConnectionSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
