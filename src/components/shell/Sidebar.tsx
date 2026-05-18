"use client";
 
import * as React from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  FolderClosed,
  Hash,
  Trash2,
  PencilLine,
  Layers,
} from "lucide-react";
import { uiPrompt, uiConfirm } from "@/lib/ui";
import type { Page } from "@/lib/types";
import { PageLabel } from "../primitives/PageLabel";
 
/**
 * Sidebar — pure navigation.
 *
 * No add buttons, no chevrons, no status filters. Just the three things
 * you want when scanning your work: which Project, which Page, which Tag.
 *
 * All CRUD lives behind right-click (Radix ContextMenu) and the global
 * "New" menu in the top bar / command palette.
 */
export function Sidebar({
 onCloseMobile,
}: {
 onCloseMobile?: () => void;
} = {}) {
 const loaded = useStore((s) => s.loaded);
 if (!loaded) {
 return <SidebarSkeleton />;
 }
 return <SidebarReal onCloseMobile={onCloseMobile} />;
}

/**
 * One-row skeleton — deliberately minimal. Showing many fake rows is
 * unstable: the real Sidebar might have 1, 5, or 50 items, so the skeleton
 * always lies to some degree. A single shimmer bar is honest about
 * "something is coming" without committing to a specific count.
 */
function SidebarSkeleton() {
 return (
    <aside
 className={cn(
 "w-[220px] shrink-0 h-full overflow-hidden",
 "bg-[var(--bg)] py-3 px-2",
      )}
 aria-busy="true"
 aria-label="Loading navigation"
    >
      <div className="flex items-center gap-2 px-1.5 h-7">
        <div className="pf-skel h-3.5 w-3.5 rounded-[3px]" />
        <div className="pf-skel h-3 flex-1" />
      </div>
    </aside>
  );
}

