"use client";
 
import { nanoid } from "nanoid";
import { saveBlob, getDB } from "./db";
import {
  EMPTY_ANNOTATIONS,
 type Page,
 type Project,
 type Tag,
 type Version,
} from "./types";
import { TAG_COLORS } from "./utils";
 
const now = () => Date.now();
 
/**
 * Generate a fake "design mockup" image as a Blob — gradient background,
 * a phone frame with a few stripes simulating a UI. Purely cosmetic.
 */
async function generateMockBlob(
 hue: number,
 variant: number,
 label: string,
): Promise<{ blob: Blob; width: number; height: number }> {
 const w = 750;
 const h = 1334;
 const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
 const ctx = canvas.getContext("2d");
 if (!ctx) throw new Error("no 2d");
 
 // Background gradient
 const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, `hsl(${hue} 70% 88%)`);
  grd.addColorStop(1, `hsl(${(hue + 30) % 360} 60% 76%)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
 
 // Status bar
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(0, 0, w, 88);
  ctx.fillStyle = "#15110a";
  ctx.font = "600 32px ui-sans-serif, system-ui";
  ctx.fillText("9:41", 36, 56);
  ctx.textAlign = "right";
  ctx.fillText("●●● ◢ ▆▆▆", w - 36, 56);
  ctx.textAlign = "left";
 
 // Title
  ctx.fillStyle = "#15110a";
  ctx.font = "700 60px ui-sans-serif, system-ui";
  ctx.fillText(label, 48, 200);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.font = "500 28px ui-sans-serif, system-ui";
  ctx.fillText(`Variant ${variant}`, 48, 246);
 
 // Cards
 for (let i = 0; i < 4 + variant; i++) {
 const cy = 320 + i * (180 + (variant % 2) * 12);
 if (cy + 160 > h - 200) break;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
 roundRect(ctx, 36, cy, w - 72, 160, 24);
    ctx.fill();
 // little circle
    ctx.fillStyle = `hsl(${(hue + i * 40) % 360} 70% 60%)`;
    ctx.beginPath();
    ctx.arc(108, cy + 80, 44, 0, Math.PI * 2);
    ctx.fill();
 // text bars
    ctx.fillStyle = "rgba(0,0,0,0.7)";
 roundRect(ctx, 184, cy + 36, 360, 22, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
 roundRect(ctx, 184, cy + 76, 240, 16, 6);
    ctx.fill();
 roundRect(ctx, 184, cy + 104, 300, 16, 6);
    ctx.fill();
  }
 
 // Tab bar
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillRect(0, h - 140, w, 140);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
 for (let i = 0; i < 4; i++) {
 const cx = w / 4 / 2 + i * (w / 4);
    ctx.beginPath();
    ctx.arc(cx, h - 80, 18, 0, Math.PI * 2);
    ctx.fill();
  }
 
 return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) =>
        b
 ? resolve({ blob: b, width: w, height: h })
 : reject(new Error("toBlob failed")),
 "image/jpeg",
 0.85,
    );
  });
}
 
function roundRect(
 ctx: CanvasRenderingContext2D,
 x: number,
 y: number,
 w: number,
 h: number,
 r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
 
const SEED_KEY = "pickframe.seed.v";
const SEED_VERSION = "2";
 
export async function seedDemoData() {
 const db = getDB();
 const seenVer =
 typeof window !== "undefined"
 ? window.localStorage.getItem(SEED_KEY)
 : null;
 const existing = await db.projects.count();
 // If user already has data and they're on the current seed, skip.
 if (existing > 0 && seenVer === SEED_VERSION) return;
 // If they have an old (Chinese) seed and no custom data was added later,
 // wipe it and reseed in English.
 if (existing > 0 && seenVer !== SEED_VERSION) {
 const onlyDemo = await db.projects
      .toArray()
      .then((rows) =>
        rows.every(
          (p) =>
            p.name === "Mini App Demo" ||
            p.name === "\u997a\u5b50\u70b9\u5355",
        ),
      );
 if (!onlyDemo) {
 // Respect user-created projects; just mark seed seen and bail.
      window.localStorage.setItem(SEED_KEY, SEED_VERSION);
 return;
    }
 await db.versions.clear();
 await db.tags.clear();
 await db.pages.clear();
 await db.projects.clear();
 await db.blobs.clear();
  }
 if (typeof window !== "undefined") {
    window.localStorage.setItem(SEED_KEY, SEED_VERSION);
  }
 
 const project: Project = {
    id: nanoid(8),
    name: "Mini App Demo",
    emoji: "📱",
    createdAt: now(),
    updatedAt: now(),
  };
 await db.projects.put(project);
 
 const pageDefs = [
    { name: "Home", hue: 215, count: 4 },
    { name: "Profile", hue: 32, count: 3 },
    { name: "Order", hue: 162, count: 4 },
    { name: "Cart", hue: 322, count: 2 },
    { name: "Checkout", hue: 268, count: 3 },
  ];
 
 const tagDefs = [
    { name: "Client liked", color: TAG_COLORS[5] },
    { name: "Feasible", color: TAG_COLORS[3] },
    { name: "Rethink", color: TAG_COLORS[4] },
    { name: "Icons", color: TAG_COLORS[0] },
    { name: "Typography", color: TAG_COLORS[2] },
  ];
 const tags: Tag[] = tagDefs.map((d) => ({
    id: nanoid(6),
    projectId: project.id,
    name: d.name,
    color: d.color,
  }));
 await db.tags.bulkPut(tags);
 
 let pageOrder = 1;
 for (const def of pageDefs) {
 const page: Page = {
      id: nanoid(8),
      projectId: project.id,
      name: def.name,
      order: pageOrder++,
      createdAt: now(),
    };
 await db.pages.put(page);
 
 for (let i = 1; i <= def.count; i++) {
 const blobId = nanoid(10);
 const thumbId = nanoid(10);
 const { blob, width, height } = await generateMockBlob(
        def.hue,
        i,
        def.name,
      );
 await saveBlob(blobId, blob);
 // also use same image as thumb (cheap)
 await saveBlob(thumbId, blob);
 const verdict =
        i === 1 && pageOrder === 2
 ? "winner"
 : i === 2 && pageOrder === 3
 ? "picked"
 : i === 3
 ? "partial"
 : "unset";
 const v: Version = {
        id: nanoid(10),
        pageId: page.id,
        projectId: project.id,
        label: `v${i}`,
        blobId,
        thumbBlobId: thumbId,
        width,
        height,
        rating: i === 1 ? 4 : i === 2 ? 3 : 0,
        verdict,
        tagIds: i % 2 === 0 ? [tags[1].id, tags[3].id] : [tags[0].id],
        note:
          i === 1
 ? "Most balanced layout, palette feels right."
 : i === 2
 ? "Card spacing feels cramped."
 : "",
        annotations: {
          strokes: [],
          shapes: [],
          notes: [],
        },
        createdAt: now(),
        updatedAt: now(),
      };
 await db.versions.put(v);
    }
  }
 
 // Annotations placeholder for the first version (drawn in canvas later)
 void EMPTY_ANNOTATIONS;
}
