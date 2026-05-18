"use client";
 
import * as React from "react";
import { useStore } from "@/lib/store";
import { BoardView } from "../views/BoardView";
import { CompareView } from "../views/CompareView";
import { SingleView } from "../views/SingleView";
import { FlowView } from "../views/FlowView";
import { EmptyState } from "../views/EmptyState";
 
export function Workspace() {
 const viewMode = useStore((s) => s.viewMode);
 const projects = useStore((s) => s.projects);
 const activeProjectId = useStore((s) => s.activeProjectId);
 
 if (projects.length === 0) {
 return <EmptyState kind="no-projects" />;
  }
 if (!activeProjectId) {
 return <EmptyState kind="pick-project" />;
  }
 
 // BoardView handles its own empty / no-page / no-version states inline,
 // including a prominent CTA + global drop zone. Don't short-circuit to the
 // separate "no-versions" empty screen — it traps users.
 if (viewMode === "single") return <SingleView />;
 if (viewMode === "compare") return <CompareView />;
 if (viewMode === "flow") return <FlowView />;
 return <BoardView />;
}
