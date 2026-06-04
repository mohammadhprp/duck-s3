import { FormEvent, useEffect, useMemo, useState } from "react";
import { Database, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

import { Button } from "@cloudflare/kumo/components/button";
import { useBucketStore } from "@/stores/bucketStore";
import { useConnectionStore } from "@/stores/connectionStore";

export function BucketBrowser() {
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
    status,
    lastMessage,
    lastLoadedProfileId,
    selectBucket,
    refreshBuckets,
    createBucket,
    deleteBucket,
    resetBuckets,
  } = useBucketStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [bucketName, setBucketName] = useState("");

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
      return;
    }

    if (lastLoadedProfileId !== activeProfile.id && status !== "loading") {
      void refreshBuckets(activeProfile);
    }
  }, [activeProfile, lastLoadedProfileId, refreshBuckets, resetBuckets, status]);

  const filteredBuckets = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    if (!normalizedSearchTerm) {
      return buckets;
    }

    return buckets.filter((bucket) => bucket.name.toLowerCase().includes(normalizedSearchTerm));
  }, [buckets, searchTerm]);

  const selectedBucket = buckets.find((bucket) => bucket.name === selectedBucketName);
  const isBusy = status === "loading" || status === "creating" || status === "deleting";

  async function handleCreateBucket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeProfile) {
      return;
    }

    const created = await createBucket(activeProfile, bucketName);

    if (created) {
      setBucketName("");
    }
  }

  async function handleDeleteBucket(bucketNameToDelete: string) {
    if (!activeProfile) {
      return;
    }

    const confirmed = window.confirm(
      `Delete bucket "${bucketNameToDelete}"? The bucket must be empty before S3 will delete it.`,
    );

    if (!confirmed) {
      return;
    }

    await deleteBucket(activeProfile, bucketNameToDelete);
  }

  if (!activeProfile) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <section className="max-w-xl rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <Database className="mx-auto mb-4 size-10 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">Connect before browsing buckets</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Bucket browsing uses the active S3 profile. Save and connect a profile from the
            Connections page, then return here to list, search, create, refresh, and delete buckets.
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
    <div className="grid flex-1 grid-cols-[320px_minmax(0,1fr)] gap-6 p-6">
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
              shape="square"
              size="base"
              disabled={isBusy}
              onClick={() => void refreshBuckets(activeProfile)}
              aria-label="Refresh buckets"
            >
              <RefreshCw className={`size-4 ${status === "loading" ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <label className="relative block text-sm font-medium">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              placeholder="Search buckets"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
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
            <nav className="space-y-2" aria-label="Bucket sidebar">
              {filteredBuckets.map((bucket) => (
                <button
                  key={bucket.name}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
                    bucket.name === selectedBucketName
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                  onClick={() => selectBucket(bucket.name)}
                >
                  <Database className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{bucket.name}</span>
                </button>
              ))}
            </nav>
          )}
        </div>
      </aside>

      <section className="min-w-0 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Bucket browser</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Browse every bucket available to the active profile, filter the bucket sidebar, create
              a new bucket, and remove empty buckets when they are no longer needed.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={isBusy}
            onClick={() => void refreshBuckets(activeProfile)}
          >
            <RefreshCw className={`mr-2 size-4 ${status === "loading" ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <form
          className="mb-6 grid gap-3 rounded-lg border border-border bg-muted/30 p-4 md:grid-cols-[1fr_auto]"
          onSubmit={handleCreateBucket}
        >
          <label className="grid gap-2 text-sm font-medium">
            Create bucket
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              placeholder="my-new-bucket"
              value={bucketName}
              onChange={(event) => setBucketName(event.target.value)}
            />
          </label>
          <Button className="self-end" type="submit" disabled={isBusy}>
            <Plus className="mr-2 size-4" /> Create bucket
          </Button>
        </form>

        {lastMessage ? (
          <p className="mb-6 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            {lastMessage}
          </p>
        ) : null}

        {selectedBucket ? (
          <article className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Selected bucket
                </p>
                <h3 className="mt-2 truncate text-2xl font-semibold tracking-tight">
                  {selectedBucket.name}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Created {formatCreationDate(selectedBucket.creationDate)}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                disabled={isBusy}
                onClick={() => void handleDeleteBucket(selectedBucket.name)}
              >
                <Trash2 className="mr-2 size-4" /> Delete bucket
              </Button>
            </div>
          </article>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
            <Database className="mx-auto mb-4 size-8 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No bucket selected</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Select a bucket from the sidebar or create a new bucket to get started.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function formatCreationDate(creationDate?: string): string {
  if (!creationDate) {
    return "date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(creationDate));
}
