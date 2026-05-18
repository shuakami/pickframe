"use client";

/* ============================================================
 * Pickframe — Portable archive (import/export)
 *
 * On disk:
 *   data.json          — single JSON manifest; blob bytes live in blobs/
 *   blobs/<id>_data.<ext>
 *
 * data.json schema (top-level):
 *   {
 *     "format": "pickframe",
 *     "version": 1,
 *     "exportedAt": <epoch_ms>,
 *     "projects": Project[],
 *     "pages": Page[],
 *     "tags": Tag[],
 *     "versions": Version[],
 *     "blobs": [{ id, data: "__file__:blobs/<id>_data.<ext>", type }]
 *   }
 *
 * Blob bytes are externalised to keep the manifest small and make
 * the archive grep-able / version-control-friendly. Older / partial
 * archives (only the `blobs` array, e.g. a Frame.io-style annotation
 * dump) are still importable: any blobs without matching versions
 * become orphan placeholder versions in a generated "Imported" page.
 * ============================================================ */

// JSZip + file-saver are only needed once the user actually hits
// Import/Export. They alone weigh ~200 kB minified, so we lazy-load them
// at call sites instead of pulling them into the main app bundle.
import type JSZipType from "jszip";
import { nanoid } from "nanoid";
import type {
  Page,
  Project,
  Tag,
  Version,
  Annotations,
} from "./types";
import { EMPTY_ANNOTATIONS } from "./types";
import { getDB, saveBlob } from "./db";
import { makeThumbnail } from "./thumbnail";

async function loadJSZip(): Promise<typeof JSZipType> {
  const mod = await import("jszip");
  return mod.default;
}

async function loadSaveAs(): Promise<(blob: Blob, name: string) => void> {
  const mod = await import("file-saver");
  return mod.saveAs;
}

const FILE_REF_PREFIX = "__file__:";

export interface PortableManifest {
  format?: string;
  version?: number;
  exportedAt?: number;
  projects?: Project[];
  pages?: Page[];
  tags?: Tag[];
  versions?: Version[];
  blobs: PortableBlobRef[];
}

export interface PortableBlobRef {
  id: string;
  /** Either a data URL ("data:..."), a "__file__:..." pointer, or raw base64. */
  data: string;
  type: string;
}

export interface ImportSummary {
  projects: number;
  pages: number;
  tags: number;
  versions: number;
  blobs: number;
  orphanVersions: number;
}

/* -------------------------------------------------------------
 * EXPORT
 * ----------------------------------------------------------- */

export interface ExportArchiveOptions {
  /** Restrict to a specific project. If omitted, exports the full library. */
  projectId?: string;
  /** Filename without extension. */
  filename?: string;
  /** Progress callback (0..1). */
  onProgress?: (msg: string, frac: number) => void;
}

export async function exportArchive({
  projectId,
  filename = "pickframe-export",
  onProgress,
}: ExportArchiveOptions = {}): Promise<void> {
  const db = getDB();

  onProgress?.("Reading library…", 0.05);
  const [allProjects, allPages, allTags, allVersions] = await Promise.all([
    db.projects.toArray(),
    db.pages.toArray(),
    db.tags.toArray(),
    db.versions.toArray(),
  ]);

  const projects = projectId
    ? allProjects.filter((p) => p.id === projectId)
    : allProjects;
  const projectIds = new Set(projects.map((p) => p.id));
  const pages = allPages.filter((p) => projectIds.has(p.projectId));
  const tags = allTags.filter((t) => projectIds.has(t.projectId));
  const versions = allVersions.filter((v) => projectIds.has(v.projectId));

  // Collect every referenced blob id.
  const blobIds = new Set<string>();
  for (const v of versions) {
    if (v.blobId) blobIds.add(v.blobId);
    if (v.thumbBlobId) blobIds.add(v.thumbBlobId);
  }

  const JSZip = await loadJSZip();
  const zip = new JSZip();
  const blobsFolder = zip.folder("blobs");
  if (!blobsFolder) throw new Error("Failed to create blobs folder");

  // Concurrently fetch blobs from IndexedDB. Sequential `await db.blobs.get()`
  // for hundreds of ids is what made library export crawl on big libraries.
  const ids = Array.from(blobIds);
  const blobRefs: PortableBlobRef[] = [];
  let done = 0;
  const CONCURRENCY = 8;
  const queue = ids.slice();
  const work = async () => {
    while (queue.length) {
      const id = queue.shift()!;
      const row = await db.blobs.get(id);
      done += 1;
      onProgress?.(
        `Packing blob ${done}/${ids.length}`,
        0.1 + (0.7 * done) / ids.length,
      );
      if (!row) continue;
      const ext = extensionFor(row.type) ?? "bin";
      const filePath = `blobs/${id}_data.${ext}`;
      blobsFolder.file(`${id}_data.${ext}`, row.data);
      blobRefs.push({
        id,
        data: `${FILE_REF_PREFIX}${filePath}`,
        type: row.type,
      });
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => work()),
  );

  const manifest: PortableManifest = {
    format: "pickframe",
    version: 1,
    exportedAt: Date.now(),
    projects,
    pages,
    tags,
    versions,
    blobs: blobRefs,
  };

  zip.file("data.json", JSON.stringify(manifest, null, 2));

  onProgress?.("Compressing…", 0.85);
  // PNG/JPEG bytes are already compressed; DEFLATE just adds CPU time
  // for ~0% size win. STORE keeps the export fast and the resulting zip
  // is roughly the same size.
  const out = await zip.generateAsync(
    { type: "blob", compression: "STORE" },
    (m) =>
      onProgress?.(
        `Compressing ${m.percent.toFixed(0)}%`,
        0.85 + 0.14 * (m.percent / 100),
      ),
  );

  const saveAs = await loadSaveAs();
  saveAs(out, `${safeFilename(filename)}.zip`);
  onProgress?.("Done", 1);
}

