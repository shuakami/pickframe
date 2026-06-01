"use client";
 
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import { nanoid } from "nanoid";

// Required so immer can produce/track drafts of Map and Set instances.
// Without this, mutations like `s.selectedIds.delete(id)` silently fail
// and selectors don't see updated state until the next full reload.
enableMapSet();
import {
  EMPTY_ANNOTATIONS,
 type Annotations,
 type FilterQuery,
 type Page,
 type Project,
 type Tag,
 type Verdict,
 type Version,
} from "./types";
import {
  deleteBlob,
  getDB,
  saveBlob,
} from "./db";
import { makeThumbnail } from "./thumbnail";
import { pickTagColor } from "./utils";
 
export type ViewMode = "board" | "compare" | "single" | "flow";
export type Theme = "light" | "dark";
 
interface UIState {
 theme: Theme;
 viewMode: ViewMode;
 activeProjectId: string | null;
 /** When in single view, which version is open. Also drives Inspector. */
 focusedVersionId: string | null;
 /** When in compare view, which versions are pinned (any number, laid out side by side). */
 compareIds: string[];
 /** Multi-select set (board view). */
 selectedIds: Set<string>;
 /** Filter state. */
 filter: FilterQuery;
 /** Search text in command palette / top search. */
 search: string;
 commandOpen: boolean;
 filterOpen: boolean;
 /** Desktop sidebar collapsed (manual toggle). Persisted via localStorage. */
 sidebarCollapsed: boolean;
 exportOpen: boolean;
 importOpen: boolean;
 /** Optional file pre-selected to import (e.g. via global drop). Drained when dialog opens. */
 pendingImportFile: File | null;
 /** Page filter pinning */
 activePageId: string | null;
 /** Last scroll position of the Board view, restored after returning from Single. */
 boardScrollTop: number;
}
 
interface DataState {
 projects: Project[];
 pages: Page[];
 tags: Tag[];
 versions: Version[];
 loaded: boolean;
}
 
interface Actions {
 // Bootstrap
 loadAll: () => Promise<void>;
 setTheme: (t: Theme) => void;
 toggleTheme: () => void;
 setViewMode: (v: ViewMode) => void;
 
 // Project / Page / Tag CRUD
 addProject: (name: string, emoji?: string) => Promise<Project>;
 renameProject: (id: string, name: string) => Promise<void>;
 setFlowAnnotations: (
 projectId: string,
 next:
 | import("./types").Annotations
 | ((cur: import("./types").Annotations) => import("./types").Annotations),
  ) => Promise<void>;
 deleteProject: (id: string) => Promise<void>;
 setActiveProject: (id: string | null) => void;
 
 addPage: (projectId: string, name: string) => Promise<Page>;
 renamePage: (id: string, name: string) => Promise<void>;
 deletePage: (id: string) => Promise<void>;
 reorderPages: (projectId: string, orderedIds: string[]) => Promise<void>;
 setActivePage: (id: string | null) => void;
 
 addTag: (projectId: string, name: string, color?: string) => Promise<Tag>;
 deleteTag: (id: string) => Promise<void>;
 
 // Versions (the heart)
 importImages: (
 projectId: string,
 pageId: string,
 files: File[],
  ) => Promise<Version[]>;
 updateVersion: (id: string, patch: Partial<Version>) => Promise<void>;
 setVerdict: (id: string, verdict: Verdict) => Promise<void>;
 setRating: (id: string, rating: number) => Promise<void>;
 setNote: (id: string, note: string) => Promise<void>;
 toggleTag: (id: string, tagId: string) => Promise<void>;
 movePage: (versionId: string, pageId: string) => Promise<void>;
 duplicateVersion: (id: string) => Promise<Version | null>;
 deleteVersion: (id: string) => Promise<void>;
 setAnnotations: (id: string, ann: Annotations) => Promise<void>;
 
 // Selection
 toggleSelected: (id: string, mode?: "set" | "add" | "range") => void;
 clearSelected: () => void;
 setSelected: (ids: string[]) => void;
 setFocused: (id: string | null) => void;
 toggleCompare: (id: string) => void;
 setCompare: (ids: string[]) => void;
 
