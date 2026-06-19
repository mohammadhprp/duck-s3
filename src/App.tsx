import { useEffect, useMemo } from "react";
import { useConnectionStore } from "@/features/connections/stores/connectionStore";
import { useBucketStore } from "@/features/buckets/stores/bucketStore";
import { useObjectExplorerStore } from "@/features/explorer/stores/objectExplorerStore";
import { ConnectionSidebar } from "@/features/connections/components/ConnectionSidebar";
import { BucketPanel } from "@/features/buckets/components/BucketPanel";
import { ObjectExplorer } from "@/features/explorer/components/ObjectExplorer";
import { FileOpNotifications } from "@/features/explorer/components/FileOpNotifications";
import { DownloadPanel } from "@/features/explorer/components/DownloadPanel";

function App() {
  const { activeProfileId, hydrated, hydrate, profiles } = useConnectionStore();
  const { refreshBuckets, lastLoadedProfileId, status: bucketStatus } = useBucketStore();
  const { resetExplorer } = useObjectExplorerStore();

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
      resetExplorer();
      return;
    }

    if (lastLoadedProfileId !== activeProfile.id && bucketStatus !== "loading") {
      void refreshBuckets(activeProfile);
    }
  }, [activeProfile, lastLoadedProfileId, refreshBuckets, bucketStatus, resetExplorer]);

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <div className="grid flex-1 grid-cols-[260px_240px_1fr]">
        <div className="h-full overflow-hidden">
          <ConnectionSidebar />
        </div>
        <div className="h-full overflow-hidden">
          <BucketPanel />
        </div>
        <div className="flex h-full min-w-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            <ObjectExplorer />
          </div>
          <DownloadPanel />
        </div>
      </div>
      <FileOpNotifications />
    </main>
  );
}

export default App;
