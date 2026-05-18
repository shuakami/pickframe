"use client";
 
import * as React from "react";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { Kbd } from "../primitives/Kbd";
import { cn } from "@/lib/utils";
import { uiPrompt } from "@/lib/ui";
import {
  Search,
  LayoutGrid,
  Columns2,
  Image as ImageIcon,
  Workflow,
  Filter,
  Download,
  Sun,
  Plus,
  Folder,
  Sparkles,
  Crown,
  Upload,
  PackageOpen,
} from "lucide-react";
import { exportArchive } from "@/lib/portable";
import { toast, updateToast, dismissToast } from "@/lib/ui";
 
export function CommandPalette() {
 const open = useStore((s) => s.commandOpen);
 const setOpen = useStore((s) => s.setCommandOpen);
 const projects = useStore((s) => s.projects);
 const pages = useStore((s) => s.pages);
 const tags = useStore((s) => s.tags);
 const versions = useStore((s) => s.versions);
 const activeProjectId = useStore((s) => s.activeProjectId);
 const setActiveProject = useStore((s) => s.setActiveProject);
 const setActivePage = useStore((s) => s.setActivePage);
 const setViewMode = useStore((s) => s.setViewMode);
 const setExportOpen = useStore((s) => s.setExportOpen);
 const setImportOpen = useStore((s) => s.setImportOpen);
 const setFilterOpen = useStore((s) => s.setFilterOpen);
 const toggleTheme = useStore((s) => s.toggleTheme);
 const setFilter = useStore((s) => s.setFilter);
 const resetFilter = useStore((s) => s.resetFilter);
 const setFocused = useStore((s) => s.setFocused);
 // Local query — must NOT be the same as the store's `search` field, which
 // drives the Board's text filter. Typing in the palette should never reach
 // out and filter the canvas behind it.
 const [search, setSearch] = React.useState("");
 // Clear the query when the palette closes (adjust-state-to-props pattern).
 const [prevOpen, setPrevOpen] = React.useState(open);
 if (prevOpen !== open) {
 setPrevOpen(open);
 if (!open) setSearch("");
  }
 const addProject = useStore((s) => s.addProject);
 const addPage = useStore((s) => s.addPage);
 
 const projectPages = pages.filter((p) => p.projectId === activeProjectId);
 const projectTags = tags.filter((t) => t.projectId === activeProjectId);
 const projectVersions = versions.filter(
    (v) => v.projectId === activeProjectId,
  );
 
 const close = () => setOpen(false);
 
 return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
 className="fixed inset-0 z-50 backdrop-blur-sm"
 style={{ background: "var(--scrim)" }}
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.14, ease: [0.2, 0.7, 0.2, 1] }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
 initial={{ opacity: 0, y: 6, scale: 0.985 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 4, scale: 0.985 }}
 transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
 className={cn(
 "fixed left-1/2 top-[18%] -translate-x-1/2 z-50 w-[min(92vw,560px)]",
 "bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)]",
 "shadow-[var(--shadow-modal)] overflow-hidden",
                )}
              >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search projects, pages, tags, or run a command
          </Dialog.Description>
          <Command
 label="Command palette"
 className="flex flex-col"
 filter={(value, search) => {
 if (!search) return 1;
 return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <div className="flex items-center gap-2 px-3 h-11 border-b border-[var(--border)]">
              <Search size={14} className="text-[var(--fg-subtle)]" />
              <Command.Input
 value={search}
 onValueChange={setSearch}
 placeholder="Search commands, projects, pages, tags…"
 className="flex-1 bg-transparent border-0 outline-none text-[13.5px] placeholder:text-[var(--fg-subtle)]"
              />
              <Kbd>esc</Kbd>
            </div>
            <Command.List className="max-h-[400px] overflow-y-auto py-1.5">
              <Command.Empty className="px-3 py-6 text-center text-[12.5px] text-[var(--fg-subtle)]">
                No results
              </Command.Empty>
 
              <Group label="Views">
                <Item
 onSelect={() => {
 setViewMode("board");
 close();
                  }}
 icon={<LayoutGrid size={13} />}
 label="Switch to Board"
 keys={["⌘", "1"]}
                />
                <Item
 onSelect={() => {
 setViewMode("compare");
 close();
                  }}
 icon={<Columns2 size={13} />}
 label="Switch to Compare"
 keys={["⌘", "2"]}
                />
                <Item
 onSelect={() => {
 setViewMode("single");
 close();
                  }}
 icon={<ImageIcon size={13} />}
 label="Switch to Single"
 keys={["⌘", "3"]}
                />
                <Item
 onSelect={() => {
 setViewMode("flow");
 close();
                  }}
 icon={<Workflow size={13} />}
 label="Switch to Flow"
 keys={["⌘", "4"]}
                />
              </Group>
 
              <Group label="Actions">
                <Item
 onSelect={async () => {
 close();
 const name = await uiPrompt({
                      title: "New project",
                      placeholder: "e.g. Mini app redesign",
                      confirmLabel: "Create",
                    });
 if (name?.trim()) await addProject(name.trim());
                  }}
 icon={<Plus size={13} />}
 label="New project"
                />
                {activeProjectId && (
                  <Item
 onSelect={async () => {
 close();
 const name = await uiPrompt({
                        title: "New page",
                        placeholder: "e.g. Home, Cart, Checkout",
                        confirmLabel: "Create",
                      });
 if (name?.trim())
 await addPage(activeProjectId, name.trim());
                    }}
 icon={<Plus size={13} />}
 label="New page"
                  />
                )}
                <Item
 onSelect={() => {
 setExportOpen(true);
 close();
                  }}
 icon={<Download size={13} />}
 label="Export selected…"
 keys={["⌘", "E"]}
                />
                <Item
 onSelect={() => {
 setImportOpen(true);
 close();
                  }}
 icon={<Upload size={13} />}
 label="Import library…"
                />
                <Item
 onSelect={async () => {
 close();
 const project = projects.find(
                      (p) => p.id === activeProjectId,
                    );
 const id = toast({
                      title: project ? `Exporting ${project.name}…` : "Exporting library…",
                      description: "Preparing archive…",
                      sticky: true,
                      progress: 0,
                    });
 try {
 await exportArchive({
                        projectId: activeProjectId ?? undefined,
                        filename: project
 ? `${project.name}-pickframe`
 : "pickframe-library",
                        onProgress: (msg, frac) =>
                          updateToast(id, { description: msg, progress: frac }),
                      });
                      dismissToast(id);
                      toast({
                        title: "Library exported",
                        description: project
 ? `Project: ${project.name}`
 : "Full library",
                        tone: "success",
                      });
                    } catch (e) {
                      dismissToast(id);
                      toast({
                        title: "Export failed",
                        description: (e as Error).message,
                        tone: "danger",
                      });
                    }
                  }}
 icon={<PackageOpen size={13} />}
 label={
                    activeProjectId
 ? "Export this project as archive…"
 : "Export full library as archive…"
                  }
                />
                <Item
 onSelect={() => {
 setFilterOpen(true);
 close();
                  }}
 icon={<Filter size={13} />}
 label="Open filters"
                />
                <Item
 onSelect={() => {
 resetFilter();
 close();
                  }}
 icon={<Sparkles size={13} />}
 label="Clear filters"
                />
                <Item
 onSelect={() => {
 setFilter({ verdicts: ["winner"] });
 close();
                  }}
 icon={<Crown size={13} />}
 label="Show winners only"
                />
                <Item
 onSelect={() => {
 toggleTheme();
 close();
                  }}
 icon={<Sun size={13} />}
 label="Toggle theme"
 keys={["⇧", "T"]}
                />
              </Group>
 
              {projects.length > 0 && (
                <Group label="Projects">
                  {projects.map((p) => (
                    <Item
 key={p.id}
 value={`project ${p.name}`}
 onSelect={() => {
 setActiveProject(p.id);
 close();
                      }}
 icon={
                        p.emoji ? (
                          <span className="text-[12px]">{p.emoji}</span>
                        ) : (
                          <Folder size={13} />
                        )
                      }
 label={p.name}
                    />
                  ))}
                </Group>
              )}
 
              {projectPages.length > 0 && (
                <Group label="Pages">
                  {projectPages.map((p) => (
                    <Item
 key={p.id}
 value={`page ${p.name}`}
 onSelect={() => {
 setActivePage(p.id);
 setViewMode("board");
 close();
                      }}
 icon={<Folder size={13} />}
 label={p.name}
                    />
                  ))}
                </Group>
              )}
 
              {projectTags.length > 0 && (
                <Group label="Filter by tag">
                  {projectTags.map((t) => (
                    <Item
 key={t.id}
 value={`tag ${t.name}`}
 onSelect={() => {
 setFilter({ tagIds: [t.id] });
 close();
                      }}
 icon={
                        <span
 className="dot"
 style={{ background: t.color }}
 aria-hidden
                        />
                      }
 label={t.name}
                    />
                  ))}
                </Group>
              )}
 
              {projectVersions.length > 0 && (
                <Group label="Jump to version">
                  {projectVersions.slice(0, 24).map((v) => {
 const page = pages.find((p) => p.id === v.pageId);
 return (
                      <Item
 key={v.id}
 value={`version ${v.label} ${page?.name ?? ""} ${v.note}`}
 onSelect={() => {
 setFocused(v.id);
 setViewMode("single");
 close();
                        }}
 icon={<ImageIcon size={13} />}
 label={
                          <span className="flex items-center gap-1.5">
                            <span>{page?.name}</span>
                            <span className="text-[var(--fg-subtle)]">·</span>
                            <span className="text-[var(--fg-muted)]">
                              {v.label}
                            </span>
                            {v.note && (
                              <span className="text-[var(--fg-subtle)] truncate max-w-[160px]">
                                — {v.note}
                              </span>
                            )}
                          </span>
                        }
                      />
                    );
                  })}
                </Group>
              )}
            </Command.List>
            <div className="border-t border-[var(--border)] px-3 h-8 flex items-center justify-between text-[11px] text-[var(--fg-subtle)]">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd> Select
              </span>
            </div>
          </Command>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
 
function Group({
 label,
 children,
}: {
 label: string;
 children: React.ReactNode;
}) {
 return (
    <Command.Group
 heading={label}
 className="px-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--fg-subtle)]"
    >
      {children}
    </Command.Group>
  );
}
 
function Item({
 value,
 onSelect,
 icon,
 label,
 keys,
}: {
 value?: string;
 onSelect: () => void;
 icon?: React.ReactNode;
 label: React.ReactNode;
 keys?: string[];
}) {
 return (
    <Command.Item
 value={value ?? (typeof label === "string" ? label : undefined)}
 onSelect={onSelect}
 className={cn(
 "group flex items-center gap-2 px-2 mx-1 rounded-[var(--radius-md)] cursor-pointer",
 "text-[12.5px] text-[var(--fg-muted)] aria-selected:bg-[var(--bg-soft)] aria-selected:text-[var(--fg)]",
 "h-8",
      )}
    >
      <span className="text-[var(--fg-subtle)] group-aria-selected:text-[var(--fg-muted)] shrink-0 w-4 grid place-items-center">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {keys && (
        <span className="flex items-center gap-1">
          {keys.map((k) => (
            <Kbd key={k}>{k}</Kbd>
          ))}
        </span>
      )}
    </Command.Item>
  );
}
