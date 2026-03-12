import fs from "fs/promises";
import path from "path";
import { del, put } from "@vercel/blob";
import { getUploadsDir } from "./app";

type StoredFileInput = {
  buffer: Buffer;
  originalName: string;
  contentType: string;
  folder: "reference-files" | "media-assets";
};

type StoredFileResult = {
  storageKey: string;
};

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isRemoteStorageEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isRemoteStoredFile(storageKey: string) {
  return /^https?:\/\//i.test(storageKey);
}

export async function readStoredFile(storageKey: string) {
  if (isRemoteStoredFile(storageKey)) {
    const response = await fetch(storageKey);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob file: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const filePath = path.join(getUploadsDir(), storageKey);
  return fs.readFile(filePath);
}

export async function storeFile(input: StoredFileInput): Promise<StoredFileResult> {
  if (isRemoteStorageEnabled()) {
    const blobPath = `${input.folder}/${Date.now()}-${sanitizeFilename(input.originalName)}`;
    const blob = await put(blobPath, input.buffer, {
      access: "public",
      contentType: input.contentType,
      addRandomSuffix: true,
    });

    return {
      storageKey: blob.url,
    };
  }

  const uploadsDir = getUploadsDir();
  const localFilename = `${Date.now()}-${sanitizeFilename(input.originalName)}`;
  const filePath = path.join(uploadsDir, localFilename);
  await fs.writeFile(filePath, input.buffer);

  return {
    storageKey: localFilename,
  };
}

export async function deleteStoredFile(storageKey: string) {
  if (isRemoteStoredFile(storageKey)) {
    await del(storageKey);
    return;
  }

  const filePath = path.join(getUploadsDir(), storageKey);
  await fs.unlink(filePath).catch(() => undefined);
}
