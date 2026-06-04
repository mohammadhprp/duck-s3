import { useMemo, useState } from "react";
import {
  BarChart3,
  Cloud,
  Database,
  FolderOpen,
  HardDriveUpload,
  Home,
  LifeBuoy,
  LockKeyhole,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";

import { ConnectionSystem } from "@/features/auth/ConnectionSystem";
import { BucketBrowser } from "@/features/buckets/BucketBrowser";
import { ObjectExplorer } from "@/features/explorer/ObjectExplorer";
import { UploadPanel } from "@/features/uploads/UploadPanel";

type NavigationPage = "connections" | "buckets" | "explorer" | "uploads" | "settings";

type NavigationItem = {
  label: string;
  description: string;
  icon: typeof ShieldCheck;
  page: NavigationPage;
};

const navigationSections: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: "Account home",
    items: [
      {
        label: "Connections",
        description: "Profiles and credentials",
        icon: ShieldCheck,
        page: "connections",
      },
      { label: "Buckets", description: "Storage overview", icon: Database, page: "buckets" },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "Explorer", description: "Browse objects", icon: FolderOpen, page: "explorer" },
      { label: "Uploads", description: "Transfer queue", icon: HardDriveUpload, page: "uploads" },
    ],
  },
  {
    label: "Protect & Connect",
    items: [{ label: "Settings", description: "Preferences", icon: Settings, page: "settings" }],
  },
];

const pageMetadata: Record<NavigationPage, { eyebrow: string; title: string; summary: string }> = {
  connections: {
    eyebrow: "Profiles",
    title: "Connection profiles",
    summary: "Create encrypted S3-compatible profiles and switch the active workspace.",
  },
  buckets: {
    eyebrow: "Storage",
    title: "Bucket browser",
    summary: "Review connected buckets, object counts, regions, and bucket-level actions.",
  },
  explorer: {
    eyebrow: "Objects",
    title: "Object explorer",
    summary: "Navigate prefixes and inspect object metadata with a clean resource list.",
  },
  uploads: {
    eyebrow: "Transfers",
    title: "Upload queue",
    summary: "Drop files or folders, track active jobs, and retry failed uploads.",
  },
  settings: {
    eyebrow: "Roadmap",
    title: "Settings",
    summary: "Central preferences for the desktop shell are planned for a later phase.",
  },
};

const quickStats = [
  { label: "Security", value: "Local", helper: "Encrypted profiles" },
  { label: "Provider", value: "S3", helper: "AWS · R2 · MinIO" },
  { label: "Queue", value: "Live", helper: "Uploads visible" },
];

function App() {
  const [activePage, setActivePage] = useState<NavigationPage>("buckets");
  const activePageMetadata = pageMetadata[activePage];
  const flatNavigationItems = useMemo(
    () => navigationSections.flatMap((section) => section.items),
    [],
  );
  const activeNavigationItem = flatNavigationItems.find((item) => item.page === activePage);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-[272px_1fr] overflow-hidden border border-border bg-background shadow-[0_30px_80px_rgba(0,0,0,0.08)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <aside className="flex min-h-screen flex-col border-r border-border bg-sidebar px-4 py-5">
          <div className="mb-5 flex items-center gap-3 px-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
              <Cloud className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-tight">Duck S3</h1>
              <p className="truncate text-xs text-muted-foreground">S3 account home</p>
            </div>
          </div>

          <div className="mb-4 flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground shadow-sm">
            <Search className="size-4" />
            <span className="flex-1">Quick search...</span>
            <span className="text-xs">⌘K</span>
          </div>

          <nav className="space-y-5 overflow-y-auto pr-1">
            {navigationSections.map((section) => (
              <div key={section.label}>
                <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
                  {section.label}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = item.page === activePage;

                    return (
                      <button
                        key={item.label}
                        type="button"
                        className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "bg-accent text-accent-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                        }`}
                        onClick={() => setActivePage(item.page)}
                      >
                        <item.icon className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{item.label}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto border-t border-border pt-4">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent/70 hover:text-foreground"
            >
              <LifeBuoy className="size-4" /> Support
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col bg-background">
          <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Home className="size-4" />
              <span>Account home</span>
              <span>/</span>
              <span className="font-medium text-foreground">{activeNavigationItem?.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<Sparkles className="size-4" />}
              >
                Ask AI
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setActivePage("connections")}
              >
                New connection
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <section className="border-b border-border bg-page-gradient px-10 py-8">
              <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
                      <LockKeyhole className="size-4" /> {activePageMetadata.eyebrow}
                    </p>
                    <h2 className="text-3xl font-semibold tracking-tight">
                      {activePageMetadata.title}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {activePageMetadata.summary}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={<BarChart3 className="size-4" />}
                    >
                      Last 24 hours
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setActivePage("uploads")}
                    >
                      Add upload
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {quickStats.map((stat) => (
                    <LayerCard
                      key={stat.label}
                      className="rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
                        <p className="text-xs text-muted-foreground">{stat.helper}</p>
                      </div>
                      <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full w-2/3 rounded-full bg-primary" />
                      </div>
                    </LayerCard>
                  ))}
                </div>
              </div>
            </section>

            <div className="mx-auto max-w-7xl px-10 py-6">
              {activePage === "connections" ? <ConnectionSystem /> : null}
              {activePage === "buckets" ? <BucketBrowser /> : null}
              {activePage === "explorer" ? <ObjectExplorer /> : null}
              {activePage === "uploads" ? <UploadPanel /> : null}
              {activePage === "settings" ? (
                <div className="flex min-h-[360px] items-center justify-center">
                  <LayerCard className="max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-sm">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {activePageMetadata.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      This section is planned for a later roadmap phase. Phase 4 now provides the
                      upload queue workflow.
                    </p>
                  </LayerCard>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