/* -------------------------------------------------------------
 * IMPORT
 * ----------------------------------------------------------- */

export interface ImportSource {
  /** A single .zip file selected by the user. */
  zipFile?: File;
  /**
   * A flat list of files (e.g. from a directory picker via webkitdirectory,
   * or from drag-and-drop). The list must include data.json at any depth.
   */
  files?: File[];
}

export type ImportMode =
  | "merge" // keep existing data, add imported items with fresh ids when colliding
  | "replace"; // wipe everything first, then import as-is

export interface ImportOptions {
  source: ImportSource;
  mode?: ImportMode;
  onProgress?: (msg: string, frac: number) => void;
}

export async function importArchive({
  source,
  mode = "merge",
  onProgress,
}: ImportOptions): Promise<ImportSummary> {
  onProgress?.("Reading archive…", 0.02);

  const fileMap = await readSourceIntoFileMap(source);
  if (!fileMap.has("data.json")) {
    throw new Error("data.json not found in archive");
  }

  const manifestText = await fileToText(fileMap.get("data.json")!);
  let manifest: PortableManifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    throw new Error("data.json is not valid JSON");
  }
  if (!manifest || !Array.isArray(manifest.blobs)) {
    throw new Error("data.json missing required 'blobs' array");
  }

  const db = getDB();

  if (mode === "replace") {
    onProgress?.("Clearing existing data…", 0.05);
    await Promise.all([
      db.projects.clear(),
      db.pages.clear(),
      db.tags.clear(),
      db.versions.clear(),
      db.blobs.clear(),
      db.views.clear(),
    ]);
  }

  // Existing ids (for merge collision detection).
  const existing = {
    projects: new Set((await db.projects.toArray()).map((p) => p.id)),
    pages: new Set((await db.pages.toArray()).map((p) => p.id)),
    tags: new Set((await db.tags.toArray()).map((t) => t.id)),
    versions: new Set((await db.versions.toArray()).map((v) => v.id)),
    blobs: new Set((await db.blobs.toArray()).map((b) => b.id)),
  };

  // ID remap tables — used in merge mode to avoid collisions while keeping
  // cross-references intact.
  const remap = {
    project: new Map<string, string>(),
    page: new Map<string, string>(),
    tag: new Map<string, string>(),
    blob: new Map<string, string>(),
    version: new Map<string, string>(),
  };
  const newId = (
    table: keyof typeof existing,
    map: Map<string, string>,
    oldId: string,
    size = 8,
  ) => {
    if (map.has(oldId)) return map.get(oldId)!;
    const collide =
      mode === "merge" && existing[table].has(oldId);
    const fresh = collide ? nanoid(size) : oldId;
    map.set(oldId, fresh);
    return fresh;
  };

  /* 1. Blobs — load bytes from referenced files, write into IndexedDB. */
  const blobs = manifest.blobs;
  let blobOk = 0;
  for (let i = 0; i < blobs.length; i += 1) {
    const ref = blobs[i];
    onProgress?.(
      `Importing blob ${i + 1}/${blobs.length}`,
      0.1 + (0.6 * i) / Math.max(blobs.length, 1),
    );
    const blobData = await resolveBlobRef(ref, fileMap);
    if (!blobData) continue;
    const newBlobId = newId("blobs", remap.blob, ref.id, 10);
    await saveBlob(newBlobId, blobData);
    blobOk += 1;
  }

  /* 2. Projects */
  const projects = manifest.projects ?? [];
  for (const p of projects) {
    const id = newId("projects", remap.project, p.id, 8);
    await db.projects.put({ ...p, id });
  }

  /* 3. Pages */
  const pages = manifest.pages ?? [];
  for (const p of pages) {
    const id = newId("pages", remap.page, p.id, 8);
    const projectId = remap.project.get(p.projectId) ?? p.projectId;
    await db.pages.put({ ...p, id, projectId });
  }

  /* 4. Tags */
  const tags = manifest.tags ?? [];
  for (const t of tags) {
    const id = newId("tags", remap.tag, t.id, 6);
    const projectId = remap.project.get(t.projectId) ?? t.projectId;
    await db.tags.put({ ...t, id, projectId });
  }

  /* 5. Versions */
  const versions = manifest.versions ?? [];
  for (const v of versions) {
    const id = newId("versions", remap.version, v.id, 10);
    const projectId = remap.project.get(v.projectId) ?? v.projectId;
    const pageId = remap.page.get(v.pageId) ?? v.pageId;
    const blobId = remap.blob.get(v.blobId) ?? v.blobId;
    const thumbBlobId = v.thumbBlobId
      ? remap.blob.get(v.thumbBlobId) ?? v.thumbBlobId
      : undefined;
    const tagIds = (v.tagIds ?? []).map(
      (tid) => remap.tag.get(tid) ?? tid,
    );
    await db.versions.put({
      ...v,
      id,
      projectId,
      pageId,
      blobId,
      thumbBlobId,
      tagIds,
      annotations: ensureAnnotations(v.annotations),
    });
  }

  /* 6. Orphan blobs — manifests that ship blobs without versions
   *    (e.g. a raw image dump). Synthesise an "Imported" project with one
   *    page per archive and one version per orphan blob, so the user
   *    actually gets to see them. */
  const claimedBlobIds = new Set<string>();
  for (const v of versions) {
    if (v.blobId) claimedBlobIds.add(remap.blob.get(v.blobId) ?? v.blobId);
    if (v.thumbBlobId)
      claimedBlobIds.add(remap.blob.get(v.thumbBlobId) ?? v.thumbBlobId);
  }
  const orphanBlobIds = blobs
    .map((b) => remap.blob.get(b.id) ?? b.id)
    .filter((id) => !claimedBlobIds.has(id));

  let orphanVersions = 0;
  if (orphanBlobIds.length > 0) {
    onProgress?.("Restoring orphan images…", 0.78);
    const projectId = nanoid(8);
    const pageId = nanoid(8);
    const ts = Date.now();
    await db.projects.put({
      id: projectId,
      name: "Imported",
      createdAt: ts,
      updatedAt: ts,
    });
    await db.pages.put({
      id: pageId,
      projectId,
      name: "Imported images",
      order: 1,
      createdAt: ts,
    });
    let n = 1;
    for (const bid of orphanBlobIds) {
      const row = await db.blobs.get(bid);
      if (!row) continue;
      // Build a thumbnail so the version shows up nicely on the board.
      let width = 0;
      let height = 0;
      let thumbBlobId: string | undefined;
      try {
        const t = await makeThumbnail(row.data, 640);
        width = t.width;
        height = t.height;
        thumbBlobId = nanoid(10);
        await saveBlob(thumbBlobId, t.blob);
      } catch {
        /* leave thumb undefined */
      }
      await db.versions.put({
        id: nanoid(10),
        projectId,
        pageId,
        label: `v${n}`,
        blobId: bid,
        thumbBlobId,
        width,
        height,
        rating: 0,
        verdict: "unset",
        tagIds: [],
        note: "",
        annotations: { ...EMPTY_ANNOTATIONS },
        createdAt: ts,
        updatedAt: ts,
      });
      n += 1;
      orphanVersions += 1;
    }
  }

  onProgress?.("Done", 1);

  return {
    projects: projects.length,
    pages: pages.length,
    tags: tags.length,
    versions: versions.length,
    blobs: blobOk,
    orphanVersions,
  };
}

