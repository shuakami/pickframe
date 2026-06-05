"use client";
 
import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useStore } from "@/lib/store";
import { Tooltip } from "../primitives/Tooltip";
import { Kbd } from "../primitives/Kbd";
import { Logo } from "../primitives/Logo";
import { cn } from "@/lib/utils";
import { uiPrompt } from "@/lib/ui";
import { PageLabel } from "../primitives/PageLabel";
import {
  Search,
  LayoutGrid,
  Columns2,
  Image as ImageIcon,
  Workflow,
  Filter,
  Download,
  Sun,
  Moon,
  Plus,
  ChevronRight,
  ChevronDown,
  Layers,
  FolderPlus,
  Hash,
  Menu,
  Upload,
  PackageOpen,
  Check,
} from "lucide-react";

// Custom sidebar toggle icon — small filled-panel glyph that reads more
// cleanly than lucide's PanelLeftClose/Open at 18px. The same artwork is
// used for both states; styling indicates the active rail.
function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
 return (
    <svg
 aria-hidden
      width={18}
      height={18}
 viewBox="0 0 24 24"
 fill="none"
 xmlns="http://www.w3.org/2000/svg"
 style={{ transform: collapsed ? "scaleX(-1)" : undefined }}
    >
      <path
 d="M4.270 4.041 C 3.702 4.138,3.154 4.442,2.728 4.898 C 2.440 5.206,2.241 5.550,2.113 5.960 L 2.020 6.260 2.020 12.000 L 2.020 17.740 2.113 18.040 C 2.256 18.498,2.455 18.822,2.816 19.184 C 3.178 19.545,3.502 19.744,3.960 19.887 L 4.260 19.980 12.000 19.980 L 19.740 19.980 20.040 19.887 C 20.498 19.744,20.822 19.545,21.184 19.184 C 21.545 18.822,21.744 18.498,21.887 18.040 L 21.980 17.740 21.980 12.000 L 21.980 6.260 21.887 5.960 C 21.625 5.118,20.939 4.413,20.109 4.131 L 19.780 4.020 12.120 4.014 C 7.907 4.011,4.375 4.023,4.270 4.041 M7.480 12.023 L 7.480 18.526 5.990 18.511 C 4.688 18.497,4.476 18.486,4.312 18.425 C 4.038 18.322,3.769 18.066,3.634 17.782 L 3.520 17.540 3.520 12.000 L 3.521 6.460 3.623 6.240 C 3.758 5.948,3.929 5.775,4.220 5.635 L 4.460 5.520 5.970 5.520 L 7.480 5.520 7.480 12.023 M19.760 5.623 C 20.052 5.758,20.225 5.929,20.365 6.220 L 20.480 6.460 20.480 12.000 L 20.480 17.540 20.366 17.782 C 20.232 18.065,19.964 18.320,19.688 18.427 C 19.510 18.496,19.220 18.500,14.250 18.511 L 9.000 18.522 9.000 12.021 L 9.000 5.520 14.270 5.520 L 19.540 5.521 19.760 5.623"
 stroke="none"
 fillRule="evenodd"
 fill="currentColor"
      />
    </svg>
  );
}
import { exportArchive } from "@/lib/portable";
import { toast, updateToast, dismissToast } from "@/lib/ui";
 
