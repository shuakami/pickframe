"use client";
 
import * as React from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Kbd } from "../primitives/Kbd";
 
const KEY = "pickframe-onboard-dismissed";
 
function subscribeToStorage(cb: () => void) {
  window.addEventListener("storage", cb);
 return () => window.removeEventListener("storage", cb);
}
 
export function OnboardingHint() {
 const versions = useStore((s) => s.versions);
 const projects = useStore((s) => s.projects);
 // useSyncExternalStore: read from localStorage with stable subscribe.
 const dismissed = React.useSyncExternalStore(
    subscribeToStorage,
    () => {
 try {
 return localStorage.getItem(KEY) === "1";
      } catch {
 return false;
      }
    },
    () => true,
  );
 
 if (dismissed) return null;
 if (projects.length === 0 || versions.length === 0) return null;
 
 return (
    <div
 className={cn(
 "fixed bottom-4 left-1/2 -translate-x-1/2 z-30",
 "max-w-[520px] px-4 py-2.5 flex items-center gap-3",
 "bg-[var(--fg)] text-[var(--bg)] rounded-[var(--radius-pill)]",
 "shadow-[var(--shadow-3)] rise-in",
      )}
    >
      <span className="text-[12.5px]">
        欢迎 — 试试这些：双击卡片进入标注，按 <Kbd>⌘K</Kbd> 召唤命令面板，按 <Kbd>⌘E</Kbd> 导出。
      </span>
      <button
 onClick={() => {
 try {
            localStorage.setItem(KEY, "1");
            window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
          } catch {}
        }}
 className="h-6 w-6 grid place-items-center rounded-full hover:bg-white/10"
      >
        <X size={12} />
      </button>
    </div>
  );
}
