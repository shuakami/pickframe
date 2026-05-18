"use client";
 
import * as React from "react";
import { useStore } from "@/lib/store";
import { Button } from "../primitives/Button";
import { Logo } from "../primitives/Logo";
import { Plus, Sparkles, Upload } from "lucide-react";
import { seedDemoData } from "@/lib/seed";
import { uiPrompt } from "@/lib/ui";
 
export function EmptyState({
 kind,
}: {
 kind: "no-projects" | "pick-project" | "no-versions";
}) {
 const addProject = useStore((s) => s.addProject);
 const loadAll = useStore((s) => s.loadAll);
 const setActiveProject = useStore((s) => s.setActiveProject);
 const setImportOpen = useStore((s) => s.setImportOpen);
 const projects = useStore((s) => s.projects);
 
 if (kind === "pick-project") {
 return (
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-[14px] text-[var(--fg-muted)]">
            Pick a project from the sidebar, or
          </p>
          <Button
 className="mt-3"
 variant="brand"
 onClick={async () => {
 const name = await uiPrompt({
                title: "New project",
                placeholder: "e.g. Mini app redesign",
                confirmLabel: "Create",
              });
 if (name?.trim()) await addProject(name.trim());
            }}
          >
            <Plus size={14} />
            New project
          </Button>
        </div>
      </div>
    );
  }
 
 if (kind === "no-projects") {
 return (
      <div className="absolute inset-0 grid place-items-center px-6">
        <div className="max-w-[480px] text-center">
          <div className="mx-auto mb-5 grid place-items-center w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--bg-soft)] border border-[var(--border)]">
            <Logo size={22} />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            Welcome to Pickframe
          </h1>
          <p className="mt-2 text-[14px] leading-[1.6] text-[var(--fg-muted)]">
            Drop in a stack of design mocks — lay them out, compare,
            scribble notes, pick a winner per page, and export.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button
 variant="brand"
 onClick={async () => {
 const name = await uiPrompt({
                  title: "New project",
                  defaultValue: "My mini app",
                  placeholder: "e.g. Mini app redesign",
                  confirmLabel: "Create",
                });
 if (name?.trim()) await addProject(name.trim());
              }}
            >
              <Plus size={14} />
              New project
            </Button>
            <Button
 variant="outline"
 onClick={async () => {
 await seedDemoData();
 await loadAll();
 const first = useStore.getState().projects[0];
 if (first) setActiveProject(first.id);
              }}
            >
              <Sparkles size={14} />
              Load sample data
            </Button>
            <Button
 variant="outline"
 onClick={() => setImportOpen(true)}
            >
              <Upload size={14} />
              Import…
            </Button>
          </div>
        </div>
      </div>
    );
  }
 
 // no-versions
 return (
    <div className="absolute inset-0 grid place-items-center px-6">
      <div className="max-w-[420px] text-center">
        <h2 className="text-[18px] font-semibold tracking-tight">
          This project is empty
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--fg-muted)]">
          Add a page in the sidebar (e.g.&nbsp;Home, Profile, Order),
          then drop multiple versions of its mock onto the board.
        </p>
        <p className="mt-1 text-[12.5px] text-[var(--fg-subtle)]">
          PNG / JPG / WebP supported. Drop multiple at once.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button
 onClick={async () => {
 const project = projects[0];
 if (!project) return;
 const name = await uiPrompt({
                title: "New page",
                defaultValue: "Home",
                placeholder: "e.g. Home, Cart, Checkout",
                confirmLabel: "Create",
              });
 if (name?.trim())
 await useStore.getState().addPage(project.id, name.trim());
            }}
 variant="brand"
          >
            <Plus size={14} />
            New page
          </Button>
        </div>
      </div>
    </div>
  );
}
