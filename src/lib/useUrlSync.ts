"use client";

import * as React from "react";
import { useStore } from "./store";
import { decodeUrl, encodeUrl, type UrlSnapshot } from "./urlState";

/** Pull the URL-reflected slice out of the full store state. */
function snapshot(s: ReturnType<typeof useStore.getState>): UrlSnapshot {
  return {
    viewMode: s.viewMode,
    activeProjectId: s.activeProjectId,
    activePageId: s.activePageId,
    focusedVersionId: s.focusedVersionId,
    compareIds: s.compareIds,
    search: s.search,
    filter: s.filter,
  };
}

/**
 * Two-way bind navigable UI state with the URL query string.
 *
 *  • On first load (once data is in memory) we hydrate the store from the URL,
 *    validating every id so a stale link can't strand the user.
 *  • Afterwards every relevant state change is written back with
 *    `history.replaceState` — coalesced into a single `requestAnimationFrame`
 *    so a burst of updates costs at most one DOM write per frame and never
 *    triggers a Next.js navigation/re-render.
 *  • Back/forward (`popstate`) re-hydrates from the URL.
 *
 * Net effect: a refresh (or shared link) lands exactly where the user was, at
 * zero render cost on the hot path.
 */
export function useUrlSync(): void {
  const loaded = useStore((s) => s.loaded);
  const hydratedRef = React.useRef(false);

  // 1) URL → store, once, after data has loaded.
  React.useEffect(() => {
    if (!loaded || hydratedRef.current) return;
    useStore.getState().applyUrlState(decodeUrl(window.location.search));
    hydratedRef.current = true;
  }, [loaded]);

  // 2) store → URL (replaceState), coalesced per frame.
  React.useEffect(() => {
    let last = window.location.search.replace(/^\?/, "");
    let raf = 0;

    const write = () => {
      raf = 0;
      // Never clobber the incoming link before we've hydrated from it.
      if (!hydratedRef.current) return;
      const next = encodeUrl(snapshot(useStore.getState()));
      if (next === last) return;
      last = next;
      const { pathname, hash } = window.location;
      const url = next ? `${pathname}?${next}${hash}` : `${pathname}${hash}`;
      window.history.replaceState(window.history.state, "", url);
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(write);
    };

    const unsub = useStore.subscribe(schedule);
    return () => {
      unsub();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  // 3) Back/forward → store.
  React.useEffect(() => {
    const onPop = () => {
      useStore.getState().applyUrlState(decodeUrl(window.location.search));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
}
