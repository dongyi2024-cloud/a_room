export function isSupportedEpubFile(fileName: string, mimeType?: string | null) {
  const normalizedType = (mimeType || "").toLowerCase();

  return (
    fileName.toLowerCase().endsWith(".epub") ||
    normalizedType === "application/epub+zip" ||
    normalizedType === "application/octet-stream"
  );
}

export function getDisplayFileStem(fileName: string) {
  return fileName
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "")
    .trim();
}

export function sanitizeStorageStem(fileName: string) {
  return getDisplayFileStem(fileName)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function toShortErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 400);
  }

  return "Unknown import error";
}
