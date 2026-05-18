"use client";
 
/** Decode an image file into HTMLImageElement (and revoke the temp URL). */
export async function decodeImage(file: Blob): Promise<HTMLImageElement> {
 const url = URL.createObjectURL(file);
 try {
 const img = new Image();
    img.decoding = "async";
    img.src = url;
 await img.decode();
 return img;
  } finally {
 // Caller may still reference dimensions afterwards; safe to revoke later.
 setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
 
/** Generate a thumbnail JPEG Blob fitting within `maxSide`. */
export async function makeThumbnail(
 file: Blob,
 maxSide = 640,
 quality = 0.82,
): Promise<{ blob: Blob; width: number; height: number }> {
 const img = await decodeImage(file);
 const w = img.naturalWidth;
 const h = img.naturalHeight;
 const scale = Math.min(1, maxSide / Math.max(w, h));
 const tw = Math.max(1, Math.round(w * scale));
 const th = Math.max(1, Math.round(h * scale));
 const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
 const ctx = canvas.getContext("2d");
 if (!ctx) throw new Error("2d context unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, tw, th);
 const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
 "image/jpeg",
      quality,
    );
  });
 return { blob, width: w, height: h };
}