function SidebarReal({
 onCloseMobile,
}: {
 onCloseMobile?: () => void;
}) {
 const projects = useStore((s) => s.projects);
 const activeProjectId = useStore((s) => s.activeProjectId);
 const setActiveProject = useStore((s) => s.setActiveProject);
 const viewMode = useStore((s) => s.viewMode);
 const setViewMode = useStore((s) => s.setViewMode);
 // When the user clicks anything in the sidebar while in Compare/Flow/
 // Single, those views don't reflect the new selection — so snap back
 // to Board so the click feels responsive.
 const ensureBoard = React.useCallback(() => {
 if (viewMode !== "board") {
      setViewMode("board");
    }
  }, [viewMode, setViewMode]);
 const pages = useStore((s) => s.pages);
 const tags = useStore((s) => s.tags);
 const versions = useStore((s) => s.versions);
 const activePageId = useStore((s) => s.activePageId);
 const setActivePage = useStore((s) => s.setActivePage);
 const filter = useStore((s) => s.filter);
 const setFilter = useStore((s) => s.setFilter);
 const renamePage = useStore((s) => s.renamePage);
 const deletePage = useStore((s) => s.deletePage);
 const reorderPages = useStore((s) => s.reorderPages);
 const deleteTag = useStore((s) => s.deleteTag);
 const renameProject = useStore((s) => s.renameProject);
 const deleteProject = useStore((s) => s.deleteProject);
 
 const projectPages = pages
    .filter((p) => p.projectId === activeProjectId)
    .sort((a, b) => a.order - b.order);
 const projectTags = tags.filter((t) => t.projectId === activeProjectId);
 const projectVersions = versions.filter(
    (v) => v.projectId === activeProjectId,
  );
 
 const tagCount = (tagId: string) =>
    projectVersions.filter((v) => v.tagIds.includes(tagId)).length;
 const pageVersionCount = (pageId: string) =>
    projectVersions.filter((v) => v.pageId === pageId).length;
 
 return (
    <aside
 className={cn(
 "w-[220px] shrink-0 h-full overflow-y-auto",
 "bg-[var(--bg)]",
 "py-3",
      )}
    >
      {/* Projects */}
      <Section label="Projects">
        {projects.length === 0 && (
          <Hint>Create your first project from the top bar.</Hint>
        )}
        {projects.map((p) => {
 const count = versions.filter((v) => v.projectId === p.id).length;
 return (
            <RowWithMenu
 key={p.id}
 active={p.id === activeProjectId}
 onClick={() => {
                ensureBoard();
 setActiveProject(p.id);
 onCloseMobile?.();
              }}
 icon={
                p.emoji ? (
                  <span className="text-[13px] leading-none">{p.emoji}</span>
                ) : (
                  <Layers size={12} />
                )
              }
 label={p.name}
 count={count}
 onRename={async () => {
 const next = await uiPrompt({
                  title: "Rename project",
                  defaultValue: p.name,
                  confirmLabel: "Rename",
                });
 if (next?.trim()) await renameProject(p.id, next.trim());
              }}
 onDelete={async () => {
 const ok = await uiConfirm({
                  title: `Delete “${p.name}”?`,
                  description:
 "This permanently removes its pages, tags, and every version.",
                  danger: true,
                  confirmLabel: "Delete project",
                });
 if (ok) await deleteProject(p.id);
              }}
            />
          );
        })}
      </Section>
 
      {activeProjectId && (
        <>
          {/* Pages */}
          <Section label="Pages" hint={projectPages.length || undefined}>
            {projectPages.length === 0 ? (
              <Hint>Drop images on the board to start a page.</Hint>
            ) : (
              <PageList
 pages={projectPages}
 activePageId={activePageId}
 onActivate={(id) => {
                  ensureBoard();
 setActivePage(id === activePageId ? null : id);
 onCloseMobile?.();
                }}
 pageVersionCount={pageVersionCount}
 onRename={async (p) => {
 const next = await uiPrompt({
                    title: "Rename page",
                    defaultValue: p.name,
                    confirmLabel: "Rename",
                  });
 if (next?.trim()) await renamePage(p.id, next.trim());
                }}
 onDelete={async (p) => {
 const ok = await uiConfirm({
                    title: `Delete “${p.name}”?`,
                    description: "All versions on this page will be removed.",
                    danger: true,
                    confirmLabel: "Delete page",
                  });
 if (ok) await deletePage(p.id);
                }}
 onReorder={async (orderedIds) => {
 if (!activeProjectId) return;
 await reorderPages(activeProjectId, orderedIds);
                }}
              />
            )}
          </Section>
 
          {/* Tags */}
          {projectTags.length > 0 && (
            <Section label="Tags" hint={projectTags.length}>
              {projectTags.map((t) => {
 const isActive = filter.tagIds?.includes(t.id);
 return (
                  <RowWithMenu
 key={t.id}
 active={!!isActive}
 onClick={() => {
                      ensureBoard();
 const cur = filter.tagIds ?? [];
 const next = cur.includes(t.id)
 ? cur.filter((x) => x !== t.id)
 : [...cur, t.id];
 setFilter({ tagIds: next.length ? next : undefined });
                    }}
 dotColor={t.color}
 icon={<Hash size={12} />}
 label={t.name}
 count={tagCount(t.id)}
 onDelete={async () => {
 const ok = await uiConfirm({
                        title: `Delete tag “${t.name}”?`,
                        description:
 "It will also be removed from versions using it.",
                        danger: true,
                        confirmLabel: "Delete tag",
                      });
 if (ok) await deleteTag(t.id);
                    }}
                  />
                );
              })}
            </Section>
          )}
        </>
      )}
 
      <div className="h-4" />
    </aside>
  );
}
 
