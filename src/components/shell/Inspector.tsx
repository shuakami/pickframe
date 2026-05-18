"use client";
 
import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useStore } from "@/lib/store";
import { Pill } from "../primitives/Pill";
import { Button } from "../primitives/Button";
import { Tooltip } from "../primitives/Tooltip";
import { cn, formatRelative } from "@/lib/utils";
import { VERDICT_LABEL, VERDICTS, type Verdict } from "@/lib/types";
import {
  Crown,
  Star,
  Trash2,
  Copy,
  ImageIcon,
  PencilLine,
  X,
  Check,
  ChevronDown,
} from "lucide-react";
import { Thumb } from "../primitives/Thumb";
import { uiConfirm, toast } from "@/lib/ui";
 
export function Inspector({
 embedded = false,
 versionId,
}: {
 embedded?: boolean;
 /** Override which version to inspect. Used by the floating Inspector
   *  wrapper so it can keep showing the previously focused version while
   *  the panel is animating out. */
 versionId?: string | null;
} = {}) {
 const storeFocused = useStore((s) => s.focusedVersionId);
 const focused = versionId ?? storeFocused;
 const versions = useStore((s) => s.versions);
 const tags = useStore((s) => s.tags);
 const pages = useStore((s) => s.pages);
 const setFocused = useStore((s) => s.setFocused);
 const setRating = useStore((s) => s.setRating);
 const setVerdict = useStore((s) => s.setVerdict);
 const setNote = useStore((s) => s.setNote);
 const toggleTag = useStore((s) => s.toggleTag);
 const duplicateVersion = useStore((s) => s.duplicateVersion);
 const deleteVersion = useStore((s) => s.deleteVersion);
 const setViewMode = useStore((s) => s.setViewMode);
 const updateVersion = useStore((s) => s.updateVersion);
 const movePage = useStore((s) => s.movePage);
 
 const v = focused ? versions.find((x) => x.id === focused) : undefined;
 
 if (!v) {
 if (embedded) {
 return (
        <div className="px-3 py-6 text-[12px] text-[var(--fg-subtle)] text-center">
          Select a version to edit its details.
        </div>
      );
    }
 return (
      <aside className="w-full h-full bg-[var(--bg)]" />
    );
  }
 
 const projectTags = tags.filter((t) => t.projectId === v.projectId);
 const projectPages = pages
    .filter((p) => p.projectId === v.projectId)
    .sort((a, b) => a.order - b.order);
 const currentPage = projectPages.find((p) => p.id === v.pageId);
 
 const annCount =
    v.annotations.strokes.length +
    v.annotations.shapes.length +
    v.annotations.notes.length;
 
 const Wrapper: React.ElementType = embedded ? "div" : "aside";
 return (
    <Wrapper
 className={cn(
        embedded
 ? "w-full"
 : "w-full h-full overflow-y-auto bg-[var(--bg)]",
      )}
    >
      {/* Hero thumb — only when Inspector is the floating right panel
          on the board / compare views. In single view the canvas itself
          is the preview, so duplicating it here would just steal space. */}
      {!embedded && (
        <div className="p-3 pb-0">
          <div className="relative rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)]">
            <Thumb
 blobId={v.thumbBlobId ?? v.blobId}
 fit="cover"
 className="w-full aspect-[3/4]"
 imageWidth={v.width}
 imageHeight={v.height}
 annotations={v.annotations}
            />
            <button
 onClick={() => setFocused(null)}
 className="absolute top-1.5 right-1.5 h-6 w-6 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/55 transition-colors"
 aria-label="Close inspector"
            >
              <X size={11} />
            </button>
          </div>
        </div>
      )}
 
      <div className="p-3 flex flex-col gap-3">
        {/* Title + page select */}
        <div>
          <input
 value={v.label}
 onChange={(e) => updateVersion(v.id, { label: e.target.value })}
 className="w-full bg-transparent text-[15px] font-semibold tracking-tight outline-none focus:bg-[var(--bg-soft)] rounded px-1 -mx-1 h-7"
 placeholder="Version label"
          />
          <div className="flex items-center gap-1.5 mt-0.5 text-[11.5px] text-[var(--fg-subtle)]">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
 className={cn(
 "inline-flex items-center gap-1 -mx-1 px-1 h-5 rounded-[var(--radius-xs)] outline-none",
 "hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] data-[state=open]:bg-[var(--bg-soft)] data-[state=open]:text-[var(--fg)]",
                )}
              >
                <span>{currentPage?.name ?? "Page"}</span>
                <ChevronDown size={10} className="opacity-70" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
 align="start"
 sideOffset={6}
 className={cn(
 "z-[60] min-w-[180px] p-1",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-md)] shadow-[var(--shadow-pop)]",
 "data-[state=open]:animate-cm-in data-[state=closed]:animate-cm-out",
                  )}
                >
                  {projectPages.map((p) => {
 const isCurrent = p.id === v.pageId;
 return (
                      <DropdownMenu.Item
 key={p.id}
 onSelect={() => {
 if (!isCurrent) movePage(v.id, p.id);
                        }}
 className={cn(
 "flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-[12.5px] cursor-default outline-none",
 "text-[var(--fg)] data-[highlighted]:bg-[var(--bg-soft)]",
                        )}
                      >
                        <span className="flex-1 truncate">{p.name}</span>
                        {isCurrent && <Check size={11} />}
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <span>·</span>
            <span>{formatRelative(v.updatedAt)}</span>
            {currentPage && annCount > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <PencilLine size={10} />
                  {annCount}
                </span>
              </>
            )}
          </div>
        </div>
 
        {/* Rating */}
        <Field label="Rating">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => {
 const active = v.rating >= n;
 return (
                <button
 key={n}
 onClick={() =>
 setRating(v.id, v.rating === n ? n - 1 : n)
                  }
 className={cn(
 "h-6 w-6 grid place-items-center rounded-md transition-colors",
                    active
 ? "text-[var(--winner)]"
 : "text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]",
                  )}
                >
                  <Star size={14} fill={active ? "currentColor" : "none"} />
                </button>
              );
            })}
            <span className="ml-1 text-[11px] font-mono tabular-nums text-[var(--fg-subtle)]">
              {v.rating}/5
            </span>
          </div>
        </Field>
 
        {/* Verdict */}
        <Field label="Verdict">
          <div className="flex flex-wrap gap-1.5">
            {VERDICTS.filter((x) => x !== "unset").map((verd) => {
 const active = v.verdict === verd;
 const isWinner = verd === "winner";
 return (
                <button
 key={verd}
 onClick={() =>
 setVerdict(v.id, active ? "unset" : (verd as Verdict))
                  }
 className={cn(
 "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-sm)] text-[12px] font-medium border transition-colors",
                    active
 ? isWinner
 ? "bg-[var(--winner)] text-white border-transparent"
 : "bg-[var(--fg)] text-[var(--bg)] border-transparent"
 : "bg-transparent text-[var(--fg-muted)] border-[var(--border)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]",
                  )}
                >
                  {isWinner ? (
                    <Crown size={11} />
                  ) : (
                    <span
 className="dot"
 style={{
                        background: active
 ? "currentColor"
 : "var(--fg-subtle)",
                      }}
                    />
                  )}
                  {VERDICT_LABEL[verd as Verdict]}
                </button>
              );
            })}
          </div>
        </Field>
 
        {/* Tags */}
        <Field label="Tags">
          <div className="flex flex-wrap gap-1.5 items-center">
            {v.tagIds.map((tid) => {
 const t = projectTags.find((x) => x.id === tid);
 if (!t) return null;
 return (
                <Pill
 key={tid}
 color={t.color}
 removable
 onRemove={() => toggleTag(v.id, tid)}
                >
                  {t.name}
                </Pill>
              );
            })}
            <TagAdder
 tags={projectTags.filter((t) => !v.tagIds.includes(t.id))}
 onPick={(tid) => toggleTag(v.id, tid)}
            />
          </div>
        </Field>
 
        {/* Note */}
        <Field label="Notes">
          <textarea
 value={v.note}
 onChange={(e) => setNote(v.id, e.target.value)}
 placeholder="Card layout feels right. Icons need tightening.…"
 rows={4}
 className="w-full text-[13.5px] leading-[1.55] resize-none bg-[var(--bg-soft)] outline-none border border-[var(--border)] rounded-[var(--radius-md)] p-2.5 focus:border-[var(--brand)] placeholder:text-[var(--fg-subtle)]"
          />
        </Field>
 
        {/* Actions */}
        {!embedded ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
 variant="default"
 onClick={() => {
 setViewMode("single");
              }}
 className="w-full"
            >
              <ImageIcon size={13} />
              Annotate
            </Button>
            <Button
 variant="ghost"
 onClick={() => duplicateVersion(v.id)}
 className="w-full border border-[var(--border)]"
            >
              <Copy size={13} />
              Duplicate
            </Button>
          </div>
        ) : (
          <Button
 variant="ghost"
 onClick={() => duplicateVersion(v.id)}
 className="w-full border border-[var(--border)]"
          >
            <Copy size={13} />
            Duplicate
          </Button>
        )}
        <Button
 variant="ghost"
 onClick={async () => {
 const ok = await uiConfirm({
              title: "Delete this version?",
              description: "This can’t be undone.",
              danger: true,
              confirmLabel: "Delete",
            });
 if (ok) {
 await deleteVersion(v.id);
 toast({ title: "Version deleted", tone: "success" });
            }
          }}
 className="w-full mt-1 border border-[var(--border)] text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]"
        >
          <Trash2 size={13} />
          Delete version
        </Button>
 
        <Tooltip content="Source dimensions">
          <div className="text-[10.5px] font-mono text-[var(--fg-subtle)] tabular-nums mt-3">
            {v.width} × {v.height}
          </div>
        </Tooltip>
      </div>
    </Wrapper>
  );
}
 
