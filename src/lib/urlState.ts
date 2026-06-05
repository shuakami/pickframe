"use client";

import type { FilterQuery, Verdict } from "./types";
import type { ViewMode } from "./store";

/**
 * URL ⇆ store serialization.
 *
 * Every navigable piece of UI state lives in the query string so a refresh
 * (or a shared link) lands exactly where the user was — same view, project,
 * page, focused version, compare set, filters and search. We deliberately
 * keep this in the query string (not the path) and write it with
 * `history.replaceState`, so updates never trigger a Next.js navigation /
 * re-render — the sync is effectively free on the main thread.
 *
 * Keys are short on purpose to keep links compact:
 *   view   board|compare|single|flow   (omitted when "board")
 *   p      active project id
 *   pg     active page id (sidebar page pin)
 *   f      focused version id (Single view / Inspector)
 *   c      compare set (comma-joined version ids)
 *   q      search text
 *   v      verdict filter (comma-joined)
 *   t      tag filter (comma-joined tag ids)
 *   fp     filter page ids (comma-joined)
 *   r      minRating
 *   u      unrated = 1
 *   a      hasAnnotations = 1
 *   ps     pageSort (least-versions|most-versions; manual omitted)
 */

const VIEW_MODES: readonly ViewMode[] = ["board", "compare", "single", "flow"];
const VERDICTS_SET: ReadonlySet<string> = new Set<Verdict>([
  "unset",
  "winner",
  "picked",
  "partial",
  "rejected",
]);
const PAGE_SORTS: ReadonlySet<string> = new Set([
  "least-versions",
  "most-versions",
]);

export interface UrlState {
  viewMode: ViewMode;
  activeProjectId: string | null;
  activePageId: string | null;
  focusedVersionId: string | null;
  compareIds: string[];
  search: string;
  filter: FilterQuery;
}

/** The slice of the store that is reflected into the URL. */
export interface UrlSnapshot {
  viewMode: ViewMode;
  activeProjectId: string | null;
  activePageId: string | null;
  focusedVersionId: string | null;
  compareIds: string[];
  search: string;
  filter: FilterQuery;
}

function splitList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build the query string (without leading "?") for a snapshot. Returns "" when
 * everything is at its default so the bare URL stays clean.
 */
export function encodeUrl(s: UrlSnapshot): string {
  const p = new URLSearchParams();

  if (s.viewMode && s.viewMode !== "board") p.set("view", s.viewMode);
  if (s.activeProjectId) p.set("p", s.activeProjectId);
  if (s.activePageId) p.set("pg", s.activePageId);
  if (s.focusedVersionId) p.set("f", s.focusedVersionId);
  if (s.compareIds.length) p.set("c", s.compareIds.join(","));
  if (s.search.trim()) p.set("q", s.search.trim());

  const f = s.filter;
  if (f.verdicts?.length) p.set("v", f.verdicts.join(","));
  if (f.tagIds?.length) p.set("t", f.tagIds.join(","));
  if (f.pageIds?.length) p.set("fp", f.pageIds.join(","));
  if (f.minRating != null) p.set("r", String(f.minRating));
  if (f.unrated) p.set("u", "1");
  if (f.hasAnnotations) p.set("a", "1");
  if (f.pageSort && f.pageSort !== "manual") p.set("ps", f.pageSort);

  return p.toString();
}

/** Parse a query string into a partial UrlState. Unknown / malformed values are dropped. */
export function decodeUrl(search: string): Partial<UrlState> {
  const p = new URLSearchParams(search);
  const out: Partial<UrlState> = {};

  const view = p.get("view");
  if (view && VIEW_MODES.includes(view as ViewMode)) {
    out.viewMode = view as ViewMode;
  }

  const project = p.get("p");
  if (project) out.activeProjectId = project;

  const page = p.get("pg");
  if (page) out.activePageId = page;

  const focus = p.get("f");
  if (focus) out.focusedVersionId = focus;

  const compare = splitList(p.get("c"));
  if (compare.length) out.compareIds = compare;

  const q = p.get("q");
  if (q) out.search = q;

  const filter: FilterQuery = {};
  const verdicts = splitList(p.get("v")).filter((x) =>
    VERDICTS_SET.has(x),
  ) as Verdict[];
  if (verdicts.length) filter.verdicts = verdicts;

  const tagIds = splitList(p.get("t"));
  if (tagIds.length) filter.tagIds = tagIds;

  const fp = splitList(p.get("fp"));
  if (fp.length) filter.pageIds = fp;

  const r = p.get("r");
  if (r != null) {
    const n = Number(r);
    if (Number.isFinite(n) && n > 0) filter.minRating = n;
  }
  if (p.get("u") === "1") filter.unrated = true;
  if (p.get("a") === "1") filter.hasAnnotations = true;

  const ps = p.get("ps");
  if (ps && PAGE_SORTS.has(ps)) {
    filter.pageSort = ps as FilterQuery["pageSort"];
  }

  if (Object.keys(filter).length) out.filter = filter;

  return out;
}
