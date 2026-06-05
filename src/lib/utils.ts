import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
 return twMerge(clsx(inputs));
}

/**
 * Subscribes to a CSS media query. SSR-safe — returns `false` on first render
 * server-side so layout doesn't flash. Hydrates to the real value immediately.
 */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = React.useState(false);
  React.useEffect(() => {
    const m = window.matchMedia(query);
    const update = () => setMatch(m.matches);
    update();
    if (m.addEventListener) m.addEventListener("change", update);
    else m.addListener(update);
    return () => {
      if (m.removeEventListener) m.removeEventListener("change", update);
      else m.removeListener(update);
    };
  }, [query]);
  return match;
}

/**
 * "Mobile" UX = narrow viewport OR coarse pointer (touch). Below the `lg`
 * Tailwind breakpoint we drop into mobile-first interaction patterns:
 *  - tap = navigate (open Single view) instead of "select + pop a sidebar"
 *  - selection toggles always visible, not hover-only
 *  - heavy floating panels become full-width / scrollable
 */
function useIsMobileMedia(): boolean {
  const narrow = useMediaQuery("(max-width: 1023.5px)");
  const coarse = useMediaQuery("(pointer: coarse)");
  return narrow || coarse;
}

// Single source of truth for the "is mobile" flag. Without this, every
// component that wanted it (and every VersionCard on the board) spun up its
// own pair of `matchMedia` listeners and re-rendered independently on resize.
// Computing it once at the app root and fanning it out via context collapses
// hundreds of listeners into two and lets React batch the updates.
const MobileContext = React.createContext<boolean | null>(null);

export function MobileProvider({ children }: { children: React.ReactNode }) {
  const value = useIsMobileMedia();
  return React.createElement(MobileContext.Provider, { value }, children);
}

export function useIsMobile(): boolean {
  const ctx = React.useContext(MobileContext);
  // Falls back to `false` outside a provider — every real consumer renders
  // under <MobileProvider> in the AppShell, so this only affects detached
  // test/SSR renders, where "not mobile" is the safe default.
  return ctx ?? false;
}
 
export function formatRelative(ts: number): string {
 const diff = Date.now() - ts;
 const m = 60_000;
 const h = m * 60;
 const d = h * 24;
 if (diff < m) return "just now";
 if (diff < h) return `${Math.floor(diff / m)}m ago`;
 if (diff < d) return `${Math.floor(diff / h)}h ago`;
 if (diff < d * 30) return `${Math.floor(diff / d)}d ago`;
 return new Date(ts).toLocaleDateString();
}
 
export function clamp(n: number, lo: number, hi: number) {
 return Math.max(lo, Math.min(hi, n));
}
 
export function pluralize(n: number, one: string, many?: string) {
 return `${n} ${n === 1 ? one : many ?? one}`;
}
 
export const STROKE_COLORS = [
 "#15110a",
 "#5b5bd6",
 "#d4361e",
 "#1d8a4a",
 "#d4a017",
 "#b042c7",
];
 
export const TAG_COLORS = [
 "#5b5bd6",
 "#0ea5e9",
 "#14b8a6",
 "#22c55e",
 "#eab308",
 "#f97316",
 "#ef4444",
 "#ec4899",
 "#a855f7",
 "#6b7280",
];
 
export function pickTagColor(seed: number) {
 return TAG_COLORS[seed % TAG_COLORS.length];
}
