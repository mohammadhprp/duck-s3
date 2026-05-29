import { Database, FolderOpen, HardDriveUpload, Settings, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

const navigationItems = [
  { label: "Connections", icon: ShieldCheck, active: true },
  { label: "Buckets", icon: Database, active: false },
  { label: "Explorer", icon: FolderOpen, active: false },
  { label: "Uploads", icon: HardDriveUpload, active: false },
  { label: "Settings", icon: Settings, active: false },
];

function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <aside className="border-r border-border bg-card/60 px-4 py-5">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-sm">
              🦆
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Duck S3</h1>
              <p className="text-xs text-muted-foreground">S3-compatible browser</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navigationItems.map((item) => (
              <Button
                key={item.label}
                variant={item.active ? "secondary" : "ghost"}
                className="w-full justify-start gap-3"
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
              <p className="text-sm text-muted-foreground">Phase 0</p>
              <h2 className="text-xl font-semibold tracking-tight">Application Shell</h2>
            </div>
            <Button>New connection</Button>
          </header>

          <div className="grid flex-1 grid-cols-[1fr_320px] gap-6 p-6">
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <p className="mb-2 text-sm font-medium text-primary">Ready for Phase 1</p>
              <h3 className="mb-3 text-2xl font-semibold tracking-tight">
                Connect to your S3 storage
              </h3>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                The foundation is in place: Tauri, React, TypeScript, Tailwind, shadcn/ui
                primitives, dark mode, linting, formatting, and the feature-first folder structure.
              </p>
            </section>

            <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-4 font-semibold">MVP workspace</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Connections, bucket browsing, object explorer, uploads, and settings each have a
                  home.
                </p>
                <p className="rounded-lg bg-muted p-3 text-muted-foreground">
                  Next: build the connection form and S3 client factory.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
