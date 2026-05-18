"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { Button } from "../primitives/Button";
import { cn } from "@/lib/utils";
import { Upload, FolderUp, FileArchive } from "lucide-react";
import { importArchive, type ImportMode, type ImportSummary } from "@/lib/portable";
import { toast } from "@/lib/ui";

type Stage = "idle" | "ready" | "running" | "done" | "error";

interface PickedSource {
  zipFile?: File;
  files?: File[];
  label: string;
}

export function ImportDialog() {
  const open = useStore((s) => s.importOpen);
  const setOpen = useStore((s) => s.setImportOpen);
  const pendingFile = useStore((s) => s.pendingImportFile);
  const setPendingFile = useStore((s) => s.setPendingImportFile);
  const loadAll = useStore((s) => s.loadAll);

  const [mode, setMode] = React.useState<ImportMode>("merge");
  const [picked, setPicked] = React.useState<PickedSource | null>(null);
  const [stage, setStage] = React.useState<Stage>("idle");
  const [progress, setProgress] = React.useState<{
    msg: string;
    frac: number;
  }>({ msg: "", frac: 0 });
  const [result, setResult] = React.useState<ImportSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const zipInputRef = React.useRef<HTMLInputElement>(null);
  const dirInputRef = React.useRef<HTMLInputElement>(null);

  // Adjust local state to props during render (instead of in effects) so we
  // don't trip Next 16's react-hooks/set-state-in-effect lint, and so the
  // freshly-opened dialog never flashes stale state for a frame.
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setStage("idle");
      setPicked(null);
      setProgress({ msg: "", frac: 0 });
      setResult(null);
      setError(null);
      setMode("merge");
    } else if (pendingFile) {
      // Pull in any file pre-staged via global drag-and-drop.
      setPicked({ zipFile: pendingFile, label: pendingFile.name });
      setStage("ready");
      setError(null);
      setPendingFile(null);
    }
  }

  const onZipPicked = (file: File) => {
    setPicked({ zipFile: file, label: file.name });
    setStage("ready");
    setError(null);
  };

  const onDirPicked = (files: File[]) => {
    if (files.length === 0) return;
    const hasManifest = files.some((f) =>
      relPathOf(f).replace(/^\.?\//, "").endsWith("data.json"),
    );
    if (!hasManifest) {
      setError("Selected folder doesn't contain data.json");
      return;
    }
    setPicked({
      files,
      label: `${files.length} files (folder import)`,
    });
    setStage("ready");
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const items = Array.from(e.dataTransfer.files);
    const zip = items.find((f) =>
      f.name.toLowerCase().endsWith(".zip"),
    );
    if (zip) {
      onZipPicked(zip);
      return;
    }
    if (items.length > 0) {
      onDirPicked(items);
    }
  };

  const handleImport = async () => {
    if (!picked) return;
    setStage("running");
    setError(null);
    try {
      const out = await importArchive({
        source: { zipFile: picked.zipFile, files: picked.files },
        mode,
        onProgress: (msg, frac) => setProgress({ msg, frac }),
      });
      setResult(out);
      setStage("done");
      await loadAll();
      toast({
        title: "Import complete",
        description: summarise(out),
        tone: "success",
      });
    } catch (e) {
      console.error(e);
      setError((e as Error).message);
      setStage("error");
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
                  "fixed left-1/2 top-[14%] -translate-x-1/2 z-50 w-[min(92vw,520px)]",
                  "bg-[var(--surface)] border border-[var(--border)]",
                  "rounded-[var(--radius-lg)] shadow-[var(--shadow-modal)] overflow-hidden",
                )}
              >
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <Dialog.Title className="text-[15px] font-semibold tracking-tight">
                    Import library
                  </Dialog.Title>
                  <Dialog.Description className="text-[12.5px] text-[var(--fg-muted)] mt-0.5">
                    Restore a Pickframe export (.zip), or pick a folder
                    containing <code>data.json</code> + <code>blobs/</code>.
                  </Dialog.Description>
                </div>

                <div className="p-4 flex flex-col gap-3">
                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                      "relative rounded-[var(--radius-md)] border border-dashed px-4 py-6 text-center transition-colors",
                      dragOver
                        ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                        : "border-[var(--border)] bg-[var(--bg-soft)]/40",
                    )}
                  >
                    <Upload
                      size={18}
                      className="mx-auto mb-2 text-[var(--fg-muted)]"
                    />
                    <div className="text-[13px] font-medium">
                      Drop a .zip here, or…
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => zipInputRef.current?.click()}
                      >
                        <FileArchive size={12} />
                        Choose .zip
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dirInputRef.current?.click()}
                      >
                        <FolderUp size={12} />
                        Choose folder
                      </Button>
                    </div>
                    {picked && (
                      <div className="mt-3 text-[11.5px] text-[var(--fg-muted)] truncate">
                        Selected: <span className="font-medium text-[var(--fg)]">{picked.label}</span>
                      </div>
                    )}
                    <input
                      ref={zipInputRef}
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onZipPicked(f);
                        e.target.value = "";
                      }}
                    />
                    <input
                      ref={dirInputRef}
                      type="file"
                      // @ts-expect-error non-standard but well supported in chromium / webkit
                      webkitdirectory=""
                      directory=""
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const list = Array.from(e.target.files ?? []);
                        if (list.length) onDirPicked(list);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {/* Mode */}
                  <div className="grid grid-cols-2 gap-2">
                    <ModeTile
                      active={mode === "merge"}
                      title="Merge"
                      desc="Add to existing library, renaming any colliding ids"
                      onClick={() => setMode("merge")}
                    />
                    <ModeTile
                      active={mode === "replace"}
                      title="Replace"
                      desc="Wipe everything first, then import"
                      onClick={() => setMode("replace")}
                    />
                  </div>

                  {error && (
                    <div className="text-[12px] text-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2 rounded-[var(--radius-sm)]">
                      {error}
                    </div>
                  )}

                  {stage === "running" && (
                    <div className="text-[11.5px] text-[var(--fg-muted)] font-mono tabular-nums flex items-center gap-2">
                      <div className="flex-1 h-[3px] rounded-full bg-[var(--bg-soft)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--brand)] transition-[width] duration-150"
                          style={{ width: `${Math.round(progress.frac * 100)}%` }}
                        />
                      </div>
                      <span className="shrink-0">{progress.msg}</span>
                    </div>
                  )}
                  {stage === "done" && result && (
                    <div className="text-[12px] text-[var(--fg)] bg-[var(--brand-soft)] px-3 py-2 rounded-[var(--radius-sm)]">
                      {summarise(result)}
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2 bg-[var(--bg)]/50">
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    {stage === "done" ? "Close" : "Cancel"}
                  </Button>
                  <Button
                    variant="brand"
                    onClick={stage === "done" ? () => setOpen(false) : handleImport}
                    disabled={!picked || stage === "running"}
                  >
                    {stage !== "done" && <Upload size={13} />}
                    {stage === "running"
                      ? "Importing…"
                      : stage === "done"
                        ? "Done"
                        : "Import"}
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

function ModeTile({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 p-3 rounded-[var(--radius-md)] border text-left transition-colors",
        active
          ? "border-[var(--brand)] bg-[var(--brand-soft)]"
          : "border-[var(--border)]",
      )}
    >
      <span className="text-[12.5px] font-semibold">{title}</span>
      <span className="text-[10.5px] text-[var(--fg-subtle)] leading-[1.4]">
        {desc}
      </span>
    </button>
  );
}

function summarise(s: ImportSummary): string {
  const bits: string[] = [];
  if (s.projects) bits.push(`${s.projects} project${plural(s.projects)}`);
  if (s.pages) bits.push(`${s.pages} page${plural(s.pages)}`);
  if (s.versions) bits.push(`${s.versions} version${plural(s.versions)}`);
  if (s.tags) bits.push(`${s.tags} tag${plural(s.tags)}`);
  if (s.blobs) bits.push(`${s.blobs} image${plural(s.blobs)}`);
  if (s.orphanVersions)
    bits.push(`${s.orphanVersions} orphan image${plural(s.orphanVersions)}`);
  return bits.length ? `Imported ${bits.join(", ")}.` : "Nothing was imported.";
}

function plural(n: number) {
  return n === 1 ? "" : "s";
}

function relPathOf(file: File): string {
  type FileLike = File & { webkitRelativePath?: string; path?: string };
  const fl = file as FileLike;
  return (fl.webkitRelativePath || fl.path || file.name).replace(/\\/g, "/");
}
