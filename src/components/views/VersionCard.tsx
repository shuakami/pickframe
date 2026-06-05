"use client";
 
import * as React from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useStore } from "@/lib/store";
import { Thumb } from "../primitives/Thumb";
import { cn, useIsMobile } from "@/lib/utils";
import {
  VERDICT_COLOR,
  VERDICT_LABEL,
  VERDICTS,
 type Verdict,
 type Version,
} from "@/lib/types";
import {
  Star,
  PencilLine,
  Check,
  Crown,
  Copy,
  Trash2,
  ImageIcon,
  ArrowRightLeft,
  CircleDashed,
  ChevronRight,
  PenLine,
  ClipboardCopy,
  Download,
  MoreHorizontal,
} from "lucide-react";
import { uiPrompt, uiConfirm, toast } from "@/lib/ui";
import { copyImageToClipboard, saveImageToDisk } from "@/lib/imageActions";
 
const DRAG_MIME = "application/x-pickframe-version";
 
function VersionCardImpl({ version }: { version: Version }) {
 // Subscribe only to *this* card's selected/focused booleans — never the
 // whole selection Set. Otherwise selecting one card would re-render every
 // card on the board. The multi-drag payload reads the live set lazily from
 // `getState()` inside the drag handler, so no broad subscription is needed.
 const selected = useStore((s) => s.selectedIds.has(version.id));
 const focused = useStore((s) => s.focusedVersionId === version.id);
 const toggleSelected = useStore((s) => s.toggleSelected);
 const setSelected = useStore((s) => s.setSelected);
 const setFocused = useStore((s) => s.setFocused);
 const setViewMode = useStore((s) => s.setViewMode);
 const setVerdict = useStore((s) => s.setVerdict);
 const updateVersion = useStore((s) => s.updateVersion);
 const movePage = useStore((s) => s.movePage);
 const duplicateVersion = useStore((s) => s.duplicateVersion);
 const deleteVersion = useStore((s) => s.deleteVersion);
 const pages = useStore((s) => s.pages);
 
 const projectPages = React.useMemo(
    () =>
      pages
        .filter((p) => p.projectId === version.projectId)
        .sort((a, b) => a.order - b.order),
    [pages, version.projectId],
  );

 const isMobile = useIsMobile();

 const ann =
    version.annotations.strokes.length +
    version.annotations.shapes.length +
    version.annotations.notes.length;
 
 const aspect =
    version.width > 0 && version.height > 0
 ? version.width / version.height
 : 0.56;
 
 const handleClick = (e: React.MouseEvent) => {
 if (e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
 toggleSelected(version.id);
 return;
    }
 // Mobile / touch: a tap should *navigate* (open the version in Single
 // view), not silently spawn an Inspector bottom-sheet AND a floating
 // selection toolbar at the same time. That double-popup is what the
 // user has been calling "乱七八糟". Selection on mobile happens via the
 // explicit dot-toggle button, which is always visible on touch.
 if (isMobile) {
 setSelected([version.id]);
 setFocused(version.id);
 setViewMode("single");
 return;
    }
 setSelected([version.id]);
 setFocused(version.id);
  };
 // Some browsers swallow a normal `click` event on draggable elements when
 // a modifier is held (because the user might be initiating a non-drag
 // gesture). Catch shift/meta presses on mousedown so multi-select stays
 // bullet-proof regardless of click flakiness.
 const handleMouseDown = (e: React.MouseEvent) => {
 if (e.button !== 0) return;
 if (e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
 toggleSelected(version.id);
    }
  };
 const handleDoubleClick = () => {
 setSelected([version.id]);
 setFocused(version.id);
 setViewMode("single");
  };
 
 const handleDragStart = (e: React.DragEvent) => {
 // If part of a multi-select, drag the whole set; otherwise just this one.
 const selectedIds = useStore.getState().selectedIds;
 const ids =
      selectedIds.has(version.id) && selectedIds.size > 1
 ? Array.from(selectedIds)
 : [version.id];
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(ids));
 // Make external apps not see image bytes
    e.dataTransfer.setData("text/plain", version.label);
  };
 
 const onRename = async () => {
 const next = await uiPrompt({
      title: "Rename version",
      defaultValue: version.label,
      confirmLabel: "Rename",
    });
 if (next?.trim()) await updateVersion(version.id, { label: next.trim() });
  };
 const onDelete = async () => {
 const ok = await uiConfirm({
      title: "Delete this version?",
      description: "This can't be undone.",
      danger: true,
      confirmLabel: "Delete",
    });
 if (ok) {
 await deleteVersion(version.id);
 toast({ title: "Version deleted", tone: "success" });
    }
  };
 
 return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
 data-version-card={version.id}
 onClick={handleClick}
 onMouseDown={handleMouseDown}
 onDoubleClick={handleDoubleClick}
 draggable
 onDragStart={handleDragStart}
 className={cn(
 "group relative flex flex-col cursor-pointer select-none",
 "bg-[var(--surface)] overflow-hidden",
 "rounded-[var(--radius-md)]",
 "transition-[box-shadow,background-color,opacity,filter] duration-150",
          )}
 style={{
            width: 180,
            opacity:
              version.verdict === "rejected"
 ? 0.5
 : version.rating > 0
 ? // 1★ → 0.7, 5★ → 1.0 (linear); unrated stays at 1
 0.7 + (version.rating - 1) * 0.075
 : 1,
            filter:
              version.verdict === "rejected"
 ? "saturate(0.55)"
 : version.rating > 0
 ? // 1★ → 0.5, 5★ → 1.0 (linear); unrated stays full colour
 `saturate(${(0.5 + (version.rating - 1) * 0.125).toFixed(3)})`
 : undefined,
            boxShadow:
              selected || focused
 ? "0 0 0 1.5px var(--brand)"
 : "0 0 0 1px var(--border)",
          }}
        >
          <div
 className="relative w-full bg-[var(--bg-soft)]"
 style={{
              paddingTop: `${(1 / Math.max(0.45, Math.min(2, aspect))) * 100}%`,
            }}
          >
            <div className="absolute inset-0">
              <Thumb
 blobId={version.thumbBlobId ?? version.blobId}
 fit="cover"
 className="w-full h-full"
 imageWidth={version.width}
 imageHeight={version.height}
 annotations={version.annotations}
              />
            </div>
 
            {/* Verdict ribbon (top-left) */}
            {version.verdict !== "unset" && (
              <div
 className={cn(
 "absolute top-1.5 left-1.5 inline-flex items-center gap-1 h-[18px] px-1.5 rounded-[var(--radius-sm)] text-[10.5px] font-medium border",
                  version.verdict === "winner"
 ? "bg-[var(--winner)] text-white border-transparent"
 : "bg-[var(--surface)] text-[var(--fg-muted)] border-[var(--border)]",
                )}
              >
                {version.verdict === "winner" ? (
                  <Crown size={9} />
                ) : (
                  <span
 className="dot"
 style={{ background: VERDICT_COLOR[version.verdict] }}
                  />
                )}
                {VERDICT_LABEL[version.verdict]}
              </div>
            )}
 
            {/* Annotation badge */}
            {ann > 0 && (
              <div
 className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 h-[18px] px-1 rounded-[var(--radius-sm)] text-[10.5px] font-medium"
 style={{
                  background: "var(--surface)",
                  color: "var(--fg-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <PencilLine size={9} />
                {ann}
              </div>
            )}
 
            {/* Selection toggle:
                - Desktop (lg+): hover-only when unselected (clean look).
                - Mobile / touch: always visible (no hover state to lean on)
                  and a 28×28 hit target so a thumb can actually tap it.
            */}
            <button
 onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
 toggleSelected(version.id);
              }}
 onMouseDown={(e) => e.stopPropagation()}
 onDoubleClick={(e) => e.stopPropagation()}
 draggable={false}
 aria-label={selected ? "Deselect" : "Select"}
 className={cn(
 "absolute bottom-1.5 right-1.5 grid place-items-center rounded-full transition-opacity",
 "h-7 w-7 lg:h-5 lg:w-5",
                selected
 ? "opacity-100"
 : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
              )}
 style={
                selected
 ? {
                      background: "var(--brand)",
                      color: "var(--brand-fg)",
                    }
 : {
                      background: "var(--surface)",
                      color: "var(--fg-muted)",
                      border: "1px solid var(--border)",
                    }
              }
            >
              {selected ? (
                <Check size={11} strokeWidth={2.5} />
              ) : (
                <span className="block w-2 h-2 rounded-full border border-[var(--fg-subtle)]" />
              )}
            </button>
          </div>
 
          <div className="flex items-center gap-1.5 px-2.5 h-8">
            <span className="font-medium text-[12.5px] truncate">
              {version.label}
            </span>
            {version.rating > 0 && (
              <span className="ml-auto inline-flex items-center gap-0.5 text-[var(--winner)]">
                <Star size={11} fill="currentColor" strokeWidth={0} />
                <span className="text-[10.5px] font-mono tabular-nums">
                  {version.rating}
                </span>
              </span>
            )}
          </div>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
 className={cn(
 "z-[60] min-w-[200px] p-1",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-md)] shadow-[var(--shadow-pop)]",
 "data-[state=open]:animate-cm-in data-[state=closed]:animate-cm-out",
          )}
        >
          <MenuItem
 onSelect={() => {
 setSelected([version.id]);
 setFocused(version.id);
 setViewMode("single");
            }}
 icon={<ImageIcon size={12} />}
 label="Open in single view"
          />
          <MenuItem
 onSelect={onRename}
 icon={<PenLine size={12} />}
 label="Rename"
          />
          <MenuItem
 onSelect={() => {
              copyImageToClipboard(version.blobId);
            }}
 icon={<ClipboardCopy size={12} />}
 label="Copy image"
          />
          <MenuItem
 onSelect={() => {
              saveImageToDisk(version.blobId, version.label || "version");
            }}
 icon={<Download size={12} />}
 label="Save image…"
          />
 
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger
 className="flex items-center gap-2 px-2 py-1.5 text-[12.5px] text-[var(--fg)] data-[state=open]:bg-[var(--bg-soft)] hover:bg-[var(--bg-soft)] rounded-[var(--radius-sm)] cursor-default outline-none"
            >
              <span className="text-[var(--fg-subtle)]">
                <ArrowRightLeft size={12} />
              </span>
              <span className="flex-1">Move to page</span>
              <ChevronRight size={12} className="text-[var(--fg-subtle)]" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent
 sideOffset={4}
 className={cn(
 "min-w-[180px] p-1",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-md)] shadow-[var(--shadow-pop)]",
 "data-[state=open]:animate-cm-in data-[state=closed]:animate-cm-out",
                )}
              >
                {projectPages.map((p) => (
                  <MenuItem
 key={p.id}
 onSelect={async () => {
 if (p.id === version.pageId) return;
 await movePage(version.id, p.id);
 toast({
                        title: `Moved to ${p.name}`,
                        tone: "success",
                      });
                    }}
 icon={
                      p.id === version.pageId ? (
                        <Check size={12} className="text-[var(--brand)]" />
                      ) : (
                        <span className="w-3" />
                      )
                    }
 label={p.name}
                  />
                ))}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
 
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="flex items-center gap-2 px-2 py-1.5 text-[12.5px] text-[var(--fg)] data-[state=open]:bg-[var(--bg-soft)] hover:bg-[var(--bg-soft)] rounded-[var(--radius-sm)] cursor-default outline-none">
              <span className="text-[var(--fg-subtle)]">
                <CircleDashed size={12} />
              </span>
              <span className="flex-1">Set verdict</span>
              <ChevronRight size={12} className="text-[var(--fg-subtle)]" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent
 sideOffset={4}
 className={cn(
 "min-w-[160px] p-1",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-md)] shadow-[var(--shadow-pop)]",
 "data-[state=open]:animate-cm-in data-[state=closed]:animate-cm-out",
                )}
              >
                {VERDICTS.map((v) => (
                  <MenuItem
 key={v}
 onSelect={() => setVerdict(version.id, v as Verdict)}
 icon={
                      v === "winner" ? (
                        <Crown
 size={12}
 className="text-[var(--winner)]"
                        />
                      ) : (
                        <span
 className="dot"
 style={{
                            background:
                              v === "unset"
 ? "transparent"
 : VERDICT_COLOR[v as Verdict],
                            outline:
                              v === "unset"
 ? "1px dashed var(--fg-subtle)"
 : undefined,
                            outlineOffset: v === "unset" ? -1 : undefined,
                          }}
                        />
                      )
                    }
 label={VERDICT_LABEL[v as Verdict]}
 trailing={
                      version.verdict === v ? (
                        <Check size={11} className="text-[var(--fg-muted)]" />
                      ) : null
                    }
                  />
                ))}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
 
          {/* Lower-frequency actions live in a submenu so fast right-click
              "copy" muscle memory never lands on Duplicate by accident. */}
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="flex items-center gap-2 px-2 py-1.5 text-[12.5px] text-[var(--fg)] data-[state=open]:bg-[var(--bg-soft)] hover:bg-[var(--bg-soft)] rounded-[var(--radius-sm)] cursor-default outline-none">
              <span className="text-[var(--fg-subtle)]">
                <MoreHorizontal size={12} />
              </span>
              <span className="flex-1">More</span>
              <ChevronRight size={12} className="text-[var(--fg-subtle)]" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent
 sideOffset={4}
 className={cn(
 "min-w-[180px] p-1",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-md)] shadow-[var(--shadow-pop)]",
 "data-[state=open]:animate-cm-in data-[state=closed]:animate-cm-out",
                )}
              >
                <MenuItem
 onSelect={async () => {
 await duplicateVersion(version.id);
 toast({ title: "Duplicated", tone: "success" });
                  }}
 icon={<Copy size={12} />}
 label="Duplicate version"
                />
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          <ContextMenu.Separator className="h-px bg-[var(--border)] my-1 -mx-1" />
          <MenuItem
 onSelect={onDelete}
 icon={<Trash2 size={12} />}
 label="Delete"
 tone="danger"
          />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
 
function MenuItem({
 onSelect,
 icon,
 label,
 trailing,
 tone,
}: {
 onSelect: () => void;
 icon?: React.ReactNode;
 label: string;
 trailing?: React.ReactNode;
 tone?: "danger";
}) {
 return (
    <ContextMenu.Item
 onSelect={onSelect}
 className={cn(
 "flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-[12.5px] cursor-default outline-none",
        tone === "danger"
 ? "text-[var(--danger)] data-[highlighted]:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
 : "text-[var(--fg)] data-[highlighted]:bg-[var(--bg-soft)]",
      )}
    >
      <span
 className={cn(
 "shrink-0",
          tone === "danger" ? "" : "text-[var(--fg-subtle)]",
        )}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </ContextMenu.Item>
  );
}
 
// Memoized so a card only re-renders when its own `version` object changes
// identity (immer gives changed versions a fresh reference; untouched ones
// keep theirs) or when its selected/focused booleans flip.
export const VersionCard = React.memo(VersionCardImpl);

export const VERSION_DRAG_MIME = DRAG_MIME;
