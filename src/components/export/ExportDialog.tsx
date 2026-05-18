"use client";
 
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
// JSZip / jsPDF / file-saver together weigh well over half a megabyte
// minified — but they're only touched once the user actually clicks
// "Export". Import them dynamically inside the handlers so they never
// hit the main app chunk.
import type JSZipType from "jszip";
import type jsPDFType from "jspdf";
import { useStore } from "@/lib/store";
import { Button } from "../primitives/Button";
import { cn } from "@/lib/utils";
import { getDB } from "@/lib/db";
import { renderAnnotated } from "./renderAnnotated";
import { Download, FileImage, FilePlus2, FileText } from "lucide-react";
import type { Page, Project, Version } from "@/lib/types";
 
type ExportKind = "zip" | "pdf" | "single";
 
export function ExportDialog() {
 const open = useStore((s) => s.exportOpen);
 const setOpen = useStore((s) => s.setExportOpen);
 const selectedIds = useStore((s) => s.selectedIds);
 const versions = useStore((s) => s.versions);
 const pages = useStore((s) => s.pages);
 const projects = useStore((s) => s.projects);
 const activeProjectId = useStore((s) => s.activeProjectId);
 const focused = useStore((s) => s.focusedVersionId);
 
 const [kind, setKind] = React.useState<ExportKind>("zip");
 const [withAnnotations, setWithAnnotations] = React.useState(true);
 const [busy, setBusy] = React.useState(false);
 const [progress, setProgress] = React.useState<string>("");
 // Numeric 0..1 for the progress bar; null = indeterminate.
 const [progressPct, setProgressPct] = React.useState<number | null>(null);
 
 // What to export?
 // Priority: explicit selection -> winners of project -> focused -> all
 const exportable = React.useMemo<Version[]>(() => {
 if (selectedIds.size > 0) {
 return Array.from(selectedIds)
        .map((id) => versions.find((v) => v.id === id))
        .filter(Boolean) as Version[];
    }
 if (focused) {
 const v = versions.find((x) => x.id === focused);
 return v ? [v] : [];
    }
 if (activeProjectId) {
 return versions.filter((v) => v.projectId === activeProjectId);
    }
 return [];
  }, [selectedIds, versions, focused, activeProjectId]);
 
 const project = projects.find((p) => p.id === activeProjectId);
 
 const handleExport = async () => {
 if (exportable.length === 0) return;
 setBusy(true);
 setProgress("Starting…");
 setProgressPct(0);
 try {
 if (kind === "single") {
 const v = exportable[0];
 const blob = await fetchBlob(v.blobId);
 if (!blob) throw new Error("Image not found");
 const out = await renderIfNeeded(blob, v, withAnnotations);
 const filename = `${pageNameFor(pages, v)}-${v.label}.png`;
 const { saveAs } = await import("file-saver");
 saveAs(out, filename);
 setProgressPct(1);
      } else if (kind === "zip") {
 const { default: JSZip } = await import("jszip");
 const zip: JSZipType = new JSZip();
 const total = exportable.length;
 let done = 0;
 const tick = () => {
          done++;
 // Reserve last 5% for the final zipping/compression step.
 setProgress(`Packing ${done}/${total}`);
 setProgressPct((done / total) * 0.95);
        };
 // Concurrent worker pool. fetchBlob is IO-bound (IndexedDB) and
 // renderAnnotated is CPU-bound on a 2D canvas — running them
 // sequentially is what made 200-image exports take minutes.
 // 6 in-flight is a sane upper bound for browser memory + decode.
 const CONCURRENCY = 6;
 const queue = exportable.slice();
 const work = async () => {
 while (queue.length) {
 const v = queue.shift()!;
 const blob = await fetchBlob(v.blobId);
 if (!blob) {
              tick();
 continue;
            }
 const out = await renderIfNeeded(blob, v, withAnnotations);
 const folder = zip.folder(safe(pageNameFor(pages, v))) ?? zip;
            folder.file(`${safe(v.label)}.png`, out);
 if (v.note) folder.file(`${safe(v.label)}.note.txt`, v.note);
            tick();
          }
        };
 await Promise.all(
 Array.from({ length: Math.min(CONCURRENCY, total) }, () => work()),
        );
 // PNGs are already DEFLATE-compressed internally; re-compressing
 // saves ~0% but doubles the time. Use STORE.
 const zipped = await zip.generateAsync(
          { type: "blob", compression: "STORE" },
          (m) => {
 setProgress(`Compressing ${m.percent.toFixed(0)}%`);
 setProgressPct(0.95 + (m.percent / 100) * 0.05);
          },
        );
 const { saveAs } = await import("file-saver");
 saveAs(zipped, `${safe(project?.name ?? "pickframe")}.zip`);
      } else if (kind === "pdf") {
 await exportPdf(
          exportable,
          pages,
          project,
          withAnnotations,
          (m, pct) => {
 setProgress(m);
 if (typeof pct === "number") setProgressPct(pct);
          },
        );
      }
 setProgress("Done");
 setProgressPct(1);
 setTimeout(() => {
 setBusy(false);
 setOpen(false);
 setProgressPct(null);
      }, 600);
    } catch (e) {
      console.error(e);
 setProgress("Error: " + (e as Error).message);
 setBusy(false);
 setProgressPct(null);
    }
  };
 
 const ease = [0.2, 0.7, 0.2, 1] as const;
 return (
    <AnimatePresence>
      {open && (
        <Dialog.Root open onOpenChange={setOpen} modal>
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.14, ease }}
 className="fixed inset-0 z-50 backdrop-blur-sm"
 style={{ background: "var(--scrim)" }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
 initial={{ opacity: 0, y: 6, scale: 0.985 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 4, scale: 0.985 }}
 transition={{ duration: 0.16, ease }}
 className={cn(
 "fixed left-1/2 top-[16%] -translate-x-1/2 z-50 w-[min(92vw,520px)]",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-lg)] shadow-[var(--shadow-modal)] overflow-hidden",
                )}
              >
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <Dialog.Title className="text-[15px] font-semibold tracking-tight">
              Export
            </Dialog.Title>
            <Dialog.Description className="text-[12.5px] text-[var(--fg-muted)] mt-0.5">
              {exportable.length} version{exportable.length === 1 ? "" : "s"} will be exported
              {selectedIds.size > 0 && " (from current selection)"}
            </Dialog.Description>
          </div>
          <div className="p-4 flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              <Tile
 active={kind === "zip"}
 onClick={() => setKind("zip")}
 icon={<FilePlus2 size={16} />}
 title="ZIP archive"
 desc="PNGs grouped by page"
              />
              <Tile
 active={kind === "pdf"}
 onClick={() => setKind("pdf")}
 icon={<FileText size={16} />}
 title="PDF contact sheet"
 desc="One page per design page"
              />
              <Tile
 active={kind === "single"}
 onClick={() => setKind("single")}
 icon={<FileImage size={16} />}
 title="Single PNG"
 desc="Just the first one"
 disabled={exportable.length === 0}
              />
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-[var(--fg-muted)] cursor-pointer">
              <input
 type="checkbox"
 checked={withAnnotations}
 onChange={(e) => setWithAnnotations(e.target.checked)}
              />
              Burn in annotations (strokes / arrows / notes)
            </label>
            {busy && (
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex items-center justify-between text-[11.5px] text-[var(--fg-muted)] font-mono tabular-nums">
                  <span className="truncate">{progress || "Working…"}</span>
                  <span>
                    {progressPct == null
                      ? "…"
                      : `${Math.round(progressPct * 100)}%`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-soft)] overflow-hidden">
                  <div
                    className={cn(
                      "h-full bg-[var(--brand)] transition-[width] duration-200 ease-out",
                      progressPct == null && "animate-pulse",
                    )}
                    style={{
                      width:
                        progressPct == null
                          ? "30%"
                          : `${Math.min(100, Math.max(0, progressPct * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2 bg-[var(--bg)]/50">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
 variant="brand"
 onClick={handleExport}
 disabled={busy || exportable.length === 0}
            >
              <Download size={13} />
              Export {exportable.length}
            </Button>
          </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
 
function Tile({
 active,
 icon,
 title,
 desc,
 onClick,
 disabled,
}: {
 active: boolean;
 icon: React.ReactNode;
 title: string;
 desc: string;
 onClick: () => void;
 disabled?: boolean;
}) {
 return (
    <button
 onClick={onClick}
 disabled={disabled}
 className={cn(
 "flex flex-col items-start gap-1 p-3 rounded-[var(--radius-md)] border text-left transition-colors",
        active
 ? "border-[var(--brand)] bg-[var(--brand-soft)]"
 : "border-[var(--border)] hover:border-[var(--border)]",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <span
 className={cn(
 "h-7 w-7 grid place-items-center rounded-md",
          active ? "text-[var(--brand)]" : "text-[var(--fg-muted)]",
        )}
      >
        {icon}
      </span>
      <span className="text-[12.5px] font-semibold">{title}</span>
      <span className="text-[10.5px] text-[var(--fg-subtle)] leading-[1.4]">
        {desc}
      </span>
    </button>
  );
}
 
async function fetchBlob(id: string): Promise<Blob | null> {
 const row = await getDB().blobs.get(id);
 return row?.data ?? null;
}

function hasAnnotations(v: Version): boolean {
 const a = v.annotations;
 return (
    (a?.strokes?.length ?? 0) > 0 ||
    (a?.shapes?.length ?? 0) > 0 ||
    (a?.notes?.length ?? 0) > 0
  );
}

// Skip the canvas rebake when there's nothing to draw — same bytes go straight
// from IndexedDB to the zip. This is the single biggest export-speed win.
async function renderIfNeeded(
 blob: Blob,
 v: Version,
 withAnnotations: boolean,
): Promise<Blob> {
 if (!withAnnotations) return blob;
 if (!hasAnnotations(v)) return blob;
 return renderAnnotated(blob, v);
}
 
function pageNameFor(pages: Page[], v: Version): string {
 const p = pages.find((x) => x.id === v.pageId);
 return p?.name ?? "Untitled";
}
 
function safe(s: string) {
 return s.replace(/[\\/:*?"<>|]+/g, "-").trim();
}
 
async function exportPdf(
 versions: Version[],
 pages: Page[],
 project: Project | undefined,
 withAnn: boolean,
 onProgress: (m: string, pct?: number) => void,
) {
 const { default: jsPDF } = await import("jspdf");
 const pdf: jsPDFType = new jsPDF({
    unit: "px",
    format: "a4",
    orientation: "portrait",
    hotfixes: ["px_scaling"],
  });
 const W = pdf.internal.pageSize.getWidth();
 const H = pdf.internal.pageSize.getHeight();
 const margin = 32;
 const headH = 56;
 
 // Group by page
 const groups = new Map<string, Version[]>();
 for (const v of versions) {
 const arr = groups.get(v.pageId) ?? [];
    arr.push(v);
    groups.set(v.pageId, arr);
  }
 
 let pageIdx = 0;
 const totalGroups = groups.size;
 for (const [pid, list] of groups) {
 if (pageIdx > 0) pdf.addPage();
    pageIdx++;
 const page = pages.find((p) => p.id === pid);
 onProgress(
 `PDF ${page?.name ?? ""} (${pageIdx}/${totalGroups})`,
      pageIdx / totalGroups,
    );
 
 // Header
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(page?.name ?? "Page", margin, margin + 14);
    pdf.setFontSize(10);
    pdf.setTextColor(120);
    pdf.text(
 `${project?.name ?? ""} · ${list.length} versions`,
      margin,
      margin + 32,
    );
    pdf.setTextColor(0);

 // Layout: winner big on left, others stacked on right
 const winner = list.find((v) => v.verdict === "winner") ?? list[0];
 const others = list.filter((v) => v.id !== winner.id);
 
 const contentY = margin + headH;
 const contentH = H - contentY - margin;
 const leftW = (W - margin * 2) * 0.62;
 const rightX = margin + leftW + 12;
 const rightW = W - rightX - margin;
 
 const winnerBlob = await fetchBlob(winner.blobId);
 if (winnerBlob) {
 const out = await renderIfNeeded(winnerBlob, winner, withAnn);
 const dataUrl = await blobToDataUrl(out);
 const imgInfo = await loadImg(dataUrl);
 const ratio = imgInfo.w / imgInfo.h;
 let dw = leftW;
 let dh = leftW / ratio;
 if (dh > contentH) {
        dh = contentH;
        dw = dh * ratio;
      }
      pdf.addImage(
        dataUrl,
 "PNG",
        margin + (leftW - dw) / 2,
        contentY,
        dw,
        dh,
 undefined,
 "FAST",
      );
      pdf.setFontSize(10);
      pdf.setTextColor(120);
      pdf.text(`${winner.label} · final`, margin, contentY + dh + 14);
      pdf.setTextColor(0);
 if (winner.note) {
        pdf.setFontSize(9);
 const lines = pdf.splitTextToSize(winner.note, leftW);
        pdf.text(lines, margin, contentY + dh + 28);
      }
    }
 
 let yy = contentY;
 const cellH = Math.min(160, contentH / Math.max(1, others.length));
 for (const v of others) {
 const blob = await fetchBlob(v.blobId);
 if (!blob) continue;
 const out = await renderIfNeeded(blob, v, withAnn);
 const dataUrl = await blobToDataUrl(out);
 const imgInfo = await loadImg(dataUrl);
 const ratio = imgInfo.w / imgInfo.h;
 let dw = rightW;
 let dh = rightW / ratio;
 if (dh > cellH) {
        dh = cellH;
        dw = dh * ratio;
      }
      pdf.addImage(
        dataUrl,
 "PNG",
        rightX + (rightW - dw) / 2,
        yy,
        dw,
        dh,
 undefined,
 "FAST",
      );
      pdf.setFontSize(8);
      pdf.setTextColor(140);
      pdf.text(`${v.label}`, rightX, yy + dh + 10);
      pdf.setTextColor(0);
      yy += cellH + 8;
 if (yy > contentY + contentH - 20) break;
    }
  }
 
  pdf.save(`${safe(project?.name ?? "pickframe")}-contact-sheet.pdf`);
}
 
function blobToDataUrl(blob: Blob): Promise<string> {
 return new Promise((res, rej) => {
 const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
 
function loadImg(src: string): Promise<{ w: number; h: number }> {
 return new Promise((res, rej) => {
 const i = new Image();
    i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = rej;
    i.src = src;
  });
}
