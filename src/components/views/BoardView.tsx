"use client";
 
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { VersionCard, VERSION_DRAG_MIME } from "./VersionCard";
import { filterVersions } from "@/lib/filters";
import { Plus, Upload, X, ImageDown, Crown, Trash2, Columns2 } from "lucide-react";
import { cn, useIsMobile } from "@/lib/utils";
import type { Verdict } from "@/lib/types";
import { VERDICT_COLOR, VERDICT_LABEL } from "@/lib/types";
import { uiPrompt, uiConfirm, toast } from "@/lib/ui";
import { PageLabel } from "../primitives/PageLabel";
 
export function BoardView() {
 const activeProjectId = useStore((s) => s.activeProjectId);
 const activePageId = useStore((s) => s.activePageId);
 const pages = useStore((s) => s.pages);
 const versions = useStore((s) => s.versions);
 const filter = useStore((s) => s.filter);
 const search = useStore((s) => s.search);
 const importImages = useStore((s) => s.importImages);
 const addPage = useStore((s) => s.addPage);
 const movePage = useStore((s) => s.movePage);
 const clearSelected = useStore((s) => s.clearSelected);
 
 const projectPages = React.useMemo(
    () =>
      pages
        .filter((p) => p.projectId === activeProjectId)
        .sort((a, b) => a.order - b.order),
    [pages, activeProjectId],
  );
 
 const filteredVersionsRaw = React.useMemo(
    () => versions.filter((v) => v.projectId === activeProjectId),
    [versions, activeProjectId],
  );

 const visiblePages = React.useMemo(() => {
 const base = activePageId
 ? projectPages.filter((p) => p.id === activePageId)
 : projectPages;
 const sort = filter.pageSort ?? "manual";
 if (sort === "manual" || base.length < 2) return base;
 // Count *unfiltered* versions per page so the order reflects how much
 // work each page has, not how the active filter trims them.
 const counts = new Map<string, number>();
 for (const v of filteredVersionsRaw) {
      counts.set(v.pageId, (counts.get(v.pageId) ?? 0) + 1);
    }
 const dir = sort === "least-versions" ? 1 : -1;
 return [...base].sort((a, b) => {
 const ca = counts.get(a.id) ?? 0;
 const cb = counts.get(b.id) ?? 0;
 if (ca !== cb) return (ca - cb) * dir;
 return a.order - b.order;
    });
  }, [projectPages, activePageId, filter.pageSort, filteredVersionsRaw]);
 
 const filteredVersions = React.useMemo(
    () =>
 filterVersions(
        versions.filter((v) => v.projectId === activeProjectId),
        filter,
        search,
      ),
    [versions, activeProjectId, filter, search],
  );
 
 const versionsByPage = React.useMemo(() => {
 const verdictRank: Record<string, number> = {
      winner: 0,
      picked: 1,
      partial: 2,
      unset: 3,
      rejected: 4,
    };
 const labelNum = (label: string) => {
 const m = label.match(/v?(\d+)/i);
 return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
    };
 const m = new Map<string, typeof filteredVersions>();
 for (const v of filteredVersions) {
 const arr = m.get(v.pageId) ?? [];
      arr.push(v);
      m.set(v.pageId, arr);
    }
 for (const [, arr] of m) {
      arr.sort((a, b) => {
 const va = verdictRank[a.verdict ?? "unset"] ?? 3;
 const vb = verdictRank[b.verdict ?? "unset"] ?? 3;
 if (va !== vb) return va - vb;
 if (b.rating !== a.rating) return b.rating - a.rating;
 const ln = labelNum(a.label) - labelNum(b.label);
 if (ln !== 0) return ln;
 return a.label.localeCompare(b.label);
      });
    }
 return m;
  }, [filteredVersions]);
 
 const handlePageDrop = React.useCallback(
 async (pageId: string, files: File[]) => {
 if (!activeProjectId) return;
 const imgs = files.filter((f) => f.type.startsWith("image/"));
 if (imgs.length === 0) {
 toast({
          title: "Only images supported",
          description: "Drop PNG, JPG, or WebP files.",
          tone: "danger",
        });
 return;
      }
 await importImages(activeProjectId, pageId, imgs);
 toast({
        title: `Added ${imgs.length} version${imgs.length === 1 ? "" : "s"}`,
        tone: "success",
      });
    },
    [activeProjectId, importImages],
  );
 
 const handleAddPage = async () => {
 if (!activeProjectId) return;
 const name = await uiPrompt({
      title: "New page",
      description: "Pages group different versions of one screen.",
      placeholder: "e.g. Home, Cart, Checkout",
      confirmLabel: "Create",
    });
 if (name?.trim()) await addPage(activeProjectId, name.trim());
  };
 
 // ---------- Global file-drop overlay (only when nothing else handled it) ----------
 const [overlayPageId, setOverlayPageId] = React.useState<string | null>(null);
 const dragDepth = React.useRef(0);
 
 const onDragEnter = (e: React.DragEvent) => {
 if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
 setOverlayPageId((cur) => cur ?? null);
  };
 const onDragLeave = (e: React.DragEvent) => {
 if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepth.current -= 1;
 if (dragDepth.current <= 0) {
      dragDepth.current = 0;
 setOverlayPageId(null);
    }
  };
 const onDragOver = (e: React.DragEvent) => {
 if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
 const onBoardDrop = async (e: React.DragEvent) => {
 if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepth.current = 0;
 setOverlayPageId(null);
 const files = Array.from(e.dataTransfer.files ?? []);
 if (files.length === 0) return;

 // Pickframe archive drop — route to Import dialog instead of treating
 // .zip as an image. Single-zip drop wins; mixed payloads fall through.
 const zipFile = files.find((f) =>
      f.name.toLowerCase().endsWith(".zip"),
    );
 if (zipFile && files.length === 1) {
 const { setPendingImportFile, setImportOpen } = useStore.getState();
 setPendingImportFile(zipFile);
 setImportOpen(true);
 return;
    }
 
 // No specific page section caught this — disambiguate
 if (visiblePages.length === 0) {
 // Make a fresh page with prompted name (or Untitled)
 const name = await uiPrompt({
        title: "New page for these images",
        placeholder: "e.g. Home, Cart, Checkout",
        defaultValue: "Untitled",
        confirmLabel: "Create & upload",
      });
 if (!name || !activeProjectId) return;
 const created = await addPage(activeProjectId, name.trim() || "Untitled");
 await handlePageDrop(created.id, files);
 return;
    }
 
 if (visiblePages.length === 1) {
 await handlePageDrop(visiblePages[0].id, files);
 return;
    }
 toast({
      title: "Drop on a page section",
      description:
 "Hover over the page you want before releasing — or pick one from the sidebar.",
      tone: "danger",
    });
  };
 
 const onBoardClick = (e: React.MouseEvent) => {
 if (e.target === e.currentTarget) clearSelected();
  };
 
 // ---------- Marquee box-select ----------
 const scrollRef = React.useRef<HTMLDivElement>(null);
 const setSelected = useStore((s) => s.setSelected);
 type MarqueeState = {
 active: boolean;
 /** start point in document coords (page space) */
 startX: number;
 startY: number;
 curX: number;
 curY: number;
 /** ids selected before drag began (used for additive Shift mode) */
 base: Set<string>;
 additive: boolean;
  };
 const [marquee, setMarquee] = React.useState<MarqueeState | null>(null);
 
 function onMarqueeMouseDown(e: React.MouseEvent<HTMLDivElement>) {
 if (e.button !== 0) return;
 const target = e.target as HTMLElement;
 // Ignore drags that begin on a card / interactive element
 if (target.closest("[data-version-card]")) return;
 if (target.closest("button, a, [role=button], input, textarea")) return;
 if (!scrollRef.current) return;
 const rect = scrollRef.current.getBoundingClientRect();
 const x = e.clientX - rect.left + scrollRef.current.scrollTop * 0; // viewport coords
 const y = e.clientY - rect.top;
 const additive = e.shiftKey || e.metaKey || e.ctrlKey;
 setMarquee({
      active: true,
      startX: e.clientX - rect.left,
      startY: y + scrollRef.current.scrollTop,
      curX: e.clientX - rect.left,
      curY: y + scrollRef.current.scrollTop,
      base: additive
 ? new Set(useStore.getState().selectedIds)
 : new Set(),
      additive,
    });
 if (!additive) clearSelected();
 // Suppress text selection while dragging
 void x;
    e.preventDefault();
  }
 
  React.useEffect(() => {
 if (!marquee?.active) return;
 function onMove(ev: MouseEvent) {
 if (!scrollRef.current) return;
 const rect = scrollRef.current.getBoundingClientRect();
 const x = ev.clientX - rect.left;
 const y = ev.clientY - rect.top + scrollRef.current.scrollTop;
 setMarquee((m) => (m ? { ...m, curX: x, curY: y } : m));
 
 // Compute selected cards by intersection (in viewport coords)
 const left = Math.min(marquee!.startX, x);
 const top =
        Math.min(marquee!.startY, y) - scrollRef.current.scrollTop;
 const right = Math.max(marquee!.startX, x);
 const bottom =
        Math.max(marquee!.startY, y) - scrollRef.current.scrollTop;
 const cards = scrollRef.current.querySelectorAll<HTMLElement>(
 "[data-version-card]",
      );
 const hits = new Set<string>(marquee!.base);
      cards.forEach((el) => {
 const r = el.getBoundingClientRect();
 const cl = r.left - rect.left;
 const ct = r.top - rect.top;
 const cr = r.right - rect.left;
 const cb = r.bottom - rect.top;
 const intersects =
          cl < right && cr > left && ct < bottom && cb > top;
 if (intersects) {
 const id = el.getAttribute("data-version-card");
 if (id) hits.add(id);
        }
      });
 setSelected(Array.from(hits));
    }
 function onUp() {
 setMarquee(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
 return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [marquee?.active, marquee, setSelected]);
 
 // ---------- Restore scroll position on Board return ----------
 // BoardView is unmounted/remounted when entering/leaving single view.
 // On remount we (1) immediately jump to the saved scrollTop and (2) once
 // images settle, snap the previously focused card into view. The id-based
 // scroll is robust against page-height changes from lazy thumbnail loads.
 const setBoardScrollTop = useStore((s) => s.setBoardScrollTop);
  React.useEffect(() => {
 const el = scrollRef.current;
 if (!el) return;
 const saved = useStore.getState().boardScrollTop;
 const focusedId = useStore.getState().focusedVersionId;
 
 // Suppress scroll-tracking briefly while we restore — otherwise our
 // own programmatic scroll would clobber the stored value.
 let restoring = true;
 if (saved > 0) el.scrollTop = saved;
 
 const timers: number[] = [];
 if (focusedId) {
 // Try a few times — first immediately, then after layout passes —
 // because thumbnails decode asynchronously and reflow heights.
      [0, 100, 300, 700].forEach((delay) => {
        timers.push(
          window.setTimeout(() => {
 const card = el.querySelector<HTMLElement>(
 `[data-version-card="${focusedId}"]`,
            );
 if (card) {
              card.scrollIntoView({ block: "center", behavior: "auto" });
            }
          }, delay),
        );
      });
    }
 // Stop suppressing after the last restore attempt.
    timers.push(
      window.setTimeout(() => {
        restoring = false;
      }, 800),
    );
 
 let scrollRaf = 0;
 const onScroll = () => {
 if (restoring) return;
 cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(() => {
 setBoardScrollTop(el.scrollTop);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
 return () => {
      el.removeEventListener("scroll", onScroll);
      timers.forEach((t) => clearTimeout(t));
 cancelAnimationFrame(scrollRaf);
    };
  }, [setBoardScrollTop]);
 
 // Marquee rectangle (in container coords)
 const marqueeRect = marquee
 ? (() => {
 const left = Math.min(marquee.startX, marquee.curX);
 const top = Math.min(marquee.startY, marquee.curY);
 const width = Math.abs(marquee.curX - marquee.startX);
 const height = Math.abs(marquee.curY - marquee.startY);
 return { left, top, width, height };
      })()
 : null;
 
 return (
    <div
 ref={scrollRef}
 className="absolute inset-0 overflow-y-auto"
 onClick={onBoardClick}
 onMouseDown={onMarqueeMouseDown}
 onDragEnter={onDragEnter}
 onDragOver={onDragOver}
 onDragLeave={onDragLeave}
 onDrop={onBoardDrop}
    >
      {marqueeRect && marqueeRect.width > 2 && marqueeRect.height > 2 && (
        <div
 className="absolute pointer-events-none rounded-[var(--radius-xs)]"
 style={{
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width,
            height: marqueeRect.height,
            zIndex: 10,
            border:
 "1px solid color-mix(in srgb, var(--brand) 45%, transparent)",
            background:
 "color-mix(in srgb, var(--brand) 5%, transparent)",
          }}
 aria-hidden
        />
      )}
      <div className="px-3 sm:px-6 lg:px-8 pt-5 pb-32" onClick={onBoardClick}>
        {visiblePages.length === 0 && (
          <div
 className={cn(
 "mt-6 mx-auto max-w-[520px] py-12 px-8 text-center",
 "rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--bg-soft)]",
            )}
 onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 grid place-items-center h-9 w-9 rounded-full bg-[var(--surface)] border border-[var(--border)]">
              <ImageDown size={16} className="text-[var(--fg-muted)]" />
            </div>
            <h3 className="text-[15px] font-semibold tracking-tight">
              Drop images here, or create a page
            </h3>
            <p className="mt-1.5 text-[12.5px] text-[var(--fg-muted)] leading-[1.55]">
              Pages group versions of the same screen (Home, Cart, Checkout…).
              Drop multiple PNGs / JPGs anywhere on the board to upload at once.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
 onClick={handleAddPage}
 className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)] bg-[var(--brand)] text-[var(--brand-fg)] text-[12.5px] font-medium hover:opacity-90"
              >
                <Plus size={12} />
                New page
              </button>
              <button
 onClick={async () => {
 const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.accept = "image/*";
                  input.onchange = async () => {
 const files = Array.from(input.files ?? []);
 if (!files.length || !activeProjectId) return;
 const created = await addPage(
                      activeProjectId,
 "Untitled",
                    );
 await handlePageDrop(created.id, files);
                  };
                  input.click();
                }}
 className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[12.5px] text-[var(--fg)] hover:bg-[var(--bg-soft)]"
              >
                <Upload size={12} />
                Upload images
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-12" onClick={onBoardClick}>
          {visiblePages.map((page) => {
 const list = versionsByPage.get(page.id) ?? [];
 return (
              <PageSection
 key={page.id}
 page={page}
 list={list}
 onDropFiles={(files) => handlePageDrop(page.id, files)}
 onDropVersions={async (ids) => {
 for (const id of ids) await movePage(id, page.id);
 toast({
                    title: `Moved to ${page.name}`,
                    tone: "success",
                  });
                }}
 onUploadClick={async () => {
 const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.accept = "image/*";
                  input.onchange = async () => {
 const files = Array.from(input.files ?? []);
 if (files.length) await handlePageDrop(page.id, files);
                  };
                  input.click();
                }}
 isHotPage={overlayPageId === page.id}
 setHotPage={(hot) =>
 setOverlayPageId(hot ? page.id : null)
                }
              />
            );
          })}
          {!activePageId && visiblePages.length > 0 && (
            <button
 onClick={handleAddPage}
 className={cn(
 "self-start flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)]",
 "border border-dashed border-[var(--border)]",
 "text-[12px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--brand)]",
 "transition-colors",
              )}
            >
              <Plus size={12} />
              New page
            </button>
          )}
        </div>
      </div>
 
      <FloatingSelectionBar />
    </div>
  );
}
 
function PageSection({
 page,
 list,
 onDropFiles,
 onDropVersions,
 onUploadClick,
 isHotPage,
 setHotPage,
}: {
 page: { id: string; name: string };
 list: import("@/lib/types").Version[];
 onDropFiles: (files: File[]) => Promise<void> | void;
 onDropVersions: (ids: string[]) => Promise<void> | void;
 onUploadClick: () => void;
 isHotPage: boolean;
 setHotPage: (hot: boolean) => void;
}) {
 const [hot, setHot] = React.useState<null | "files" | "versions">(null);
 const setCompare = useStore((s) => s.setCompare);
 const setViewMode = useStore((s) => s.setViewMode);
 
 const onDragEnter = (e: React.DragEvent) => {
 const types = e.dataTransfer.types;
 if (types.includes(VERSION_DRAG_MIME)) {
      e.preventDefault();
      e.stopPropagation();
 setHot("versions");
    } else if (types.includes("Files")) {
      e.preventDefault();
 setHot("files");
 setHotPage(true);
    }
  };
 const onDragOver = (e: React.DragEvent) => {
 const types = e.dataTransfer.types;
 if (types.includes(VERSION_DRAG_MIME)) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
    } else if (types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };
 const onDragLeave = (e: React.DragEvent) => {
 // only react if leaving this section entirely
 if (e.currentTarget.contains(e.relatedTarget as Node)) return;
 setHot(null);
 setHotPage(false);
  };
 const onDrop = async (e: React.DragEvent) => {
 const versionsRaw = e.dataTransfer.getData(VERSION_DRAG_MIME);
 if (versionsRaw) {
      e.preventDefault();
      e.stopPropagation();
 try {
 const ids = JSON.parse(versionsRaw) as string[];
 if (Array.isArray(ids) && ids.length) await onDropVersions(ids);
      } catch {}
 setHot(null);
 setHotPage(false);
 return;
    }
 if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
 const files = Array.from(e.dataTransfer.files);
 await onDropFiles(files);
    }
 setHot(null);
 setHotPage(false);
  };
 
 return (
    <section
 onDragEnter={onDragEnter}
 onDragOver={onDragOver}
 onDragLeave={onDragLeave}
 onDrop={onDrop}
 className={cn(
 "relative rounded-[var(--radius-lg)] transition-colors",
        hot === "versions" &&
 "outline-2 outline outline-[var(--brand)] outline-offset-4",
        (hot === "files" || isHotPage) &&
 "outline-2 outline outline-dashed outline-[var(--brand)] outline-offset-4 bg-[color-mix(in_srgb,var(--brand)_4%,transparent)]",
      )}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="text-[15.5px] font-semibold tracking-tight truncate">
            <PageLabel name={page.name} />
          </h2>
          <span className="text-[11.5px] text-[var(--fg-subtle)] tabular-nums">
            {list.length} {list.length === 1 ? "version" : "versions"}
          </span>
 
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {list.length >= 2 && (
            <button
 onClick={() => {
                setCompare(list.map((v) => v.id));
                setViewMode("compare");
              }}
 className="inline-flex items-center gap-1.5 h-7 px-2 rounded-[var(--radius-sm)] text-[11.5px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
            >
              <Columns2 size={11} />
              Compare all
            </button>
          )}
          <button
 onClick={onUploadClick}
 className="inline-flex items-center gap-1.5 h-7 px-2 rounded-[var(--radius-sm)] text-[11.5px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
          >
            <Upload size={11} />
            Upload
          </button>
        </div>
      </div>
 
      <div className="flex flex-wrap gap-3 items-stretch min-h-[64px]">
        {list.map((v) => (
          <VersionCard key={v.id} version={v} />
        ))}
        {list.length === 0 && (
          <button
 onClick={onUploadClick}
 className={cn(
 "h-[160px] w-[180px] grid place-items-center text-center px-3",
 "rounded-[var(--radius-md)] border border-dashed border-[var(--border)]",
 "text-[11.5px] text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] hover:border-[var(--brand)] hover:bg-[var(--bg-soft)]/50 transition-colors",
            )}
          >
            <span className="flex flex-col items-center gap-1.5">
              <Upload size={14} className="opacity-70" />
              <span>Drop or click to upload</span>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
 
function FloatingSelectionBar() {
  const selectedIds = useStore((s) => s.selectedIds);
  const clearSelected = useStore((s) => s.clearSelected);
  const setExportOpen = useStore((s) => s.setExportOpen);
  const setViewMode = useStore((s) => s.setViewMode);
  const setCompare = useStore((s) => s.setCompare);
  const setVerdict = useStore((s) => s.setVerdict);
  const deleteVersion = useStore((s) => s.deleteVersion);
  const isMobile = useIsMobile();

  const ids = React.useMemo(() => Array.from(selectedIds), [selectedIds]);
  const visible = selectedIds.size > 0;

  const applyVerdict = (v: Verdict) => {
    for (const id of ids) setVerdict(id, v);
  };

  const onDelete = async () => {
    const ok = await uiConfirm({
      title: `Delete ${ids.length} version${ids.length === 1 ? "" : "s"}?`,
      description: "This can't be undone.",
      danger: true,
      confirmLabel: "Delete",
    });
    if (ok) {
      for (const id of ids) await deleteVersion(id);
      clearSelected();
      toast({ title: "Deleted", tone: "success" });
    }
  };

  // Wide pill (desktop / lg+): label + 4 named verdict pills + Compare +
  // Export + Delete + clear, all on one line.
  const verdictBtn = (v: Verdict) => (
    <button
      key={v}
      onClick={() => applyVerdict(v)}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--radius-pill)] text-[12px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
    >
      <span className="dot" style={{ background: VERDICT_COLOR[v] }} />
      {VERDICT_LABEL[v]}
    </button>
  );

  // Compact icon-only verdict tap target for mobile. Reads as a colored dot
  // (or crown for winner) with an aria-label so screen readers still get
  // the verdict name. 36×36 hit zone.
  const verdictDot = (v: Verdict) => (
    <button
      key={v}
      onClick={() => applyVerdict(v)}
      aria-label={`Set ${VERDICT_LABEL[v]}`}
      className="grid place-items-center h-9 w-9 shrink-0 rounded-full hover:bg-[var(--bg-soft)] focus-ring"
    >
      {v === "winner" ? (
        <Crown size={14} className="text-[var(--winner)]" />
      ) : (
        <span
          className="block h-3 w-3 rounded-full"
          style={{ background: VERDICT_COLOR[v] }}
        />
      )}
    </button>
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.96 }}
          transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
          className={cn(
            "fixed z-40 pointer-events-none",
            // Phone: stretch to full width with safe padding so the bar
            // never overflows a 320–360px viewport, anchored above any
            // home indicator. Desktop: centered floating pill.
            isMobile
              ? "left-2 right-2 bottom-3"
              : "left-1/2 -translate-x-1/2 bottom-5",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {isMobile ? (
            <div
              className={cn(
                "pointer-events-auto flex items-center gap-1 pl-3 pr-1 py-1.5",
                "bg-[var(--surface)] border border-[var(--border)]",
                "rounded-[var(--radius-pill)] shadow-[var(--shadow-pop)]",
              )}
            >
              <span className="text-[12px] text-[var(--fg-muted)] tabular-nums pr-1 shrink-0">
                <span className="text-[var(--fg)] font-semibold">
                  {ids.length}
                </span>
              </span>
              <span className="w-px h-5 bg-[var(--border)] shrink-0" />
              {/* Verdict dots in a horizontally scrollable strip so the bar
                  cannot overflow at 320 px even with all four verdicts +
                  the export/delete/clear actions. */}
              <div
                className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto"
                style={{ scrollbarWidth: "none" }}
              >
                {verdictDot("winner")}
                {verdictDot("picked")}
                {verdictDot("partial")}
                {verdictDot("rejected")}
              </div>
              <span className="w-px h-5 bg-[var(--border)] shrink-0" />
              {ids.length >= 2 && (
                <button
                  onClick={() => {
                    setCompare(ids);
                    setViewMode("compare");
                  }}
                  className="grid place-items-center h-9 w-9 shrink-0 rounded-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
                  aria-label="Compare selected"
                >
                  <Columns2 size={15} />
                </button>
              )}
              <button
                onClick={() => setExportOpen(true)}
                className="grid place-items-center h-9 w-9 shrink-0 rounded-full text-[var(--brand)] hover:bg-[var(--bg-soft)]"
                aria-label="Export selected"
              >
                <ImageDown size={15} />
              </button>
              <button
                onClick={onDelete}
                className="grid place-items-center h-9 w-9 shrink-0 rounded-full text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
                aria-label="Delete selected"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={clearSelected}
                className="grid place-items-center h-9 w-9 shrink-0 rounded-full text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
                aria-label="Clear selection"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <div
              className={cn(
                "pointer-events-auto",
                "flex items-center gap-1 pl-3 pr-1.5 py-1.5",
                "bg-[var(--surface)] border border-[var(--border)]",
                "rounded-[var(--radius-pill)] shadow-[var(--shadow-pop)]",
              )}
            >
              <span className="text-[12px] text-[var(--fg-muted)] tabular-nums pr-1">
                <span className="text-[var(--fg)] font-semibold">
                  {ids.length}
                </span>{" "}
                selected
              </span>
              <span className="w-px h-4 bg-[var(--border)] mx-1" />
              {verdictBtn("winner")}
              {verdictBtn("picked")}
              {verdictBtn("partial")}
              {verdictBtn("rejected")}
              <span className="w-px h-4 bg-[var(--border)] mx-1" />
              {ids.length >= 2 && (
                <button
                  onClick={() => {
                    setCompare(ids);
                    setViewMode("compare");
                  }}
                  className="inline-flex items-center h-8 px-3 rounded-[var(--radius-pill)] text-[12px] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
                >
                  Compare
                </button>
              )}
              <button
                onClick={() => setExportOpen(true)}
                className="inline-flex items-center h-8 px-3 rounded-[var(--radius-pill)] text-[12px] font-medium bg-[var(--brand)] text-[var(--brand-fg)] hover:opacity-90"
              >
                Export
              </button>
              <button
                onClick={onDelete}
                className="inline-flex items-center h-8 px-3 rounded-[var(--radius-pill)] text-[12px] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
              >
                Delete
              </button>
              <span className="w-px h-4 bg-[var(--border)] mx-1" />
              <button
                onClick={clearSelected}
                className="h-8 w-8 grid place-items-center rounded-[var(--radius-pill)] text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
                aria-label="Clear selection"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