export function TopBar({
 onToggleMobileSidebar,
}: {
 onToggleMobileSidebar?: () => void;
} = {}) {
 const search = useStore((s) => s.search);
 const setSearch = useStore((s) => s.setSearch);
 const setCommandOpen = useStore((s) => s.setCommandOpen);
 const viewMode = useStore((s) => s.viewMode);
 const setViewMode = useStore((s) => s.setViewMode);
 const theme = useStore((s) => s.theme);
 const toggleTheme = useStore((s) => s.toggleTheme);
 const setExportOpen = useStore((s) => s.setExportOpen);
 const setImportOpen = useStore((s) => s.setImportOpen);
 const setFilterOpen = useStore((s) => s.setFilterOpen);
 const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
 const toggleSidebarCollapsed = useStore((s) => s.toggleSidebarCollapsed);
 const projects = useStore((s) => s.projects);
 const activeProjectId = useStore((s) => s.activeProjectId);
 const pages = useStore((s) => s.pages);
 const activePageId = useStore((s) => s.activePageId);
 const selectedCount = useStore((s) => s.selectedIds.size);
 const filter = useStore((s) => s.filter);
 const addProject = useStore((s) => s.addProject);
 const addPage = useStore((s) => s.addPage);
 const addTag = useStore((s) => s.addTag);
 const setActiveProject = useStore((s) => s.setActiveProject);
 const setActivePage = useStore((s) => s.setActivePage);
 
 const project = projects.find((p) => p.id === activeProjectId);
 const page = pages.find((p) => p.id === activePageId);

 // Pages of the active project, in board order — for the breadcrumb quick-jump.
 const projectPages = React.useMemo(
   () =>
     pages
       .filter((p) => p.projectId === activeProjectId)
       .sort((a, b) => a.order - b.order),
   [pages, activeProjectId],
 );
 
 const filterCount =
    (filter.tagIds?.length ?? 0) +
    (filter.verdicts?.length ?? 0) +
    (filter.minRating ? 1 : 0) +
    (filter.unrated ? 1 : 0) +
    (filter.hasAnnotations ? 1 : 0) +
    (filter.pageIds?.length ?? 0);
 
 const handleNewProject = async () => {
 const name = await uiPrompt({
      title: "New project",
      placeholder: "e.g. Mini app redesign",
      confirmLabel: "Create",
    });
 if (name?.trim()) await addProject(name.trim());
  };
 const handleNewPage = async () => {
 if (!activeProjectId) return;
 const name = await uiPrompt({
      title: "New page",
      placeholder: "e.g. Home, Cart, Checkout",
      confirmLabel: "Create",
    });
 if (name?.trim()) await addPage(activeProjectId, name.trim());
  };
 const handleNewTag = async () => {
 if (!activeProjectId) return;
 const name = await uiPrompt({
      title: "New tag",
      placeholder: "e.g. Client liked, Feasible",
      confirmLabel: "Create",
    });
 if (name?.trim()) await addTag(activeProjectId, name.trim());
  };

 const handleExportLibrary = async () => {
 const project = projects.find((p) => p.id === activeProjectId);
 const scope = project ? `Project: ${project.name}` : "Full library";
 const id = toast({
      title: project ? `Exporting ${project.name}…` : "Exporting library…",
      description: "Preparing archive…",
      sticky: true,
      progress: 0,
    });
 try {
 await exportArchive({
        projectId: activeProjectId ?? undefined,
        filename: project ? `${project.name}-pickframe` : "pickframe-library",
        onProgress: (msg, frac) =>
          updateToast(id, { description: msg, progress: frac }),
      });
      dismissToast(id);
      toast({
        title: "Library exported",
        description: scope,
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
  };
 
 return (
    <header className="h-12 shrink-0 flex items-center justify-between gap-2 px-2 sm:px-3 bg-[var(--bg)]">
      {/* Brand + breadcrumb (+ mobile hamburger) */}
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {/* Mobile-only hamburger. 36×36 hit zone — anything smaller is
            painful to tap with a thumb. */}
        <button
 onClick={onToggleMobileSidebar}
 className="md:hidden h-9 w-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
 aria-label="Open navigation"
        >
          <Menu size={17} />
        </button>
        {/* Desktop-only sidebar collapse toggle. Lives in the TopBar so
            even when the rail is fully closed there's still an obvious way
            to bring it back. */}
        <Tooltip
 content={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        >
          <button
 onClick={toggleSidebarCollapsed}
 className="hidden md:grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
 aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            <SidebarToggleIcon collapsed={sidebarCollapsed} />
          </button>
        </Tooltip>
        <button
 onClick={() => setActiveProject(null)}
 className="flex items-center gap-1.5 px-1.5 h-7 rounded-[var(--radius-sm)] hover:bg-[var(--bg-soft)]"
        >
          <Logo size={16} />
          <span className="font-semibold text-[13.5px] tracking-tight hidden xs:inline sm:inline">
            Pickframe
          </span>
        </button>
        {project && (
          <>
            <ChevronRight
 size={12}
 className="text-[var(--fg-subtle)] mx-0.5 hidden sm:block"
 aria-hidden
            />
            <BreadcrumbMenu
              ariaLabel="Switch project"
              wrapClassName="hidden sm:block"
              triggerClassName="flex items-center gap-1.5 px-1.5 h-7 rounded-[var(--radius-sm)] hover:bg-[var(--bg-soft)] text-[12.5px]"
              trigger={
                <>
                  {project.emoji && <span>{project.emoji}</span>}
                  <span className="font-medium truncate max-w-[140px]">
                    {project.name}
                  </span>
                </>
              }
            >
              {(close) =>
                projects.map((p) => (
                  <BreadcrumbItem
                    key={p.id}
                    active={p.id === activeProjectId}
                    icon={
                      p.emoji ? (
                        <span>{p.emoji}</span>
                      ) : (
                        <Layers size={12} className="text-[var(--fg-subtle)]" />
                      )
                    }
                    label={p.name}
                    onSelect={() => {
                      if (p.id === activeProjectId) {
                        setActivePage(null);
                      } else {
                        setActiveProject(p.id);
                      }
                      close();
                    }}
                  />
                ))
              }
            </BreadcrumbMenu>
          </>
        )}
        {page && (
          <>
            <ChevronRight
 size={12}
 className="text-[var(--fg-subtle)] mx-0.5 hidden md:block"
 aria-hidden
            />
            <BreadcrumbMenu
              ariaLabel="Switch page"
              wrapClassName="hidden md:block"
              triggerClassName="flex items-center px-1.5 h-7 rounded-[var(--radius-sm)] hover:bg-[var(--bg-soft)] text-[12.5px] text-[var(--fg-muted)] max-w-[220px]"
              trigger={
                <span className="truncate max-w-[200px]">
                  <PageLabel name={page.name} />
                </span>
              }
            >
              {(close) => (
                <>
                  <BreadcrumbItem
                    active={false}
                    icon={
                      <LayoutGrid size={12} className="text-[var(--fg-subtle)]" />
                    }
                    label="All pages"
                    onSelect={() => {
                      setActivePage(null);
                      close();
                    }}
                  />
                  {projectPages.length > 0 && (
                    <div className="my-1 h-px bg-[var(--border)]" />
                  )}
                  {projectPages.map((pg) => (
                    <BreadcrumbItem
                      key={pg.id}
                      active={pg.id === activePageId}
                      label={<PageLabel name={pg.name} />}
                      onSelect={() => {
                        setActivePage(pg.id);
                        close();
                      }}
                    />
                  ))}
                </>
              )}
            </BreadcrumbMenu>
          </>
        )}
      </div>
 
      {/* Center: search trigger */}
      <button
 onClick={() => setCommandOpen(true)}
 className={cn(
 "group items-center gap-2 h-8 px-2.5 hidden md:flex md:w-[300px] md:max-w-[36vw]",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-md)] text-[12.5px] text-[var(--fg-subtle)]",
 "hover:text-[var(--fg-muted)] focus-ring",
        )}
      >
        <Search size={13} className="shrink-0" />
        <input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 onClick={(e) => {
            e.stopPropagation();
 setCommandOpen(true);
          }}
 placeholder="Search pages, tags, notes…"
 className="flex-1 bg-transparent border-0 outline-none text-[var(--fg)] placeholder:text-[var(--fg-subtle)] min-w-0"
        />
        <Kbd>⌘K</Kbd>
      </button>
 
      {/* Mobile-only search button — 36×36 thumb target. */}
      <button
 onClick={() => setCommandOpen(true)}
 className="md:hidden h-9 w-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]"
 aria-label="Search"
      >
        <Search size={16} />
      </button>
 
      {/* Right: theme + view toggle + filter + export + new */}
      <div className="flex items-center gap-0.5 justify-end">
        <Tooltip
          content={theme === "dark" ? "Light theme" : "Dark theme"}
          shortcut="⇧T"
        >
          <BarIconButton onClick={toggleTheme} className="mr-1">
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          </BarIconButton>
        </Tooltip>

        <div className="hidden md:flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] p-0.5 mr-1">
          <Tooltip content="Board" shortcut="⌘1">
            <button
 onClick={() => setViewMode("board")}
 className={cn(
 "h-6 w-6 grid place-items-center rounded-[var(--radius-sm)] focus-ring",
                viewMode === "board"
 ? "bg-[var(--bg-soft)] text-[var(--fg)]"
 : "text-[var(--fg-subtle)] hover:text-[var(--fg)]",
              )}
            >
              <LayoutGrid size={13} />
            </button>
          </Tooltip>
          <Tooltip content="Compare" shortcut="⌘2">
            <button
 onClick={() => setViewMode("compare")}
 className={cn(
 "h-6 w-6 grid place-items-center rounded-[var(--radius-sm)] focus-ring",
                viewMode === "compare"
 ? "bg-[var(--bg-soft)] text-[var(--fg)]"
 : "text-[var(--fg-subtle)] hover:text-[var(--fg)]",
              )}
            >
              <Columns2 size={13} />
            </button>
          </Tooltip>
          <Tooltip content="Single" shortcut="⌘3">
            <button
 onClick={() => setViewMode("single")}
 className={cn(
 "h-6 w-6 grid place-items-center rounded-[var(--radius-sm)] focus-ring",
                viewMode === "single"
 ? "bg-[var(--bg-soft)] text-[var(--fg)]"
 : "text-[var(--fg-subtle)] hover:text-[var(--fg)]",
              )}
            >
              <ImageIcon size={13} />
            </button>
          </Tooltip>
          <Tooltip content="Flow" shortcut="⌘4">
            <button
 onClick={() => setViewMode("flow")}
 className={cn(
 "h-6 w-6 grid place-items-center rounded-[var(--radius-sm)] focus-ring",
                viewMode === "flow"
 ? "bg-[var(--bg-soft)] text-[var(--fg)]"
 : "text-[var(--fg-subtle)] hover:text-[var(--fg)]",
              )}
            >
              <Workflow size={13} />
            </button>
          </Tooltip>
        </div>
 
        <BarButton
 onClick={() => setFilterOpen(true)}
 active={filterCount > 0}
 className="hidden sm:inline-flex"
        >
          <Filter size={12} />
          Filter
          {filterCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[14px] h-[14px] text-[9.5px] font-mono rounded-[var(--radius-xs)] bg-[var(--brand)] text-[var(--brand-fg)] px-1 leading-none">
              {filterCount}
            </span>
          )}
        </BarButton>
 
        <BarButton
 onClick={() => setExportOpen(true)}
 active={selectedCount > 0}
 tone={selectedCount > 0 ? "brand" : undefined}
 className="hidden sm:inline-flex"
        >
          <Download size={12} />
          Export
          {selectedCount > 0 && (
            <span className="font-mono tabular-nums text-[11px] opacity-90">
              {selectedCount}
            </span>
          )}
        </BarButton>
 
        {/* Unified New menu — context-aware: project / page / tag */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
 className={cn(
 "inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-[var(--radius-sm)] focus-ring",
 "text-[12px] font-medium",
 "bg-[var(--brand)] text-[var(--brand-fg)] hover:opacity-95 data-[state=open]:opacity-95",
              )}
            >
              <span>New</span>
              <ChevronDown size={11} className="opacity-80" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
 align="end"
 sideOffset={6}
 // After menu closes, don't return keyboard focus to the trigger.
 // Otherwise :focus-visible stays active and the brand-coloured
 // outline lingers around the New button.
 onCloseAutoFocus={(e) => e.preventDefault()}
 className={cn(
 "z-[60] min-w-[200px] p-1",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-md)] shadow-[var(--shadow-pop)]",
 "data-[state=open]:animate-cm-in data-[state=closed]:animate-cm-out",
              )}
            >
              <NewItem
 icon={<Layers size={12} />}
 label="New project"
 hint="P"
 onSelect={handleNewProject}
              />
              <NewItem
 icon={<FolderPlus size={12} />}
 label="New page"
 disabled={!activeProjectId}
 hint={!activeProjectId ? "Pick a project first" : undefined}
 onSelect={handleNewPage}
              />
              <NewItem
 icon={<Hash size={12} />}
 label="New tag"
 disabled={!activeProjectId}
 hint={!activeProjectId ? "Pick a project first" : undefined}
 onSelect={handleNewTag}
              />
              <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
              <NewItem
 icon={<Upload size={12} />}
 label="Import library…"
 onSelect={() => setImportOpen(true)}
              />
              <NewItem
 icon={<PackageOpen size={12} />}
 label={
                  activeProjectId
 ? "Export this project…"
 : "Export full library…"
                }
 onSelect={handleExportLibrary}
              />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
 
// Breadcrumb quick-jump menu. Opens on hover. The trigger and the menu live in
// one `relative` hover container (the menu is a DOM descendant, positioned
// absolutely with no gap), so moving the pointer from the label into the menu
// never leaves the container — no dead zone, no open/close flicker. Click still
// toggles it for touch/keyboard.
function BreadcrumbMenu({
 ariaLabel,
 triggerClassName,
 wrapClassName,
 trigger,
 children,
}: {
 ariaLabel: string;
 triggerClassName?: string;
 wrapClassName?: string;
 trigger: React.ReactNode;
 children: (close: () => void) => React.ReactNode;
}) {
 const [open, setOpen] = React.useState(false);
 const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
 const cancel = () => {
 if (timer.current) {
 clearTimeout(timer.current);
 timer.current = null;
   }
  };
 const openNow = () => {
 cancel();
 setOpen(true);
  };
 const closeSoon = () => {
 cancel();
 timer.current = setTimeout(() => setOpen(false), 120);
  };
 React.useEffect(() => cancel, []);
 return (
    <div
 className={cn("relative", wrapClassName)}
 onPointerEnter={(e) => {
 if (e.pointerType !== "touch") openNow();
      }}
 onPointerLeave={(e) => {
 if (e.pointerType !== "touch") closeSoon();
      }}
    >
      <button
 type="button"
 aria-label={ariaLabel}
 aria-haspopup="menu"
 aria-expanded={open}
 className={cn(triggerClassName, open && "bg-[var(--bg-soft)]")}
 onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <div
 role="menu"
 className="absolute left-0 top-full pt-1 z-[60]"
        >
          <div className="min-w-[200px] max-h-[60vh] overflow-y-auto p-1 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-[var(--shadow-pop)] animate-cm-in">
            {children(() => setOpen(false))}
          </div>
        </div>
      )}
    </div>
  );
}

