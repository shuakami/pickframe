"use client";
 
import { create } from "zustand";
 
export type PromptOptions = {
 title: string;
 description?: string;
 placeholder?: string;
 defaultValue?: string;
 confirmLabel?: string;
 cancelLabel?: string;
};
 
export type ConfirmOptions = {
 title: string;
 description?: string;
 danger?: boolean;
 confirmLabel?: string;
 cancelLabel?: string;
};
 
type PromptReq = {
 id: string;
 kind: "prompt";
 opts: PromptOptions;
 resolve: (v: string | null) => void;
};
type ConfirmReq = {
 id: string;
 kind: "confirm";
 opts: ConfirmOptions;
 resolve: (v: boolean) => void;
};
type DialogReq = PromptReq | ConfirmReq;
 
type DialogStore = {
 queue: DialogReq[];
 push: (req: DialogReq) => void;
 resolveTop: (value: unknown) => void;
};
 
export const useDialogStore = create<DialogStore>((set, get) => ({
  queue: [],
 push: (req) => set((s) => ({ queue: [...s.queue, req] })),
 resolveTop: (value) => {
 const q = get().queue;
 const top = q[0];
 if (!top) return;
 if (top.kind === "prompt") top.resolve(value as string | null);
 else top.resolve(value as boolean);
 set({ queue: q.slice(1) });
  },
}));
 
let _id = 0;
function nextId() {
  _id += 1;
 return `d_${_id}`;
}
 
export function uiPrompt(opts: PromptOptions): Promise<string | null> {
 return new Promise((resolve) => {
    useDialogStore.getState().push({
      id: nextId(),
      kind: "prompt",
      opts,
      resolve,
    });
  });
}
 
export function uiConfirm(opts: ConfirmOptions): Promise<boolean> {
 return new Promise((resolve) => {
    useDialogStore.getState().push({
      id: nextId(),
      kind: "confirm",
      opts,
      resolve,
    });
  });
}
 
/* ----------------------------- Toasts ----------------------------- */
 
export type Toast = {
 id: string;
 title: string;
 description?: string;
 tone?: "default" | "success" | "danger";
 /** When true the toast will not auto-dismiss; caller cleans it up. */
 sticky?: boolean;
 /** 0..1 progress bar shown under the toast body. */
 progress?: number;
};

type ToastStore = {
 toasts: Toast[];
 push: (t: Omit<Toast, "id">) => string;
 update: (id: string, patch: Partial<Omit<Toast, "id">>) => void;
 dismiss: (id: string) => void;
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
 push: (t) => {
 const id = nextId();
 const toast = { id, ...t };
 set((s) => ({ toasts: [...s.toasts, toast] }));
 if (!t.sticky) {
 setTimeout(() => {
 set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
      }, 3200);
    }
 return id;
  },
 update: (id, patch) =>
 set((s) => ({
      toasts: s.toasts.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    })),
 dismiss: (id) =>
 set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function toast(t: Omit<Toast, "id">) {
 return useToastStore.getState().push(t);
}

export function updateToast(id: string, patch: Partial<Omit<Toast, "id">>) {
 useToastStore.getState().update(id, patch);
}

export function dismissToast(id: string) {
 useToastStore.getState().dismiss(id);
}
