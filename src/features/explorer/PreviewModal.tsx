import { useCallback } from "react";
import { Download, FileSymlink, X } from "lucide-react";

import { Button } from "@cloudflare/kumo/components/button";
import { usePreviewStore } from "@/stores/previewStore";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "image/avif",
]);

const TEXT_TYPES = new Set([
  "text/plain",
  "text/csv",
  "text/xml",
  "text/html",
  "text/css",
  "application/xml",
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/yaml",
]);

const EXTENSION_MAP: Record<string, string> = {
  json: "application/json",
  txt: "text/plain",
  csv: "text/csv",
  xml: "text/xml",
  html: "text/html",
  css: "text/css",
  js: "application/javascript",
  ts: "application/typescript",
  tsx: "application/typescript",
  jsx: "application/javascript",
  yaml: "application/yaml",
  yml: "application/yaml",
  md: "text/markdown",
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
  avif: "image/avif",
};

function detectMimeType(contentType: string, key: string): string {
  if (
    contentType &&
    contentType !== "application/octet-stream" &&
    contentType !== "binary/octet-stream"
  ) {
    return contentType;
  }
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? "application/octet-stream";
}

function isPreviewable(mimeType: string): boolean {
  return IMAGE_TYPES.has(mimeType) || TEXT_TYPES.has(mimeType) || mimeType === "application/pdf";
}

function ImagePreview({ src, name }: { src: string; name: string }) {
  return (
    <div className="flex items-center justify-center">
      <img src={src} alt={name} className="max-h-[70vh] max-w-full rounded object-contain" />
    </div>
  );
}

function TextPreview({ text }: { text: string }) {
  return (
    <pre className="max-h-[70vh] overflow-auto rounded bg-muted p-4 text-xs leading-relaxed">
      {text}
    </pre>
  );
}

function JsonPreview({ text }: { text: string }) {
  let formatted = text;
  try {
    formatted = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // use raw text if JSON parsing fails
  }

  return (
    <pre className="max-h-[70vh] overflow-auto rounded bg-muted p-4 text-xs leading-relaxed">
      {formatted}
    </pre>
  );
}

function PdfPreview({ data, mimeType }: { data: string; mimeType: string }) {
  return (
    <embed
      src={`data:${mimeType};base64,${data}`}
      type={mimeType}
      className="h-[70vh] w-full rounded"
    />
  );
}

function byteSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function PreviewModal() {
  const { isOpen, file, content, status, error, closePreview } = usePreviewStore();

  const handleClose = useCallback(() => {
    closePreview();
  }, [closePreview]);

  if (!isOpen || !file) return null;

  const mimeType = content
    ? detectMimeType(content.contentType, file.key)
    : "application/octet-stream";
  const dataUrl = content ? `data:${mimeType};base64,${content.bodyBase64}` : "";

  const renderContent = () => {
    if (status === "loading") {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-3 size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading preview...</p>
          </div>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-sm text-destructive">Failed to load preview</p>
            {error && <p className="mt-1 text-xs text-muted-foreground">{error}</p>}
          </div>
        </div>
      );
    }

    if (!content) return null;

    if (!isPreviewable(mimeType)) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <FileSymlink className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Preview not available for this file type
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{mimeType}</p>
          </div>
        </div>
      );
    }

    if (IMAGE_TYPES.has(mimeType)) {
      return <ImagePreview src={dataUrl} name={file.name} />;
    }

    if (mimeType === "application/json") {
      const text = atob(content.bodyBase64);
      return <JsonPreview text={text} />;
    }

    if (mimeType === "application/pdf") {
      return <PdfPreview data={content.bodyBase64} mimeType={mimeType} />;
    }

    if (TEXT_TYPES.has(mimeType)) {
      const text = atob(content.bodyBase64);
      return <TextPreview text={text} />;
    }

    return null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold">{file.name}</h3>
            {content && (
              <p className="text-xs text-muted-foreground">
                {mimeType} · {byteSize(content.size)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {content && (
              <Button type="button" variant="ghost" size="sm" shape="square" aria-label="Download">
                <Download className="size-3.5" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Close"
              onClick={handleClose}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="overflow-auto p-5">{renderContent()}</div>
      </div>
    </div>
  );
}
