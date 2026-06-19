import { create } from "zustand";

import { loadConnectionProfiles, saveConnectionProfiles } from "@/services/s3/secureStorage";
import { normalizeEndpoint, validateConnectionProfile } from "@/services/s3/validation";
import { testS3Connection } from "@/services/s3/client";
import type {
  ConnectionProfile,
  ConnectionProfileInput,
  ConnectionStatus,
} from "@/features/connections/types/connection";

interface ConnectionState {
  profiles: ConnectionProfile[];
  activeProfileId?: string;
  status: ConnectionStatus;
  lastMessage?: string;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  saveProfile: (input: ConnectionProfileInput) => Promise<ConnectionProfile>;
  removeProfile: (profileId: string) => Promise<void>;
  testProfile: (input: ConnectionProfileInput) => Promise<boolean>;
  connectProfile: (profileId: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  profiles: [],
  status: "idle",
  hydrated: false,
  async hydrate() {
    const payload = await loadConnectionProfiles();

    set({
      profiles: payload.profiles,
      activeProfileId: payload.activeProfileId,
      hydrated: true,
      status: payload.activeProfileId ? "connected" : "idle",
    });
  },
  async saveProfile(input) {
    const validation = validateConnectionProfile(input);

    if (!validation.valid) {
      throw new Error(Object.values(validation.errors)[0] ?? "Connection profile is invalid.");
    }

    const now = new Date().toISOString();
    const existingProfile = input.id
      ? get().profiles.find((profile) => profile.id === input.id)
      : undefined;
    const profile: ConnectionProfile = {
      ...input,
      id: existingProfile?.id ?? crypto.randomUUID(),
      endpoint: normalizeEndpoint(input.endpoint, input.useSsl),
      name: input.name.trim(),
      region: input.region.trim(),
      credentials: {
        accessKeyId: input.credentials.accessKeyId.trim(),
        secretAccessKey: input.credentials.secretAccessKey,
      },
      createdAt: existingProfile?.createdAt ?? now,
      updatedAt: now,
      lastConnectedAt: existingProfile?.lastConnectedAt,
    };

    const profiles = existingProfile
      ? get().profiles.map((currentProfile) =>
          currentProfile.id === profile.id ? profile : currentProfile,
        )
      : [...get().profiles, profile];

    set({ profiles, lastMessage: "Connection profile saved." });
    await persistProfiles(profiles, get().activeProfileId);

    return profile;
  },
  async removeProfile(profileId) {
    const profiles = get().profiles.filter((profile) => profile.id !== profileId);
    const activeProfileId = get().activeProfileId === profileId ? undefined : get().activeProfileId;

    set({
      profiles,
      activeProfileId,
      status: activeProfileId ? get().status : "idle",
      lastMessage: "Connection profile removed.",
    });
    await persistProfiles(profiles, activeProfileId);
  },
  async testProfile(input) {
    const validation = validateConnectionProfile(input);

    if (!validation.valid) {
      set({ status: "error", lastMessage: Object.values(validation.errors)[0] });
      return false;
    }

    set({ status: "testing", lastMessage: "Testing connection..." });
    const result = await testS3Connection({
      ...input,
      endpoint: normalizeEndpoint(input.endpoint, input.useSsl),
    });

    set({
      status: result.ok ? "idle" : "error",
      lastMessage:
        result.bucketCount === undefined
          ? result.message
          : `${result.message} Found ${result.bucketCount} bucket(s).`,
    });

    return result.ok;
  },
  async connectProfile(profileId) {
    const profile = get().profiles.find((currentProfile) => currentProfile.id === profileId);

    if (!profile) {
      set({ status: "error", lastMessage: "Connection profile not found." });
      return false;
    }

    set({ status: "testing", lastMessage: `Connecting to ${profile.name}...` });
    const result = await testS3Connection(profile);

    if (!result.ok) {
      set({ status: "error", lastMessage: result.message });
      return false;
    }

    const now = new Date().toISOString();
    const profiles = get().profiles.map((currentProfile) =>
      currentProfile.id === profileId
        ? { ...currentProfile, lastConnectedAt: now }
        : currentProfile,
    );

    set({
      profiles,
      activeProfileId: profileId,
      status: "connected",
      lastMessage: `Connected to ${profile.name}.`,
    });
    await persistProfiles(profiles, profileId);

    return true;
  },
  async disconnect() {
    set({ activeProfileId: undefined, status: "idle", lastMessage: "Disconnected." });
    await persistProfiles(get().profiles, undefined);
  },
}));

async function persistProfiles(profiles: ConnectionProfile[], activeProfileId?: string) {
  await saveConnectionProfiles({ profiles, activeProfileId });
}
