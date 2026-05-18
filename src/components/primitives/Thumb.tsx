"use client";
 
import * as React from "react";
import { getBlobUrl } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { Annotations } from "@/lib/types";
import { AnnotationOverlay } from "../annotation/AnnotationOverlay";
 
interface ThumbProps extends React.HTMLAttributes<HTMLDivElement> {
 blobId?: string;
 alt?: string;
 fit?: "cover" | "contain";
 width?: number;
 height?: number;
 rounded?: string;
 /** Image-space dimensions of the source. Required for annotation overlay. */
 imageWidth?: number;
 imageHeight?: number;
 /** Optional annotations to render on top of the image. */
 annotations?: Annotations;
}
 
export function Thumb({
 blobId,
 alt,
 fit = "cover",
 className,
 rounded,
 imageWidth,
 imageHeight,
 annotations,
 ...rest
}: ThumbProps) {
 // Track resolved src per blobId so we never synchronously setState inside an effect body.
 const [resolved, setResolved] = React.useState<{
 blobId: string | undefined;
 src: string | null;
  }>({ blobId: undefined, src: null });
 
  React.useEffect(() => {
 if (!blobId) return;
 let cancelled = false;
 getBlobUrl(blobId).then((u) => {
 if (!cancelled && u) setResolved({ blobId, src: u });
    });
 return () => {
      cancelled = true;
    };
  }, [blobId]);
 
 const src = resolved.blobId === blobId ? resolved.src : null;
 
 return (
    <div
 className={cn(
 "relative overflow-hidden bg-[var(--bg-soft)]",
        className,
      )}
 style={rounded ? { borderRadius: rounded } : undefined}
      {...rest}
    >
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
 src={src}
 alt={alt ?? ""}
 className={cn(
 "w-full h-full select-none",
              fit === "cover" ? "object-cover" : "object-contain",
            )}
 draggable={false}
          />
          {annotations && imageWidth && imageHeight && (
            <AnnotationOverlay
 width={imageWidth}
 height={imageHeight}
 annotations={annotations}
 showNotes
 fit={fit}
            />
          )}
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[var(--fg-subtle)] text-[10px]">
          loading
        </div>
      )}
    </div>
  );
}
