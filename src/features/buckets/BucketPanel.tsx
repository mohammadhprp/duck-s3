import { FormEvent, useEffect, useMemo, useState } from "react";
import { Database, Plus, RefreshCw, Search } from "lucide-react";
import { Button } from "@cloudflare/kumo/components/button";
import { useBucketStore } from "@/stores/bucketStore";
import { useConnectionStore } from "@/stores/connectionStore";
import { useObjectExplorerStore } from "@/stores/objectExplorerStore";

export function BucketPanel() {
  const { activeProfileId, profiles } = useConnectionStore();
  const { buckets, status, lastLoadedProfileId, selectBucket, refreshBuckets, createBucket } =
    useBucketStore();
  const { currentBucketName, openPath } = useObjectExplorerStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId),
    [profiles, activeProfileId],
  );

  useEffect(() => {
    if (!activeProfile) {
      return;
    }
    if (lastLoadedProfileId !== activeProfile.id && status !== "loading") {
      void refreshBuckets(activeProfile);
    }
  }, [activeProfile, lastLoadedProfileId, refreshBuckets, status]);

  useEffect(() => {
    if (!activeProfile || buckets.length === 0) return;

    if (!currentBucketName) {
      const firstBucket = buckets[0].name;
      selectBucket(firstBucket);
      void openPath(activeProfile, firstBucket, "");
      return;
    }

    const bucketExists = buckets.some((b) => b.name === currentBucketName);
    if (!bucketExists && buckets.length > 0) {
      const firstBucket = buckets[0].name;
      selectBucket(firstBucket);
      void openPath(activeProfile, firstBucket, "");
    }
  }, [activeProfile, buckets, currentBucketName, selectBucket, openPath]);

  const filteredBuckets = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return buckets;
    return buckets.filter((b) => b.name.toLowerCase().includes(normalized));
  }, [buckets, searchTerm]);

  const isBusy = status === "loading" || status === "creating";

  async function handleCreateBucket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProfile) return;
    const created = await createBucket(activeProfile, newBucketName);
    if (created) {
      setNewBucketName("");
      setCreateMode(false);
    }
  }

  async function handleBucketSelect(bucketName: string) {
    selectBucket(bucketName);
    if (activeProfile) {
      await openPath(activeProfile, bucketName, "");
    }
  }

  if (!activeProfile) {
    return (
      <aside className="flex h-full flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Buckets</h2>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="text-center">
            <Database className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No connection</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Select a connection to view buckets
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-w-0 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Buckets</h2>
          <p className="truncate text-xs text-muted-foreground">{activeProfile.name}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          shape="square"
          size="sm"
          disabled={isBusy}
          onClick={() => void refreshBuckets(activeProfile)}
          aria-label="Refresh buckets"
        >
          <RefreshCw className={`size-3 ${status === "loading" ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="px-3 py-2">
        <label className="relative block text-sm font-medium">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            placeholder="Search buckets"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {filteredBuckets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <Database className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {buckets.length === 0 ? "No buckets" : "No matches"}
            </p>
            {buckets.length === 0 && !createMode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setCreateMode(true)}
              >
                <Plus className="mr-1 size-3" /> Create bucket
              </Button>
            )}
          </div>
        ) : (
          <nav className="space-y-1">
            {filteredBuckets.map((bucket) => (
              <button
                key={bucket.name}
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition ${
                  bucket.name === currentBucketName
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                onClick={() => void handleBucketSelect(bucket.name)}
              >
                <Database className="size-3.5 shrink-0" />
                <span className="truncate">{bucket.name}</span>
              </button>
            ))}
          </nav>
        )}

        {createMode && (
          <form
            className="mt-2 rounded-lg border border-border bg-muted/30 p-3"
            onSubmit={handleCreateBucket}
          >
            <label className="text-xs font-medium">New bucket name</label>
            <input
              className="mt-1.5 h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              placeholder="my-bucket"
              value={newBucketName}
              onChange={(event) => setNewBucketName(event.target.value)}
              autoFocus
            />
            <div className="mt-2 flex gap-2">
              <Button type="submit" size="sm" disabled={isBusy || !newBucketName.trim()}>
                <Plus className="mr-1 size-3" /> Create
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreateMode(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
