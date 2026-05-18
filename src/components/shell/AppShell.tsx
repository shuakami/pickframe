"use client";
 
import * as React from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { seedDemoData } from "@/lib/seed";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { SplashLogo } from "../primitives/SplashLogo";
import { Inspector } from "./Inspector";
import { TooltipProvider } from "../primitives/Tooltip";
import { FilterDrawer } from "./FilterDrawer";
import { DialogHost } from "../primitives/DialogHost";
import { ToastHost } from "../primitives/ToastHost";
import { QuickLook } from "./QuickLook";

// Lazy-load the occasional dialogs. None of them are visible on first
// paint — the command palette only opens via ⌘K, export/import are
// user-initiated — so their JSX + the heavy libs they pull in
// (cmdk, jspdf, jszip, file-saver…) stay out of the initial bundle.
// All three are client-only and need no SSR placeholder.
const CommandPalette = dynamic(
  () => import("../command/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);
const ExportDialog = dynamic(
  () => import("../export/ExportDialog").then((m) => m.ExportDialog),
  { ssr: false },
);
const ImportDialog = dynamic(
  () => import("../import/ImportDialog").then((m) => m.ImportDialog),
  { ssr: false },
);
 
export function AppShell() {
 const loaded = useStore((s) => s.loaded);

 // Splash visibility — debounced so it never flickers.
 //
 // Two thresholds:
 //   • If load finishes within `SPLASH_DELAY_MS` of mount → splash is
 //     never shown. The user sees workspace immediately.
 //   • Otherwise the splash is shown until at least `SPLASH_MIN_MS` after
 //     it became visible, even if `loaded` flipped earlier. Prevents the
 //     "logo blinks for 80 ms" effect entirely.
 const SPLASH_DELAY_MS = 200;
 const SPLASH_MIN_MS = 500;
 const [showSplash, setShowSplash] = React.useState(false);
 const splashShownAtRef = React.useRef<number | null>(null);
 React.useEffect(() => {
 if (loaded) return;
 // Schedule the splash to appear only if loading hasn't finished by
 // SPLASH_DELAY_MS. If `loaded` flips true before then, we never call
 // setShowSplash(true) and the user sees a clean direct transition.
 const t = window.setTimeout(() => {
 setShowSplash(true);
 splashShownAtRef.current = performance.now();
    }, SPLASH_DELAY_MS);
 return () => window.clearTimeout(t);
 }, [loaded]);
 React.useEffect(() => {
 if (!loaded) return;
 if (!showSplash) return;
 // Splash is visible — hold it for at least SPLASH_MIN_MS from when it
 // first appeared, so a fast 50 ms post-splash load doesn't yank it.
 const shownAt = splashShownAtRef.current ?? performance.now();
 const elapsed = performance.now() - shownAt;
 const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
 const t = window.setTimeout(() => setShowSplash(false), remaining);
 return () => window.clearTimeout(t);
 }, [loaded, showSplash]);
 const loadAll = useStore((s) => s.loadAll);
 const setTheme = useStore((s) => s.setTheme);
 const setCommandOpen = useStore((s) => s.setCommandOpen);
 const setViewMode = useStore((s) => s.setViewMode);
 const toggleTheme = useStore((s) => s.toggleTheme);
 const setExportOpen = useStore((s) => s.setExportOpen);
 const focused = useStore((s) => s.focusedVersionId);
 const setFocused = useStore((s) => s.setFocused);
 const viewMode = useStore((s) => s.viewMode);
 const compareIds = useStore((s) => s.compareIds);
 
 // Bootstrap: theme + seed + load
  React.useEffect(() => {
 let cancelled = false;
    (async () => {
 try {
 const stored = localStorage.getItem("pickframe-theme") as
 | "light"
 | "dark"
 | null;
 if (stored) setTheme(stored);
 else if (window.matchMedia("(prefers-color-scheme: dark)").matches)
 setTheme("dark");
 else setTheme("light");
      } catch {}
 try {
 await seedDemoData();
      } catch (e) {
        console.warn("seed skipped", e);
      }
 if (cancelled) return;
 await loadAll();
    })();
 return () => {
      cancelled = true;
    };
  }, [loadAll, setTheme]);
 
 // Global keyboard shortcuts
  React.useEffect(() => {
 function onKey(e: KeyboardEvent) {
 const target = e.target as HTMLElement | null;
 const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
 if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
 setCommandOpen(true);
 return;
      }
 if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
 setExportOpen(true);
 return;
      }
 if (inField) return;
 if (e.key === "1" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
 setViewMode("board");
      } else if (e.key === "2" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
 setViewMode("compare");
      } else if (e.key === "3" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
 setViewMode("single");
      } else if (e.key === "4" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
 setViewMode("flow");
      } else if (e.key === "Escape") {
 if (viewMode === "single") {
 setViewMode("board");
        } else if (focused) {
 setFocused(null);
        }
      } else if (e.key === "T" && e.shiftKey) {
        e.preventDefault();
 toggleTheme();
      }
    }
    window.addEventListener("keydown", onKey);
 return () => window.removeEventListener("keydown", onKey);
  }, [
    focused,
    setCommandOpen,
    setExportOpen,
    setFocused,
    setViewMode,
    toggleTheme,
    viewMode,
  ]);
 
 // Single view = focus mode. We collapse the sidebar *for* the user when
 // they enter Single (the artwork wants the whole width) and re-open it
 // when they leave — but only if it was open before. If the user had
 // manually collapsed the rail beforehand, we don't undo their choice on
 // back.  TopBar toggle still works inside Single so they can pop the rail
 // out and pick another page without leaving the editor.
 const focusMode = viewMode === "single";
 const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
 const setSidebarCollapsed = useStore((s) => s.setSidebarCollapsed);
 const [prevFocusMode, setPrevFocusMode] = React.useState(focusMode);
 // Snapshot of the rail state captured the last time we entered Single,
 // so we can restore it on exit. State (not ref) so the linter is happy
 // — we adjust both during the same focus-mode-change render.
 const [wasCollapsedBeforeSingle, setWasCollapsedBeforeSingle] =
 React.useState<boolean | null>(null);
 if (prevFocusMode !== focusMode) {
 setPrevFocusMode(focusMode);
 if (focusMode) {
 setWasCollapsedBeforeSingle(sidebarCollapsed);
 if (!sidebarCollapsed) setSidebarCollapsed(true);
 } else {
 // Leaving Single — restore the rail if it was open before entry.
 if (wasCollapsedBeforeSingle === false && sidebarCollapsed) {
 setSidebarCollapsed(false);
 }
 setWasCollapsedBeforeSingle(null);
    }
 }
 // Inspector is only useful on the Board (where you can hover/select cards).
 // In Compare/Flow it just floats over the canvas as a blank-looking panel,
 // so suppress it there.
 const showInspector =
    viewMode === "board" && (!!focused || compareIds.length > 0);
 
 // Hold the last shown id across the exit animation, so the panel keeps
 // displaying real content while it slides out instead of going blank.
 // (Pattern: "adjusting state to props during render".)
 const [stickyFocused, setStickyFocused] = React.useState<string | null>(
    focused,
  );
 if (focused && focused !== stickyFocused) {
 setStickyFocused(focused);
  }
 
 // Mobile sidebar drawer
 const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  React.useEffect(() => {
 if (mobileNavOpen) {
 const onKey = (e: KeyboardEvent) => {
 if (e.key === "Escape") setMobileNavOpen(false);
      };
      window.addEventListener("keydown", onKey);
 return () => window.removeEventListener("keydown", onKey);
    }
  }, [mobileNavOpen]);
 const ease = [0.2, 0.7, 0.2, 1] as const;
 
 return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-[var(--bg)] text-[var(--fg)]">
        <TopBar onToggleMobileSidebar={() => setMobileNavOpen(true)} />
        <div className="flex flex-1 min-h-0 relative">
          {/* Desktop sidebar — animated collapse. We animate the wrapper
              width (not the Sidebar's intrinsic 220 px) so contents stay
              laid out and just slide off-screen as the rail shrinks. */}
          <motion.div
            className="hidden md:block shrink-0 overflow-hidden"
            animate={{ width: sidebarCollapsed ? 0 : 220 }}
            initial={false}
            transition={{ duration: 0.22, ease }}
          >
            <div style={{ width: 220 }} className="h-full">
              <Sidebar />
            </div>
          </motion.div>
 
          {/* Mobile sidebar drawer */}
          <AnimatePresence>
            {mobileNavOpen && (
              <>
                <motion.div
 key="overlay"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.14, ease }}
 className="md:hidden fixed inset-0 z-40 backdrop-blur-[1px]"
 style={{ background: "var(--scrim-light)" }}
 onClick={() => setMobileNavOpen(false)}
                />
                <motion.div
 key="drawer"
 initial={{ x: -240, opacity: 0.85 }}
 animate={{ x: 0, opacity: 1 }}
 exit={{ x: -240, opacity: 0.5 }}
 transition={{ duration: 0.2, ease }}
 className="md:hidden fixed top-0 left-0 bottom-0 z-50 shadow-[var(--shadow-modal)]"
                >
                  <Sidebar onCloseMobile={() => setMobileNavOpen(false)} />
                </motion.div>
              </>
            )}
          </AnimatePresence>
 
          <main className="flex-1 min-w-0 min-h-0 relative">
            {/* Splash → workspace cross-fade. No position-based transition;
                just opacity. Splash itself shows a quietly-breathing logo
                instead of the old 'Loading…' text. */}
            <AnimatePresence mode="wait">
              {showSplash ? (
                <motion.div
                  key="splash"
                  className="absolute inset-0 grid place-items-center bg-[var(--bg)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease }}
                >
                  <SplashLogo size={56} />
                </motion.div>
              ) : loaded ? (
                <motion.div
                  key="workspace"
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.32, ease }}
                >
                  <Workspace />
                </motion.div>
              ) : null}
            </AnimatePresence>
            {/* Inspector floats over the right edge of the workspace —
                NOT pushing the board layout. This keeps card positions
                stable so a double-click never loses its target.

                Desktop-only (lg+). On mobile/tablet a card tap navigates
                straight into Single view (which has its own Inspector
                panel), so popping a bottom-sheet here on top of the
                floating selection bar produced a chaotic double-modal. */}
            <AnimatePresence
 onExitComplete={() => {
 if (!showInspector) setStickyFocused(null);
              }}
            >
              {showInspector && (
                <motion.div
                  key="inspector-desktop"
                  initial={{ x: 24, opacity: 0, scale: 0.985 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  exit={{ x: 24, opacity: 0, scale: 0.985 }}
                  transition={{ duration: 0.22, ease }}
                  className="hidden lg:block absolute top-2 right-2 bottom-2 z-30 w-[300px] rounded-[var(--radius-lg)] bg-[var(--bg)] shadow-[var(--shadow-modal)] overflow-hidden"
                >
                  <Inspector versionId={stickyFocused} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
        <CommandPalette />
        <ExportDialog />
        <ImportDialog />
        <FilterDrawer />
        <DialogHost />
        <QuickLook />
        <ToastHost />
      </div>
    </TooltipProvider>
  );
}
