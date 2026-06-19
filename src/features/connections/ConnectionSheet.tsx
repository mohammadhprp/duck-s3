import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Plug, PlugZap, Plus, Server, Trash2, X } from "lucide-react";
import { Button } from "@cloudflare/kumo/components/button";
import { useConnectionStore } from "@/stores/connectionStore";
import type { ConnectionProfile, ConnectionProfileInput, S3Provider } from "@/types/connection";

const providerDefaults: Record<
  S3Provider,
  Pick<ConnectionProfileInput, "provider" | "endpoint" | "region" | "forcePathStyle" | "useSsl">
> = {
  aws: { provider: "aws", endpoint: "", region: "us-east-1", forcePathStyle: false, useSsl: true },
  minio: {
    provider: "minio",
    endpoint: "localhost:9000",
    region: "us-east-1",
    forcePathStyle: true,
    useSsl: false,
  },
  r2: {
    provider: "r2",
    endpoint: "<account-id>.r2.cloudflarestorage.com",
    region: "auto",
    forcePathStyle: false,
    useSsl: true,
  },
  custom: {
    provider: "custom",
    endpoint: "",
    region: "us-east-1",
    forcePathStyle: true,
    useSsl: true,
  },
};

const emptyForm: ConnectionProfileInput = {
  id: undefined,
  name: "",
  ...providerDefaults.aws,
  credentials: { accessKeyId: "", secretAccessKey: "" },
};

export function ConnectionSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profiles, status, saveProfile, testProfile, connectProfile } = useConnectionStore();
  const [form, setForm] = useState<ConnectionProfileInput>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const editingProfile = form.id ? profiles.find((p) => p.id === form.id) : null;

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const saved = await saveProfile(form);
      setForm(profileToForm(saved));
    } finally {
      setIsSaving(false);
    }
  }

  function updateProvider(provider: S3Provider) {
    setForm((current) => ({ ...current, ...providerDefaults[provider], provider }));
  }

  function editProfile(profile: ConnectionProfile) {
    setForm(profileToForm(profile));
  }

  function startNewProfile() {
    setForm(emptyForm);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
        style={{ opacity: open ? 1 : 0, transition: "opacity 150ms" }}
      />
      <div
        className="relative z-50 flex h-full w-full max-w-lg flex-col bg-background shadow-xl"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 200ms ease-out",
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {editingProfile ? "Edit connection" : "New connection"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {editingProfile ? "Update profile settings" : "Create a new S3-compatible profile"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={startNewProfile}>
              <Plus className="mr-1 size-3" /> New
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Connection Name
                <input
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                  placeholder="Production assets"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Provider
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                  value={form.provider}
                  onChange={(event) => updateProvider(event.target.value as S3Provider)}
                >
                  <option value="aws">AWS S3</option>
                  <option value="minio">MinIO</option>
                  <option value="r2">Cloudflare R2</option>
                  <option value="custom">Custom S3-compatible</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Endpoint
                <input
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                  placeholder={
                    form.provider === "aws" ? "Optional for AWS S3" : "https://s3.example.com"
                  }
                  value={form.endpoint}
                  onChange={(event) => setForm({ ...form, endpoint: event.target.value })}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Region
                <input
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                  placeholder="us-east-1"
                  value={form.region}
                  onChange={(event) => setForm({ ...form, region: event.target.value })}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Access Key
                <input
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                  autoComplete="off"
                  value={form.credentials.accessKeyId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      credentials: { ...form.credentials, accessKeyId: event.target.value },
                    })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Secret Key
                <input
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                  type="password"
                  autoComplete="new-password"
                  value={form.credentials.secretAccessKey}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      credentials: { ...form.credentials, secretAccessKey: event.target.value },
                    })
                  }
                />
              </label>
            </div>
            <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 md:grid-cols-2">
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={form.forcePathStyle}
                  onChange={(event) => setForm({ ...form, forcePathStyle: event.target.checked })}
                />
                Force Path Style
              </label>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={form.useSsl}
                  onChange={(event) => setForm({ ...form, useSsl: event.target.checked })}
                />
                Use SSL
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSaving || status === "testing"}>
                <KeyRound className="mr-2 size-4" /> {form.id ? "Update profile" : "Save profile"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={status === "testing"}
                onClick={() => void testProfile(form)}
              >
                <PlugZap className="mr-2 size-4" /> Test connection
              </Button>
              {form.id ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={status === "testing"}
                  onClick={() => void connectProfile(form.id!)}
                >
                  <Plug className="mr-2 size-4" /> Connect
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="border-t border-border px-6 py-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Server className="size-4 text-primary" /> Saved profiles
          </h3>
          <div className="space-y-2">
            {profiles.length === 0 ? (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                No saved profiles yet.
              </p>
            ) : (
              profiles.map((profile) => (
                <article
                  key={profile.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm"
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    type="button"
                    onClick={() => editProfile(profile)}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {profile.id === useConnectionStore.getState().activeProfileId && (
                        <CheckCircle2 className="size-4 text-primary" />
                      )}
                      {profile.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {profile.provider.toUpperCase()} · {profile.region}
                    </span>
                  </button>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      shape="square"
                      aria-label={`Delete ${profile.name}`}
                      onClick={() => void useConnectionStore.getState().removeProfile(profile.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function profileToForm(profile: ConnectionProfile): ConnectionProfileInput {
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    endpoint: profile.endpoint,
    region: profile.region,
    credentials: profile.credentials,
    forcePathStyle: profile.forcePathStyle,
    useSsl: profile.useSsl,
  };
}
