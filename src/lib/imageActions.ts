import { getBlob } from "./db";
import { toast } from "./ui";

/**
 * Copy a stored image blob to the system clipboard.
 *
 * Browsers only allow a small set of MIME types via the async Clipboard API
 * (PNG is the only one that's universally accepted; JPEG/WebP support is
 * spotty). We re-encode to PNG when needed so "Copy image" never fails on
 * Safari / Firefox just because the source was a JPEG.
 */
export async function copyImageToClipboard(
 blobId: string,
): Promise<boolean> {
 const blob = await getBlob(blobId);
 if (!blob) {
 toast({ tone: "danger", title: "Couldn't find image data" });
 return false;
 }
 try {
 if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
 throw new Error("Clipboard API not available");
    }

 let toCopy: Blob = blob;
 // Convert non-PNG to PNG via canvas — the only universally allowed type.
 if (blob.type !== "image/png") {
 toCopy = await reencodeToPng(blob);
    }
 await navigator.clipboard.write([
 new ClipboardItem({ [toCopy.type]: toCopy }),
    ]);
 toast({ tone: "success", title: "Image copied to clipboard" });
 return true;
  } catch (err) {
 console.error("copyImageToClipboard failed", err);
 toast({
 tone: "danger",
 title: "Couldn't copy image",
 description: "Your browser blocked clipboard access. Try Save image instead.",
    });
 return false;
  }
}

async function reencodeToPng(blob: Blob): Promise<Blob> {
 const url = URL.createObjectURL(blob);
 try {
 const img = await new Promise<HTMLImageElement>((resolve, reject) => {
 const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
 const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
 const ctx = canvas.getContext("2d");
 if (!ctx) throw new Error("Canvas 2D unavailable");
    ctx.drawImage(img, 0, 0);
 return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Canvas toBlob returned null")),
 "image/png",
      );
    });
  } finally {
 URL.revokeObjectURL(url);
  }
}

/**
 * Trigger a download for the underlying image blob, named after the
 * supplied filename hint (which we'll sanitize). The extension is taken
 * from the blob MIME — falls back to `.png`.
 */
export async function saveImageToDisk(
 blobId: string,
 filenameHint: string,
): Promise<boolean> {
 const blob = await getBlob(blobId);
 if (!blob) {
 toast({ tone: "danger", title: "Couldn't find image data" });
 return false;
  }
 const ext = mimeToExt(blob.type);
 const safeBase = (filenameHint || "image")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "image";
 const url = URL.createObjectURL(blob);
 try {
 const a = document.createElement("a");
    a.href = url;
    a.download = `${safeBase}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
 toast({ tone: "success", title: "Image saved" });
 return true;
  } finally {
 // Slight delay so the browser actually starts the download before we
 // revoke the URL — Safari is picky here.
 setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function mimeToExt(type: string): string {
 if (type === "image/jpeg") return "jpg";
 if (type === "image/webp") return "webp";
 if (type === "image/gif") return "gif";
 if (type === "image/svg+xml") return "svg";
 return "png";
}
