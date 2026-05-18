import * as React from "react";

/**
 * Splash logo — Pickframe capsule with a gentle, in-place "breathing"
 * animation. Pure CSS keyframes (no framer-motion) so the splash, which
 * the user only sees while the workspace is still hydrating, doesn't
 * itself depend on a heavy animation runtime — saves a few kilobytes
 * on the critical path and one fewer subscription before paint.
 *
 * Animation: the lockup scales 1 → 1.04 → 1 once every 1.6 s while the
 * two rectangles fade between two opacity stops, offset slightly so the
 * pair feels alive rather than synchronous.
 */
export function SplashLogo({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="pf-splash"
    >
      <rect
        x="5"
        y="4"
        width="14"
        height="20"
        rx="4"
        fill="#6366F1"
        className="pf-splash-back"
      />
      <rect
        x="11"
        y="8"
        width="16"
        height="20"
        rx="4"
        fill="#6366F1"
        className="pf-splash-front"
      />
    </svg>
  );
}
