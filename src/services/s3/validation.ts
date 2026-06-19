import type { ConnectionProfileInput } from "@/features/connections/types/connection";

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof ConnectionProfileInput | "accessKeyId" | "secretAccessKey", string>>;
}

export function validateConnectionProfile(input: ConnectionProfileInput): ValidationResult {
  const errors: ValidationResult["errors"] = {};

  if (!input.name.trim()) {
    errors.name = "Connection name is required.";
  }

  if (!input.region.trim()) {
    errors.region = "Region is required.";
  }

  if (!input.credentials.accessKeyId.trim()) {
    errors.accessKeyId = "Access key is required.";
  }

  if (!input.credentials.secretAccessKey.trim()) {
    errors.secretAccessKey = "Secret key is required.";
  }

  if (input.provider !== "aws" && !input.endpoint.trim()) {
    errors.endpoint = "Endpoint is required for S3-compatible providers.";
  }

  if (input.endpoint.trim()) {
    try {
      new URL(normalizeEndpoint(input.endpoint, input.useSsl));
    } catch {
      errors.endpoint = "Enter a valid endpoint URL or hostname.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function normalizeEndpoint(endpoint: string, useSsl: boolean): string {
  const trimmedEndpoint = endpoint.trim().replace(/\/+$/, "");

  if (!trimmedEndpoint) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmedEndpoint)) {
    const url = new URL(trimmedEndpoint);
    url.protocol = useSsl ? "https:" : "http:";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  }

  return `${useSsl ? "https" : "http"}://${trimmedEndpoint}`;
}
