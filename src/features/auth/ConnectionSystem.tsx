import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  KeyRound,
  Lock,
  Plug,
  PlugZap,
  Server,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useConnectionStore } from "@/stores/connectionStore";
import type { ConnectionProfile, ConnectionProfileInput, S3Provider } from "@/types/connection";

const providerDefaults: Record<
  S3Provider,
  Pick<ConnectionProfileInput, "provider" | "endpoint" | "region" | "forcePathStyle" | "useSsl">
> = {
  aws: {
    provider: "aws",
    endpoint: "",
    region: "us-east-1",
    forcePathStyle: false,
    useSsl: true,
  },
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
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
};

export function ConnectionSystem() {
  const {
    profiles,
    activeProfileId,
    status,
    lastMessage,
    hydrated,
    hydrate,
    saveProfile,
    removeProfile,
    testProfile,
    connectProfile,
    disconnect,
  } = useConnectionStore();
  const [form, setForm] = useState<ConnectionProfileInput>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId),
    [activeProfileId, profiles],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const savedProfile = await saveProfile(form);
      setForm(profileToForm(savedProfile));
    } finally {
      setIsSaving(false);
    }
  }

  function updateProvider(provider: S3Provider) {
    setForm((currentForm) => ({
      ...currentForm,
      ...providerDefaults[provider],
      provider,
    }));
  }

  function editProfile(profile: ConnectionProfile) {
    setForm(profileToForm(profile));
  }

  function startNewProfile() {
    setForm(emptyForm);
  }

  return (
    <div className="grid flex-1 grid-cols-[minmax(0,1fr)_360px] gap-6 p-6">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <ShieldCheck className="size-4" /> Phase 1 complete
            </p>
            <h3 className="text-2xl font-semibold tracking-tight">Connection System</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Create reusable S3-compatible profiles, encrypt saved secrets locally, test access
              with ListBuckets, and switch the active connection when you are ready to browse
              buckets.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={startNewProfile}>
            New profile
          </Button>
        </div>

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

          {lastMessage ? (
            <p className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              {lastMessage}
            </p>
          ) : null}

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
      </section>

      <aside className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Active connection</h3>
              <p className="text-xs text-muted-foreground">Current S3 session target</p>
            </div>
            <Cloud className="size-5 text-primary" />
          </div>
          {activeProfile ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg bg-muted p-3">
                <p className="font-medium text-foreground">{activeProfile.name}</p>
                <p className="mt-1 truncate text-muted-foreground">
                  {activeProfile.endpoint || "AWS default endpoint"}
                </p>
              </div>
              <Button className="w-full" variant="outline" onClick={() => void disconnect()}>
                Disconnect
              </Button>
            </div>
          ) : (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              No active profile. Save and connect a profile to continue.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Profiles</h3>
              <p className="text-xs text-muted-foreground">
                {hydrated ? `${profiles.length} saved` : "Loading profiles..."}
              </p>
            </div>
            <Server className="size-5 text-primary" />
          </div>
          <div className="space-y-3">
            {profiles.length === 0 ? (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                AWS S3, MinIO, and Cloudflare R2 profiles will appear here.
              </p>
            ) : (
              profiles.map((profile) => (
                <article
                  key={profile.id}
                  className="rounded-lg border border-border bg-background p-3 text-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <button
                      className="min-w-0 text-left"
                      type="button"
                      onClick={() => editProfile(profile)}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {profile.id === activeProfileId ? (
                          <CheckCircle2 className="size-4 text-primary" />
                        ) : null}
                        {profile.name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {profile.provider.toUpperCase()} · {profile.region}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void removeProfile(profile.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={status === "testing"}
                      onClick={() => void connectProfile(profile.id)}
                    >
                      Connect
                    </Button>
                    <Button
                      className="flex-1"
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={status === "testing"}
                      onClick={() => void testProfile(profile)}
                    >
                      Test
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Lock className="size-4 text-primary" /> Local security
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Secrets are encrypted with AES-GCM before they are stored in local browser storage. The
            application never renders saved secret keys outside the password field.
          </p>
        </section>
      </aside>
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
