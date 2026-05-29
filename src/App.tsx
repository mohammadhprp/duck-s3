import { useState } from "react";
import { Database, FolderOpen, HardDriveUpload, Settings, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConnectionSystem } from "@/features/auth/ConnectionSystem";
import { BucketBrowser } from "@/features/buckets/BucketBrowser";

type NavigationPage = "connections" | "buckets" | "explorer" | "uploads" | "settings";

const navigationItems: Array<{ label: string; icon: typeof ShieldCheck; page: NavigationPage }> = [
  { label: "Connections", icon: ShieldCheck, page: "connections" },
  { label: "Buckets", icon: Database, page: "buckets" },
  { label: "Explorer", icon: FolderOpen, page: "explorer" },
  { label: "Uploads", icon: HardDriveUpload, page: "uploads" },
  { label: "Settings", icon: Settings, page: "settings" },
];

const pageMetadata: Record<NavigationPage, { eyebrow: string; title: string }> = {
  connections: { eyebrow: "Profiles", title: "Connection profiles" },
  buckets: { eyebrow: "Explore", title: "Bucket browser" },
  explorer: { eyebrow: "Coming soon", title: "Object explorer" },
  uploads: { eyebrow: "Coming soon", title: "Upload queue" },
  settings: { eyebrow: "Coming soon", title: "Settings" },
};

function App() {
  const [activePage, setActivePage] = useState<NavigationPage>("buckets");
  const activePageMetadata = pageMetadata[activePage];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <aside className="border-r border-border bg-card/60 px-4 py-5">
          <div className="mb-8 flex items-center gap-3 px-2">
            <img src="/logo.png" alt="Duck S3 logo" className="size-10 rounded-xl shadow-sm" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Duck S3</h1>
              <p className="text-xs text-muted-foreground">S3-compatible browser</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navigationItems.map((item) => (
              <Button
                key={item.label}
                type="button"
                variant={item.page === activePage ? "secondary" : "ghost"}
                className="w-full justify-start gap-3"
                onClick={() => setActivePage(item.page)}
              >
                <item.icon className="size-4" />
                {item.label}
              </Button>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-border px-6">
            <div>
              <p className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
                <ShieldCheck className="size-4" /> {activePageMetadata.eyebrow}
              </p>
              <h2 className="text-lg font-semibold tracking-tight">{activePageMetadata.title}</h2>
            </div>
            <Button type="button" onClick={() => setActivePage("connections")}>
              New connection
            </Button>
          </header>

          {activePage === "connections" ? <ConnectionSystem /> : null}
          {activePage === "buckets" ? <BucketBrowser /> : null}
          {activePage !== "connections" && activePage !== "buckets" ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <section className="max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-sm">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {activePageMetadata.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  This section is planned for a later roadmap phase. Phase 2 focuses on the bucket
                  browser workflow.
                </p>
              </section>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default App;