function BreadcrumbItem({
 active,
 icon,
 label,
 onSelect,
}: {
 active?: boolean;
 icon?: React.ReactNode;
 label: React.ReactNode;
 onSelect: () => void;
}) {
 return (
    <button
 type="button"
 role="menuitem"
 onClick={onSelect}
 className={cn(
 "w-full flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-[12.5px] text-left outline-none",
 "text-[var(--fg)] hover:bg-[var(--bg-soft)] focus-visible:bg-[var(--bg-soft)]",
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {active && (
        <Check size={12} className="text-[var(--fg-muted)] shrink-0" />
      )}
    </button>
  );
}

function NewItem({
 icon,
 label,
 hint,
 disabled,
 onSelect,
}: {
 icon: React.ReactNode;
 label: string;
 hint?: string;
 disabled?: boolean;
 onSelect: () => void;
}) {
 return (
    <DropdownMenu.Item
 disabled={disabled}
 onSelect={onSelect}
 className={cn(
 "flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)] text-[12.5px] cursor-default outline-none",
 "data-[highlighted]:bg-[var(--bg-soft)]",
 "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
      )}
    >
      <span className="text-[var(--fg-subtle)] shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && (
        <span className="text-[10.5px] text-[var(--fg-subtle)]">{hint}</span>
      )}
    </DropdownMenu.Item>
  );
}
 
function BarButton({
 children,
 onClick,
 active,
 tone,
 className,
}: {
 children: React.ReactNode;
 onClick: () => void;
 active?: boolean;
 tone?: "brand";
 className?: string;
}) {
 return (
    <button
 onClick={onClick}
 className={cn(
 "inline-flex items-center gap-1.5 h-7 px-2 rounded-[var(--radius-sm)] text-[12px] font-medium focus-ring",
 "transition-colors duration-100",
        tone === "brand"
 ? "bg-[var(--brand)] text-[var(--brand-fg)]"
 : active
 ? "bg-[var(--bg-soft)] text-[var(--fg)]"
 : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]",
        className,
      )}
    >
      {children}
    </button>
  );
}
 
function BarIconButton({
 children,
 onClick,
 className,
}: {
 children: React.ReactNode;
 onClick: () => void;
 className?: string;
}) {
 return (
    <button
 onClick={onClick}
 className={cn(
 "h-7 w-7 grid place-items-center rounded-[var(--radius-sm)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)] focus-ring",
        className,
      )}
    >
      {children}
    </button>
  );
}
