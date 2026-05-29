import { Database, FolderOpen, HardDriveUpload, Settings, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConnectionSystem } from "@/features/auth/ConnectionSystem";

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
              <p className="text-sm text-muted-foreground">Phase 1</p>
              <h2 className="text-xl font-semibold tracking-tight">Connection System</h2>
            </div>
            <Button>New connection</Button>
          </header>

          <ConnectionSystem />
        </section>
      </div>
    </main>
  );
}

export default App;
