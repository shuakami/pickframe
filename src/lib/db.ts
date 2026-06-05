"use client";
 
import Dexie, { type Table } from "dexie";
import type {
  Project,
  Page,
  Tag,
  Version,
  SavedView,
  Blob_,
} from "./types";
 
class PickframeDB extends Dexie {
 projects!: Table<Project, string>;
 pages!: Table<Page, string>;
 tags!: Table<Tag, string>;
 versions!: Table<Version, string>;
 views!: Table<SavedView, string>;
 blobs!: Table<Blob_, string>;
 
 constructor() {
 super("pickframe");
 this.version(1).stores({
      projects: "id, name, updatedAt",
      pages: "id, projectId, order",
      tags: "id, projectId, name",
      versions: "id, pageId, projectId, verdict, updatedAt",
      views: "id",
      blobs: "id",
    });
  }
}
 
let _db: PickframeDB | null = null;
 
export function getDB(): PickframeDB {
 if (typeof window === "undefined") {
 throw new Error("getDB() called on server");
  }
 if (!_db) _db = new PickframeDB();
 return _db;
}
 
export async function saveBlob(id: string, data: Blob): Promise<void> {
 await getDB().blobs.put({ id, data, type: data.type });
}

export async function getBlob(id: string): Promise<Blob | undefined> {
 const row = await getDB().blobs.get(id);
 return row?.data;
}
 
const objectUrlCache = new Map<string, string>();

/**
 * Synchronous cache hit, or `undefined` if the blob hasn't been resolved yet.
 * Lets consumers (e.g. <Thumb>) paint a previously-decoded image on the very
 * first render — no loading flash, no extra state-update render — while still
 * falling back to the async `getBlobUrl` for cold blobs.
 */
export function peekBlobUrl(id: string | undefined): string | undefined {
 if (!id) return undefined;
 return objectUrlCache.get(id);
}
 
export async function getBlobUrl(id: string): Promise<string | undefined> {
 const cached = objectUrlCache.get(id);
 if (cached) return cached;
 const row = await getDB().blobs.get(id);
 if (!row) return undefined;
 const url = URL.createObjectURL(row.data);
  objectUrlCache.set(id, url);
 return url;
}
 
export function revokeBlobUrl(id: string) {
 const url = objectUrlCache.get(id);
 if (url) {
 URL.revokeObjectURL(url);
    objectUrlCache.delete(id);
  }
}
 
export async function deleteBlob(id: string): Promise<void> {
 revokeBlobUrl(id);
 await getDB().blobs.delete(id);
}
