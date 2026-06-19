export type S3ErrorCategory =
  | "auth"
  | "permission"
  | "notFound"
  | "network"
  | "timeout"
  | "bucket"
  | "unknown";

interface CategorizedError {
  category: S3ErrorCategory;
  message: string;
  userMessage: string;
  retryable: boolean;
  actionable: boolean;
  actionLabel?: string;
  actionHint?: string;
}

function matchCategory(error: Error): S3ErrorCategory {
  const msg = error.message.toLowerCase();

  if (
    msg.includes("access denied") ||
    msg.includes("forbidden") ||
    msg.includes("authorization") ||
    msg.includes("invalidsecurity") ||
    msg.includes("signaturedoesnotmatch") ||
    msg.includes("credentials") ||
    msg.includes("accesskey")
  ) {
    return "auth";
  }

  if (msg.includes("notfound") || msg.includes("nosuchbucket") || msg.includes("nosuchkey")) {
    return "notFound";
  }

  if (msg.includes("accessdenied") || msg.includes("permission")) {
    return "permission";
  }

  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("etimedout")) {
    return "timeout";
  }

  if (
    msg.includes("network") ||
    msg.includes("enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed") ||
    msg.includes("socket") ||
    msg.includes("econnreset")
  ) {
    return "network";
  }

  if (msg.includes("bucket") || msg.includes("invalidbucketname")) {
    return "bucket";
  }

  return "unknown";
}

const userMessages: Record<S3ErrorCategory, string> = {
  auth: "Authentication failed. Your credentials may be invalid or expired.",
  permission: "You don't have permission to access this resource.",
  notFound: "The requested resource was not found.",
  network: "Network error. Check your connection and try again.",
  timeout: "Request timed out. The server may be slow or unreachable.",
  bucket: "There was a problem with the bucket.",
  unknown: "An unexpected error occurred.",
};

const retryableCategories: Set<S3ErrorCategory> = new Set(["network", "timeout"]);

const actionLabels: Partial<Record<S3ErrorCategory, string>> = {
  auth: "Reconnect",
  network: "Retry",
  timeout: "Retry",
};

export function categorizeS3Error(error: unknown): CategorizedError {
  if (error instanceof Error) {
    const category = matchCategory(error);

    return {
      category,
      message: error.message,
      userMessage: userMessages[category],
      retryable: retryableCategories.has(category),
      actionable: category === "auth" || category === "network" || category === "timeout",
      actionLabel: actionLabels[category],
      actionHint: category === "auth" ? "Try reconnecting with valid credentials." : undefined,
    };
  }

  return {
    category: "unknown",
    message: String(error),
    userMessage: userMessages.unknown,
    retryable: false,
    actionable: false,
  };
}