/* -------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------- */

/**
 * Materialise the user's input (zip OR list of files) into a flat
 * `relPath -> File` map. Inside zips, the contents are extracted as
 * Blob/File-likes. Directory drops normalise webkitRelativePath /
 * fullPath, stripping the top-level folder so `./pickframe/data.json`
 * and `./data.json` both resolve to "data.json".
 */
async function readSourceIntoFileMap(
  source: ImportSource,
): Promise<Map<string, File | Blob>> {
  const map = new Map<string, File | Blob>();

  if (source.zipFile) {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(source.zipFile);
    const entries = Object.values(zip.files);
    // Strip a single leading directory if every entry shares it.
    const topPrefix = commonTopPrefix(
      entries.map((e) => e.name).filter((n) => !n.endsWith("/")),
    );
    for (const entry of entries) {
      if (entry.dir) continue;
      const blob = await entry.async("blob");
      const rel = topPrefix ? entry.name.slice(topPrefix.length) : entry.name;
      map.set(normaliseRel(rel), blob);
    }
    return map;
  }

  if (source.files && source.files.length > 0) {
    const paths = source.files.map((f) => relPathOf(f));
    const topPrefix = commonTopPrefix(paths);
    for (const f of source.files) {
      const rel = relPathOf(f);
      const trimmed = topPrefix ? rel.slice(topPrefix.length) : rel;
      map.set(normaliseRel(trimmed), f);
    }
    return map;
  }

  throw new Error("Empty import source");
}

