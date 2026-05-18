import * as React from "react";

/**
 * Pickframe wordmark — the capsule lockup: a low-opacity back card with a
 * slightly larger solid front card. Indigo-500 (#6366F1) anchors the
 * brand and reads cleanly on light + dark surfaces alike.
 *
 * The colour is fixed (not theme-bound) so the logo keeps a stable identity
 * across the light paper and the warm-dark surfaces.
 */
export function Logo({
  size = 18,
  title,
}: {
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <rect
        x="5"
        y="4"
        width="14"
        height="20"
        rx="4"
        fill="#6366F1"
        opacity="0.22"
      />
      <rect x="11" y="8" width="16" height="20" rx="4" fill="#6366F1" />
    </svg>
  );
}