function Field({
 label,
 children,
}: {
 label: string;
 children: React.ReactNode;
}) {
 return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-medium text-[var(--fg-subtle)]">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}
 
function TagAdder({
 tags,
 onPick,
}: {
 tags: { id: string; name: string; color: string }[];
 onPick: (id: string) => void;
}) {
 const [open, setOpen] = React.useState(false);
 const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
 if (!open) return;
 const onDoc = (e: MouseEvent) => {
 if (ref.current && !ref.current.contains(e.target as Node))
 setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
 return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
 return (
    <div className="relative" ref={ref}>
      <button
 onClick={() => setOpen((o) => !o)}
 className="h-6 px-2 inline-flex items-center gap-1 text-[11.5px] text-[var(--fg-subtle)] hover:text-[var(--fg)] border border-dashed border-[var(--border)] rounded-[var(--radius-pill)] hover:border-[var(--brand)]"
      >
        + Add tag
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-50 w-[220px] max-h-[240px] overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-[var(--shadow-pop)] p-1 pop-in">
          {tags.length === 0 && (
            <div className="px-2 py-2 text-[11.5px] text-[var(--fg-subtle)]">
              No tags available — add some in the sidebar.
            </div>
          )}
          {tags.map((t) => (
            <button
 key={t.id}
 onClick={() => {
 onPick(t.id);
 setOpen(false);
              }}
 className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-soft)]"
            >
              <span
 className="dot"
 style={{ background: t.color }}
 aria-hidden
              />
              <span className="text-[12px]">{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
