/* ============================================================
 * Pickframe — Domain types
 * ============================================================ */
 
export type Verdict = "unset" | "winner" | "picked" | "partial" | "rejected";
 
export const VERDICTS: Verdict[] = [
 "unset",
 "winner",
 "picked",
 "partial",
 "rejected",
];
 
export const VERDICT_LABEL: Record<Verdict, string> = {
  unset: "Unset",
  winner: "Winner",
  picked: "Picked",
  partial: "Partial",
  rejected: "Rejected",
};
 
/* Single accent. Winner = gold (the only true positive signal).
 * Everything else is neutral fg-muted; verdict identity comes from the LABEL,
 * not from a separate color per state. */
export const VERDICT_COLOR: Record<Verdict, string> = {
  unset: "var(--fg-subtle)",
  winner: "var(--winner)",
  picked: "var(--fg-muted)",
  partial: "var(--fg-muted)",
  rejected: "var(--fg-subtle)",
};
 
export interface Project {
 id: string;
 name: string;
 emoji?: string;
 createdAt: number;
 updatedAt: number;
 /**
  * Optional whiteboard layer for the Flow view. Strokes/shapes/notes are
  * stored in *world* coordinates (the same space frames are laid out in)
  * so they stay anchored as the user pans / zooms.
  */
 flowAnnotations?: Annotations;
}
 
export interface Page {
 id: string;
 projectId: string;
 name: string;
 order: number;
 createdAt: number;
}
 
export interface Tag {
 id: string;
 projectId: string;
 name: string;
 color: string; // hex
}
 
export interface Stroke {
 id: string;
 tool: "pen" | "marker" | "highlight";
 color: string;
 size: number; // brush thickness
 points: number[]; // flattened [x,y,p, x,y,p,...] (p=pressure 0..1)
}
 
export interface Shape {
 id: string;
 kind: "rect" | "arrow";
 color: string;
 /** rect: [x,y,w,h]; arrow: [x1,y1,x2,y2] (image-space coords) */
 geom: number[];
 size: number;
 label?: string;
}
 
export interface StickyNote {
 id: string;
 x: number;
 y: number;
 width: number;
 text: string;
 color: string;
}
 
export interface Annotations {
 strokes: Stroke[];
 shapes: Shape[];
 notes: StickyNote[];
}
 
export interface Version {
 id: string;
 pageId: string;
 projectId: string;
 label: string; // e.g. "v1", "v2 client favorite"
 /** ID of the image blob in the IndexedDB blob store */
 blobId: string;
 thumbBlobId?: string;
 width: number;
 height: number;
 rating: number; // 0..5
 verdict: Verdict;
 tagIds: string[];
 note: string;
 annotations: Annotations;
 createdAt: number;
 updatedAt: number;
}
 
export interface Blob_ {
 id: string;
 data: Blob;
 type: string;
}
 
export interface SavedView {
 id: string;
 name: string;
 query: FilterQuery;
}
 
export interface FilterQuery {
 projectId?: string;
 pageIds?: string[];
 tagIds?: string[];
 verdicts?: Verdict[];
 /** Show only versions with rating >= this value. */
 minRating?: number;
 /** Show only versions with rating === 0 (mutually exclusive with minRating). */
 unrated?: boolean;
 hasAnnotations?: boolean;
 text?: string;
 /**
  * Page ordering on the Board. Default `"manual"` respects the user's
  * dragged order. `"least-versions"` floats pages with the fewest versions
  * to the top — useful for spotting which pages still need work.
  */
 pageSort?: "manual" | "least-versions" | "most-versions";
}
 
export const EMPTY_ANNOTATIONS: Annotations = {
  strokes: [],
  shapes: [],
  notes: [],
};
