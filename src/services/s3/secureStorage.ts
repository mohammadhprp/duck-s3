import type { ConnectionProfile } from "@/features/connections/types/connection";

const STORAGE_KEY = "duck-s3.connection-profiles.v1";
const CRYPTO_KEY = "duck-s3.local-aes-key.v1";

interface StoredConnectionProfile extends Omit<ConnectionProfile, "credentials"> {
  credentials: {
    accessKeyId: string;
    encryptedSecretAccessKey: string;
  };
}

interface StoredConnectionPayload {
  profiles: StoredConnectionProfile[];
  activeProfileId?: string;
}

export interface ConnectionStoragePayload {
  profiles: ConnectionProfile[];
  activeProfileId?: string;
}

export async function loadConnectionProfiles(): Promise<ConnectionStoragePayload> {
  const storedValue = localStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return { profiles: [] };
  }

  const payload = JSON.parse(storedValue) as StoredConnectionPayload;
  const profiles = await Promise.all(
    payload.profiles.map(async (profile) => ({
      ...profile,
      credentials: {
        accessKeyId: profile.credentials.accessKeyId,
        secretAccessKey: await decryptValue(profile.credentials.encryptedSecretAccessKey),
      },
    })),
  );

  return {
    profiles,
    activeProfileId: payload.activeProfileId,
  };
}

export async function saveConnectionProfiles(payload: ConnectionStoragePayload): Promise<void> {
  const profiles = await Promise.all(
    payload.profiles.map(async (profile) => ({
      ...profile,
      credentials: {
        accessKeyId: profile.credentials.accessKeyId,
        encryptedSecretAccessKey: await encryptValue(profile.credentials.secretAccessKey),
      },
    })),
  );

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      profiles,
      activeProfileId: payload.activeProfileId,
    } satisfies StoredConnectionPayload),
  );
}

async function encryptValue(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedValue = new TextEncoder().encode(value);
  const encryptedValue = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await getCryptoKey(),
    encodedValue,
  );

  return `${toBase64(iv)}.${toBase64(new Uint8Array(encryptedValue))}`;
}

async function decryptValue(value: string): Promise<string> {
  const [encodedIv, encodedSecret] = value.split(".");

  if (!encodedIv || !encodedSecret) {
    return "";
  }

  const decryptedValue = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBufferSource(fromBase64(encodedIv)) },
    await getCryptoKey(),
    toBufferSource(fromBase64(encodedSecret)),
  );

  return new TextDecoder().decode(decryptedValue);
}

async function getCryptoKey(): Promise<CryptoKey> {
  const existingKey = localStorage.getItem(CRYPTO_KEY);

  if (existingKey) {
    return crypto.subtle.importKey(
      "raw",
      toBufferSource(fromBase64(existingKey)),
      "AES-GCM",
      false,
      ["encrypt", "decrypt"],
    );
  }

  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(CRYPTO_KEY, toBase64(rawKey));

  return crypto.subtle.importKey("raw", toBufferSource(rawKey), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function toBufferSource(value: Uint8Array): BufferSource {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}
