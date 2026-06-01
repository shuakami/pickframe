"use client";
 
import * as React from "react";
import { useStore } from "@/lib/store";
import { Thumb } from "../primitives/Thumb";
import { Button } from "../primitives/Button";
import { ChevronDown, X, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERDICT_COLOR, VERDICT_LABEL } from "@/lib/types";
 
export function CompareView() {
 const compareIds = useStore((s) => s.compareIds);
 const versions = useStore((s) => s.versions);
 const activeProjectId = useStore((s) => s.activeProjectId);
 const setVerdict = useStore((s) => s.setVerdict);
 const toggleCompare = useStore((s) => s.toggleCompare);
 const setFocused = useStore((s) => s.setFocused);
 const setViewMode = useStore((s) => s.setViewMode);
 
 const [pickerOpen, setPickerOpen] = React.useState(false);
 
 const compareVersions = React.useMemo(
    () => compareIds.map((id) => versions.find((v) => v.id === id)).filter(Boolean) as typeof versions,
    [compareIds, versions],
  );
 
 const candidates = React.useMemo(
    () =>
      versions
        .filter((v) => v.projectId === activeProjectId)
        .filter((v) => !compareIds.includes(v.id))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [versions, activeProjectId, compareIds],
  );
 
 if (compareVersions.length === 0) {
 return (
      <div className="absolute inset-0 grid place-items-center px-6 text-center">
        <div className="max-w-[400px]">
          <h2 className="text-[18px] font-semibold tracking-tight">
            Pick 2 or more to compare
          </h2>
          <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
            Shift- or ⌘-click cards on the board, then hit&nbsp;
            <b>Compare</b> — or use <b>Compare all</b> on a page header to
            line up every version. Add more from the menu below.
          </p>
          <div className="mt-4 flex justify-center">
            <PickerButton
 candidates={candidates.map((v) => ({
                id: v.id,
                label: v.label,
                blobId: v.thumbBlobId ?? v.blobId,
              }))}
 onPick={(id) => toggleCompare(id)}
 onOpenChange={setPickerOpen}
 open={pickerOpen}
            />
          </div>
        </div>
      </div>
    );
  }
 
 return (
    <div className="absolute inset-0 flex flex-col bg-[var(--bg-soft)]">
      <div className="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-[var(--border)] bg-[var(--bg)]">
        <Button
 size="sm"
 variant="ghost"
 onClick={() => setViewMode("board")}
        >
          Back
        </Button>
        <span className="text-[12.5px] text-[var(--fg-muted)]">
          Compare · {compareVersions.length}
        </span>
        <span className="ml-auto" />
        <PickerButton
 candidates={candidates.map((v) => ({
            id: v.id,
            label: v.label,
            blobId: v.thumbBlobId ?? v.blobId,
          }))}
 onPick={(id) => toggleCompare(id)}
 onOpenChange={setPickerOpen}
 open={pickerOpen}
        />
      </div>
      {/* One scrollable row of panels so any number of versions lay out side
          by side — 2 fill the width, many overflow into a horizontal scroll
          (each panel keeps a comfortable min width). */}
      <div className="flex-1 min-h-0 flex gap-3 p-3 sm:p-4 overflow-x-auto overflow-y-hidden">
        {compareVersions.map((v) => (
          <div
 key={v.id}
 className="relative flex flex-col h-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden"
 style={{
 flex: "1 1 0",
 minWidth: "min(85vw, 320px)",
 maxWidth: "640px",
            }}
          >
            <div className="flex items-center gap-2 px-3 h-10 border-b border-[var(--border)]">
              <span className="text-[13px] font-medium truncate">
                {v.label}
              </span>
              {v.verdict !== "unset" && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--fg-muted)]">
                  <span
 className="dot"
 style={{ background: VERDICT_COLOR[v.verdict] }}
                  />
                  {VERDICT_LABEL[v.verdict]}
                </span>
              )}
              <span className="ml-auto" />
              <Button
 size="sm"
 variant="ghost"
 onClick={() => setVerdict(v.id, "winner")}
              >
                <Crown size={11} />
                Pick this
              </Button>
              <Button
 size="icon-sm"
 variant="ghost"
 onClick={() => {
 setFocused(v.id);
 setViewMode("single");
                }}
              >
                <span className="text-[10px]">Open</span>
              </Button>
              <Button
 size="icon-sm"
 variant="ghost"
 onClick={() => toggleCompare(v.id)}
              >
                <X size={12} />
              </Button>
            </div>
            <div className="relative flex-1 min-h-0 checkered">
              <Thumb
 blobId={v.blobId}
 fit="contain"
 className="absolute inset-0"
 imageWidth={v.width}
 imageHeight={v.height}
 annotations={v.annotations}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
 
function PickerButton({
 candidates,
 onPick,
 open,
 onOpenChange,
 disabled,
}: {
 candidates: { id: string; label: string; blobId: string }[];
 onPick: (id: string) => void;
 open: boolean;
 onOpenChange: (b: boolean) => void;
 disabled?: boolean;
}) {
 return (
    <div className="relative">
      <Button
 size="sm"
 variant="outline"
 onClick={() => onOpenChange(!open)}
 disabled={disabled}
      >
        Add version
        <ChevronDown size={12} />
      </Button>
      {open && (
        <>
          <div
 className="fixed inset-0 z-30"
 onClick={() => onOpenChange(false)}
          />
          <div
 className={cn(
 "absolute right-0 top-9 z-40 w-[260px] max-h-[320px] overflow-y-auto",
 "bg-[var(--surface)] border border-[var(--border)]",
 "rounded-[var(--radius-md)] shadow-[var(--shadow-modal)] pop-in py-1.5",
            )}
          >
            {candidates.length === 0 && (
              <div className="px-3 py-3 text-[12px] text-[var(--fg-subtle)]">
                Nothing left to add
              </div>
            )}
            {candidates.map((c) => (
              <button
 key={c.id}
 onClick={() => {
 onPick(c.id);
 onOpenChange(false);
                }}
 className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--bg-soft)]"
              >
                <Thumb
 blobId={c.blobId}
 className="w-7 h-9 rounded-[4px] shrink-0"
                />
                <span className="text-[12.5px]">{c.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