function Section({
 label,
 hint,
 children,
}: {
 label: string;
 hint?: number;
 children: React.ReactNode;
}) {
 return (
    <section className="mb-3">
      <div className="flex items-baseline gap-1.5 px-3 pb-1">
        <span className="text-[11.5px] font-medium text-[var(--fg-subtle)]">
          {label}
        </span>
        {hint !== undefined && (
          <span className="text-[10.5px] text-[var(--fg-subtle)] tabular-nums">
            {hint}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-1.5">{children}</div>
    </section>
  );
}
 
function Hint({ children }: { children: React.ReactNode }) {
 return (
    <div className="px-2 py-1.5 text-[11.5px] text-[var(--fg-subtle)] leading-[1.55]">
      {children}
    </div>
  );
}
 
function RowWithMenu({
 active,
 icon,
 label,
 count,
 dotColor,
 onClick,
 onRename,
 onDelete,
}: {
 active?: boolean;
 icon?: React.ReactNode;
 label: React.ReactNode;
 count?: number;
 dotColor?: string;
 onClick?: () => void;
 onRename?: () => void;
 onDelete?: () => void;
}) {
 const trigger = (
    <button
 onClick={onClick}
 className={cn(
 "group w-full flex items-center gap-1.5 h-7 px-2 rounded-[var(--radius-sm)] text-left select-none",
        active
 ? "bg-[var(--bg-soft)] text-[var(--fg)]"
 : "text-[var(--fg-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--fg)]",
      )}
    >
      {dotColor && (
        <span
 className="dot shrink-0"
 style={{ background: dotColor }}
 aria-hidden
        />
      )}
      {icon && !dotColor && (
        <span className="shrink-0 text-[var(--fg-subtle)]">{icon}</span>
      )}
      <span className="flex-1 truncate text-[12.5px]">{label}</span>
      {count != null && count > 0 && (
        <span className="text-[10.5px] font-mono text-[var(--fg-subtle)] tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
 
 if (!onRename && !onDelete) return trigger;
 
 return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{trigger}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
 className={cn(
 "z-[60] min-w-[160px] p-1",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-md)] shadow-[var(--shadow-pop)]",
 "data-[state=open]:animate-cm-in data-[state=closed]:animate-cm-out",
          )}
        >
          {onRename && (
            <ContextMenu.Item
 onSelect={onRename}
 className={cn(
 "flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-[12.5px] cursor-default outline-none",
 "data-[highlighted]:bg-[var(--bg-soft)]",
              )}
            >
              <PencilLine size={11} className="text-[var(--fg-subtle)]" />
              Rename
            </ContextMenu.Item>
          )}
          {onDelete && (
            <ContextMenu.Item
 onSelect={onDelete}
 className={cn(
 "flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-[12.5px] cursor-default outline-none",
 "text-[var(--danger)] data-[highlighted]:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]",
              )}
            >
              <Trash2 size={11} />
              Delete
            </ContextMenu.Item>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
 
const PAGE_DRAG_MIME = "application/x-pickframe-page";
 
function PageList({
 pages,
 activePageId,
 onActivate,
 pageVersionCount,
 onRename,
 onDelete,
 onReorder,
}: {
 pages: Page[];
 activePageId: string | null;
 onActivate: (id: string) => void;
 pageVersionCount: (id: string) => number;
 onRename: (p: Page) => void;
 onDelete: (p: Page) => void;
 onReorder: (orderedIds: string[]) => void;
}) {
 const [draggingId, setDraggingId] = React.useState<string | null>(null);
 const [overId, setOverId] = React.useState<string | null>(null);
 const [overPos, setOverPos] = React.useState<"before" | "after">("before");
 
 function commit(targetId: string, pos: "before" | "after") {
 if (!draggingId || draggingId === targetId) return;
 const ids = pages.map((p) => p.id).filter((id) => id !== draggingId);
 let idx = ids.indexOf(targetId);
 if (idx < 0) return;
 if (pos === "after") idx += 1;
    ids.splice(idx, 0, draggingId);
 onReorder(ids);
  }
 
 return (
    <>
      {pages.map((p) => {
 const isDragging = draggingId === p.id;
 const isOver = overId === p.id && draggingId && draggingId !== p.id;
 return (
          <div
 key={p.id}
 draggable
 onDragStart={(e) => {
              e.dataTransfer.setData(PAGE_DRAG_MIME, p.id);
              e.dataTransfer.effectAllowed = "move";
 setDraggingId(p.id);
            }}
 onDragEnd={() => {
 setDraggingId(null);
 setOverId(null);
            }}
 onDragOver={(e) => {
 if (!e.dataTransfer.types.includes(PAGE_DRAG_MIME)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
 const rect = e.currentTarget.getBoundingClientRect();
 const before = e.clientY < rect.top + rect.height / 2;
 setOverId(p.id);
 setOverPos(before ? "before" : "after");
            }}
 onDragLeave={(e) => {
 if (e.currentTarget === e.target) setOverId(null);
            }}
 onDrop={(e) => {
 if (!e.dataTransfer.types.includes(PAGE_DRAG_MIME)) return;
              e.preventDefault();
 const rect = e.currentTarget.getBoundingClientRect();
 const before = e.clientY < rect.top + rect.height / 2;
 commit(p.id, before ? "before" : "after");
 setDraggingId(null);
 setOverId(null);
            }}
 className="relative"
 style={{ opacity: isDragging ? 0.4 : 1 }}
          >
            {isOver && overPos === "before" && (
              <span className="absolute left-2 right-2 top-0 h-px bg-[var(--brand)]" />
            )}
            <RowWithMenu
 active={p.id === activePageId}
 onClick={() => onActivate(p.id)}
 icon={<FolderClosed size={12} />}
 label={<PageLabel name={p.name} />}
 count={pageVersionCount(p.id)}
 onRename={() => onRename(p)}
 onDelete={() => onDelete(p)}
            />
            {isOver && overPos === "after" && (
              <span className="absolute left-2 right-2 bottom-0 h-px bg-[var(--brand)]" />
            )}
          </div>
        );
      })}
    </>
  );
}