 // Filter
 setFilter: (f: Partial<FilterQuery>) => void;
 resetFilter: () => void;
 setSearch: (q: string) => void;
 setCommandOpen: (b: boolean) => void;
 setFilterOpen: (b: boolean) => void;
 setSidebarCollapsed: (b: boolean) => void;
 toggleSidebarCollapsed: () => void;
 setExportOpen: (b: boolean) => void;
 setImportOpen: (b: boolean) => void;
 setPendingImportFile: (f: File | null) => void;
 setBoardScrollTop: (n: number) => void;
}
 
type Store = UIState & DataState & Actions;
 
const now = () => Date.now();

// Delete a blob only if no surviving Version (after `excludeIds` are removed)
// references it. Without this, deleting a duplicated version would also nuke
// the blob still in use by the original — silent data loss.
async function maybeDeleteBlob(
 blobId: string | undefined,
  surviving: Version[],
  excludeIds: ReadonlySet<string>,
): Promise<void> {
 if (!blobId) return;
 const stillUsed = surviving.some(
    (v) =>
      !excludeIds.has(v.id) &&
      (v.blobId === blobId || v.thumbBlobId === blobId),
  );
 if (!stillUsed) await deleteBlob(blobId);
}
 
export const useStore = create<Store>()(
 immer((set, get) => ({
 // UI
    theme: "light",
    viewMode: "board",
    activeProjectId: null,
    focusedVersionId: null,
    compareIds: [],
    selectedIds: new Set<string>(),
    filter: {},
    search: "",
    commandOpen: false,
    filterOpen: false,
    sidebarCollapsed:
 typeof window !== "undefined" &&
      window.localStorage?.getItem("pf:sidebar-collapsed") === "1",
    exportOpen: false,
    importOpen: false,
    pendingImportFile: null,
    activePageId: null,
    boardScrollTop: 0,
 
 // Data
    projects: [],
    pages: [],
    tags: [],
    versions: [],
    loaded: false,
 
 setTheme(t) {
 set((s) => {
        s.theme = t;
      });
 if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", t === "dark");
 try {
          localStorage.setItem("pickframe-theme", t);
        } catch {}
      }
    },
 toggleTheme() {
 get().setTheme(get().theme === "dark" ? "light" : "dark");
    },
 setViewMode(v) {
 set((s) => {
        s.viewMode = v;
      });
    },
 
 async loadAll() {
 const db = getDB();
 const [projects, pages, tags, versions] = await Promise.all([
        db.projects.toArray(),
        db.pages.toArray(),
        db.tags.toArray(),
        db.versions.toArray(),
      ]);
 // Sync the store with whatever theme the inline boot script applied.
 let bootTheme: Theme | null = null;
 if (typeof window !== "undefined") {
 try {
 const saved = localStorage.getItem("pickframe-theme");
 if (saved === "dark" || saved === "light") {
            bootTheme = saved;
          } else if (
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
          ) {
            bootTheme = "dark";
          } else {
            bootTheme = "light";
          }
        } catch {}
      }
 set((s) => {
        s.projects = projects.sort((a, b) => b.updatedAt - a.updatedAt);
        s.pages = pages;
        s.tags = tags;
        s.versions = versions;
        s.loaded = true;
 if (bootTheme) s.theme = bootTheme;
 if (!s.activeProjectId && projects[0])
          s.activeProjectId = projects[0].id;
      });
    },
 
 async addProject(name, emoji) {
 const p: Project = {
        id: nanoid(8),
        name,
        emoji,
        createdAt: now(),
        updatedAt: now(),
      };
 await getDB().projects.put(p);
 set((s) => {
        s.projects.unshift(p);
        s.activeProjectId = p.id;
      });
 return p;
    },
 async renameProject(id, name) {
 await getDB().projects.update(id, { name, updatedAt: now() });
 set((s) => {
 const p = s.projects.find((x) => x.id === id);
 if (p) {
          p.name = name;
          p.updatedAt = now();
        }
      });
    },
 async setFlowAnnotations(projectId, next) {
 const cur =
        get().projects.find((p) => p.id === projectId)?.flowAnnotations ??
 ({ strokes: [], shapes: [], notes: [] } as import("./types").Annotations);
 const value =
 typeof next === "function"
 ? (next as (a: import("./types").Annotations) => import("./types").Annotations)(cur)
 : next;
 await getDB().projects.update(projectId, {
        flowAnnotations: value,
        updatedAt: now(),
      });
 set((s) => {
 const p = s.projects.find((x) => x.id === projectId);
 if (p) {
          p.flowAnnotations = value;
          p.updatedAt = now();
        }
      });
    },
 async deleteProject(id) {
 const db = getDB();
 const versions = await db.versions.where({ projectId: id }).toArray();
 const surviving = get().versions;
 const excludeIds = new Set(versions.map((v) => v.id));
 await Promise.all(
        versions.flatMap((v) => [
          maybeDeleteBlob(v.blobId, surviving, excludeIds),
          maybeDeleteBlob(v.thumbBlobId, surviving, excludeIds),
        ]),
      );
 await db.versions.where({ projectId: id }).delete();
 await db.pages.where({ projectId: id }).delete();
 await db.tags.where({ projectId: id }).delete();
 await db.projects.delete(id);
 set((s) => {
        s.projects = s.projects.filter((p) => p.id !== id);
        s.pages = s.pages.filter((p) => p.projectId !== id);
        s.tags = s.tags.filter((t) => t.projectId !== id);
        s.versions = s.versions.filter((v) => v.projectId !== id);
 if (s.activeProjectId === id)
          s.activeProjectId = s.projects[0]?.id ?? null;
      });
    },
 setActiveProject(id) {
 set((s) => {
        s.activeProjectId = id;
        s.activePageId = null;
        s.selectedIds = new Set();
        s.focusedVersionId = null;
      });
    },
 
 async addPage(projectId, name) {
 const order =
        (get().pages.filter((p) => p.projectId === projectId).length || 0) + 1;
 const p: Page = {
        id: nanoid(8),
        projectId,
        name,
        order,
        createdAt: now(),
      };
 await getDB().pages.put(p);
 set((s) => {
        s.pages.push(p);
      });
 return p;
    },
 async renamePage(id, name) {
 await getDB().pages.update(id, { name });
 set((s) => {
 const p = s.pages.find((x) => x.id === id);
 if (p) p.name = name;
      });
    },
 async deletePage(id) {
 const db = getDB();
 const versions = await db.versions.where({ pageId: id }).toArray();
 const surviving = get().versions;
 const excludeIds = new Set(versions.map((v) => v.id));
 await Promise.all(
        versions.flatMap((v) => [
          maybeDeleteBlob(v.blobId, surviving, excludeIds),
          maybeDeleteBlob(v.thumbBlobId, surviving, excludeIds),
        ]),
      );
 await db.versions.where({ pageId: id }).delete();
 await db.pages.delete(id);
 set((s) => {
        s.pages = s.pages.filter((p) => p.id !== id);
        s.versions = s.versions.filter((v) => v.pageId !== id);
 if (s.activePageId === id) s.activePageId = null;
      });
    },
 async reorderPages(projectId, orderedIds) {
 const db = getDB();
 await Promise.all(
        orderedIds.map((id, i) => db.pages.update(id, { order: i + 1 })),
      );
 set((s) => {
 const map = new Map(orderedIds.map((id, i) => [id, i + 1]));
 for (const p of s.pages) {
 if (p.projectId === projectId && map.has(p.id)) {
            p.order = map.get(p.id)!;
          }
        }
      });
    },
 setActivePage(id) {
 set((s) => {
        s.activePageId = id;
      });
    },
 
 async addTag(projectId, name, color) {
 const seed = get().tags.length;
 const t: Tag = {
        id: nanoid(6),
        projectId,
        name,
        color: color ?? pickTagColor(seed),
      };
 await getDB().tags.put(t);
 set((s) => {
        s.tags.push(t);
      });
 return t;
    },
 async deleteTag(id) {
 await getDB().tags.delete(id);
 // remove tagId from versions
 const versions = get().versions.filter((v) => v.tagIds.includes(id));
 await Promise.all(
        versions.map((v) =>
 getDB().versions.update(v.id, {
            tagIds: v.tagIds.filter((t) => t !== id),
          }),
        ),
      );
 set((s) => {
        s.tags = s.tags.filter((t) => t.id !== id);
        s.versions.forEach((v) => {
          v.tagIds = v.tagIds.filter((t) => t !== id);
        });
      });
    },
 
 async importImages(projectId, pageId, files) {
 const fresh: Version[] = [];
 const existingVersionsForPage = get().versions.filter(
        (v) => v.pageId === pageId,
      );
 const used = new Set(
        existingVersionsForPage
          .map((p) => {
 const m = p.label.match(/^v(\d+)$/);
 return m ? parseInt(m[1], 10) : 0;
          })
          .filter((n) => n > 0),
      );
 const nextLabel = () => {
 let n = 1;
 while (used.has(n)) n += 1;
        used.add(n);
 return `v${n}`;
      };
 for (const file of files) {
 if (!file.type.startsWith("image/")) continue;
 const blobId = nanoid(10);
 const thumbId = nanoid(10);
 await saveBlob(blobId, file);
 let width = 0;
 let height = 0;
 try {
 const t = await makeThumbnail(file, 640);
          width = t.width;
          height = t.height;
 await saveBlob(thumbId, t.blob);
        } catch (e) {
          console.warn("thumbnail failed", e);
        }
 const v: Version = {
          id: nanoid(10),
          pageId,
          projectId,
          label: nextLabel(),
          blobId,
          thumbBlobId: thumbId,
          width,
          height,
          rating: 0,
          verdict: "unset",
          tagIds: [],
          note: "",
          annotations: { ...EMPTY_ANNOTATIONS, strokes: [], shapes: [], notes: [] },
          createdAt: now(),
          updatedAt: now(),
        };
 await getDB().versions.put(v);
        fresh.push(v);
      }
 set((s) => {
        s.versions.push(...fresh);
      });
 return fresh;
    },
 
 async updateVersion(id, patch) {
 const t = now();
 await getDB().versions.update(id, { ...patch, updatedAt: t });
 set((s) => {
 const v = s.versions.find((x) => x.id === id);
 if (v) Object.assign(v, patch, { updatedAt: t });
      });
    },
 async setVerdict(id, verdict) {
 // If new verdict is "winner", demote any other winner on same page
 const v = get().versions.find((x) => x.id === id);
 if (!v) return;
 if (verdict === "winner") {
 const peers = get().versions.filter(
          (x) => x.pageId === v.pageId && x.verdict === "winner" && x.id !== id,
        );
 await Promise.all(
          peers.map((p) =>
 get().updateVersion(p.id, { verdict: "picked" }),
          ),
        );
      }
 await get().updateVersion(id, { verdict });
    },
 async setRating(id, rating) {
 await get().updateVersion(id, { rating });
    },
 async setNote(id, note) {
 await get().updateVersion(id, { note });
    },
 async toggleTag(id, tagId) {
 const v = get().versions.find((x) => x.id === id);
 if (!v) return;
 const has = v.tagIds.includes(tagId);
 const tagIds = has
 ? v.tagIds.filter((t) => t !== tagId)
 : [...v.tagIds, tagId];
 await get().updateVersion(id, { tagIds });
    },
 async movePage(versionId, pageId) {
 const v = get().versions.find((x) => x.id === versionId);
 if (!v) return;
 if (v.pageId === pageId) return;
 // Re-label only if it's still an auto-generated `vN` label;
 // user-customised labels (e.g. "v2 client favorite") are preserved.
 const isAuto = /^v\d+$/.test(v.label);
 const patch: Partial<Version> = { pageId };
 if (isAuto) {
 const peers = get().versions.filter(
          (x) => x.pageId === pageId && x.id !== versionId,
        );
 const used = new Set(
          peers
            .map((p) => {
 const m = p.label.match(/^v(\d+)$/);
 return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n) => n > 0),
        );
 let n = 1;
 while (used.has(n)) n += 1;
        patch.label = `v${n}`;
      }
 await get().updateVersion(versionId, patch);
    },
 async duplicateVersion(id) {
 const v = get().versions.find((x) => x.id === id);
 if (!v) return null;
 const peers = get().versions.filter((x) => x.pageId === v.pageId);
 const clone: Version = {
 ...v,
        id: nanoid(10),
        label: `${v.label} copy`,
        createdAt: now(),
        updatedAt: now(),
        annotations: {
          strokes: v.annotations.strokes.map((s) => ({ ...s })),
          shapes: v.annotations.shapes.map((s) => ({ ...s })),
          notes: v.annotations.notes.map((n) => ({ ...n })),
        },
        rating: v.rating,
        verdict: v.verdict === "winner" ? "picked" : v.verdict,
        tagIds: [...v.tagIds],
      };
 void peers; // silence unused
 await getDB().versions.put(clone);
 set((s) => {
        s.versions.push(clone);
      });
 return clone;
    },
 async deleteVersion(id) {
 const v = get().versions.find((x) => x.id === id);
 if (!v) return;
 const surviving = get().versions;
 const excludeIds = new Set([id]);
 await maybeDeleteBlob(v.blobId, surviving, excludeIds);
 await maybeDeleteBlob(v.thumbBlobId, surviving, excludeIds);
 await getDB().versions.delete(id);
 set((s) => {
        s.versions = s.versions.filter((x) => x.id !== id);
        s.selectedIds.delete(id);
 if (s.focusedVersionId === id) s.focusedVersionId = null;
      });
    },
 async setAnnotations(id, ann) {
 await get().updateVersion(id, { annotations: ann });
    },
 
 toggleSelected(id, mode = "add") {
 set((s) => {
 if (mode === "set") {
          s.selectedIds = new Set([id]);
        } else {
 if (s.selectedIds.has(id)) s.selectedIds.delete(id);
 else s.selectedIds.add(id);
        }
      });
    },
 clearSelected() {
 set((s) => {
        s.selectedIds = new Set();
        s.focusedVersionId = null;
      });
    },
 setSelected(ids) {
 set((s) => {
        s.selectedIds = new Set(ids);
      });
    },
 setFocused(id) {
 set((s) => {
        s.focusedVersionId = id;
 if (id) {
          s.selectedIds = new Set([id]);
        }
      });
    },
 toggleCompare(id) {
 set((s) => {
 if (s.compareIds.includes(id)) {
          s.compareIds = s.compareIds.filter((x) => x !== id);
        } else {
          s.compareIds = [...s.compareIds, id];
        }
      });
    },
 setCompare(ids) {
 set((s) => {
        s.compareIds = [...ids];
      });
    },
 
 setFilter(f) {
 set((s) => {
        s.filter = { ...s.filter, ...f };
      });
    },
 resetFilter() {
 set((s) => {
        s.filter = {};
      });
    },
 setSearch(q) {
 set((s) => {
        s.search = q;
      });
    },
 setCommandOpen(b) {
 set((s) => {
        s.commandOpen = b;
      });
    },
 setFilterOpen(b) {
 set((s) => {
        s.filterOpen = b;
      });
    },
 setSidebarCollapsed(b) {
 set((s) => {
        s.sidebarCollapsed = b;
      });
 if (typeof window !== "undefined") {
 try {
          window.localStorage.setItem("pf:sidebar-collapsed", b ? "1" : "0");
        } catch {}
      }
    },
 toggleSidebarCollapsed() {
 const next = !get().sidebarCollapsed;
 set((s) => {
        s.sidebarCollapsed = next;
      });
 if (typeof window !== "undefined") {
 try {
          window.localStorage.setItem(
 "pf:sidebar-collapsed",
            next ? "1" : "0",
          );
        } catch {}
      }
    },
 setExportOpen(b) {
 set((s) => {
        s.exportOpen = b;
      });
    },
 setImportOpen(b) {
 set((s) => {
        s.importOpen = b;
      });
    },
 setPendingImportFile(f) {
 set((s) => {
        s.pendingImportFile = f;
      });
    },
 setBoardScrollTop(n) {
 set((s) => {
        s.boardScrollTop = n;
      });
    },
  })),
);