function relPathOf(file: File): string {
  // webkitRelativePath is set when picked via webkitdirectory.
  // Drag-and-drop with directory entries also includes path on the file.
  type FileLike = File & { webkitRelativePath?: string; path?: string };
  const fl = file as FileLike;
  const rel = fl.webkitRelativePath || fl.path || file.name;
  return rel.replace(/\\/g, "/").replace(/^\.\//, "");
}

function normaliseRel(rel: string): string {
  return rel.replace(/\\/g, "/").replace(/^\/+/, "");
}

/** Longest common leading directory across a list of paths, including
 * the trailing "/". Returns "" if not all paths share one. */
function commonTopPrefix(paths: string[]): string {
  if (paths.length === 0) return "";
  const firstSlash = paths[0].indexOf("/");
  if (firstSlash < 0) return "";
  const candidate = paths[0].slice(0, firstSlash + 1);
  for (const p of paths) {
    if (!p.startsWith(candidate)) return "";
  }
  return candidate;
}

async function fileToText(f: File | Blob): Promise<string> {
  return await f.text();
}

async function resolveBlobRef(
  ref: PortableBlobRef,
  fileMap: Map<string, File | Blob>,
): Promise<Blob | null> {
  if (typeof ref.data !== "string") return null;
  if (ref.data.startsWith(FILE_REF_PREFIX)) {
    const path = ref.data.slice(FILE_REF_PREFIX.length);
    const norm = normaliseRel(path);
    const found = fileMap.get(norm);
    if (!found) {
      // try alternate "blobs/<id>_data.<ext>" lookups by id prefix
      for (const [k, v] of fileMap) {
        if (k.startsWith(`blobs/${ref.id}_data.`)) return v;
      }
      return null;
    }
    return found;
  }
  if (ref.data.startsWith("data:")) {
    const res = await fetch(ref.data);
    return await res.blob();
  }
  // Plain base64 fallback.
  try {
    const bytes = atob(ref.data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: ref.type || "application/octet-stream" });
  } catch {
    return null;
  }
}

function ensureAnnotations(a: Annotations | undefined): Annotations {
  if (!a) return { ...EMPTY_ANNOTATIONS };
  return {
    strokes: Array.isArray(a.strokes) ? a.strokes : [],
    shapes: Array.isArray(a.shapes) ? a.shapes : [],
    notes: Array.isArray(a.notes) ? a.notes : [],
  };
}

function extensionFor(mime: string): string | null {
  if (!mime) return null;
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpeg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  // Fallback: take the bit after "/", strip "+xml" etc.
  const m = mime.match(/^[^/]+\/([^+;]+)/);
  return m?.[1] ?? null;
}

function safeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "-").trim() || "pickframe-export";
}
