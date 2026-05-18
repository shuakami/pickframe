"use client";
 
import * as React from "react";
import { cn } from "@/lib/utils";
import { ImagePlus } from "lucide-react";
 
interface Props {
 onDrop: (files: File[]) => void | Promise<void>;
 className?: string;
 hint?: string;
}
 
export function DropZone({ onDrop, className, hint }: Props) {
 const [over, setOver] = React.useState(false);
 const inputRef = React.useRef<HTMLInputElement>(null);
 
 return (
    <div
 onDragOver={(e) => {
        e.preventDefault();
 setOver(true);
      }}
 onDragLeave={() => setOver(false)}
 onDrop={(e) => {
        e.preventDefault();
 setOver(false);
 const files = Array.from(e.dataTransfer.files).filter((f) =>
          f.type.startsWith("image/"),
        );
 if (files.length) void onDrop(files);
      }}
 onClick={() => inputRef.current?.click()}
 className={cn(
 "flex flex-col items-center justify-center cursor-pointer select-none",
 "rounded-[var(--radius-lg)] border border-dashed",
        over
 ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
 : "border-[var(--border)] text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] hover:border-[var(--brand)]",
 "transition-all duration-150 text-[12px] gap-2 py-8",
        className,
      )}
    >
      <ImagePlus size={18} />
      <span>{hint ?? "Drop or click to upload"}</span>
      <input
 ref={inputRef}
 type="file"
 multiple
 accept="image/*"
 className="visually-hidden"
 onChange={(e) => {
 const files = Array.from(e.target.files ?? []);
 if (files.length) void onDrop(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
