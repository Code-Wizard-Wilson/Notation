"use client";

import { useEffect, useRef } from "react";
import { MotionConfig } from "motion/react";
import { Navigation } from "@/components/workspace/navigation";
import { TabletRail } from "@/components/workspace/tablet-rail";
import { NotesList } from "@/components/workspace/notes-list";
import { NoteEditor } from "@/components/editor/note-editor";
import { CommandPalette } from "@/components/workspace/command-palette";
import { SettingsSheet } from "@/components/workspace/settings-sheet";
import { NoteDetailsDrawer } from "@/components/workspace/note-details-drawer";
import { MobileNavigation } from "@/components/workspace/mobile-navigation";
import { ToastStack } from "@/components/ui/toast-stack";
import { TooltipGroup } from "@/components/interior/tooltip-group";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSettingsStore } from "@/store/settings-store";
import { useWorkspaceShortcuts } from "@/hooks/use-workspace-shortcuts";
import { UI_MOTION } from "@/lib/motion";
import type { Note, WorkspaceUser } from "@/types/note";

export function Workspace({
  initialNotes,
  user,
}: {
  initialNotes: Note[];
  user: WorkspaceUser;
}) {
  const initialized = useWorkspaceStore((state) => state.initialized);
  const initialize = useWorkspaceStore((state) => state.initialize);
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const started = useRef(false);

  useWorkspaceShortcuts();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void initialize(initialNotes, user);
    hydrateSettings();
  }, [hydrateSettings, initialNotes, initialize, user]);

  useEffect(() => {
    function handleHistoryNavigation() {
      const store = useWorkspaceStore.getState();
      if (window.matchMedia("(max-width: 700px)").matches && store.mobilePane === "editor") {
        store.setMobilePane("list");
      }
    }
    window.addEventListener("popstate", handleHistoryNavigation);
    return () => window.removeEventListener("popstate", handleHistoryNavigation);
  }, []);

  if (!initialized) return <WorkspaceSkeleton />;

  return (
    <MotionConfig reducedMotion="user" transition={UI_MOTION.default}>
      <TooltipGroup openDelay={200} closeDelay={120} skipDelay={400}>
        <main className="workspace-shell" data-font={fontFamily}>
          <Navigation />
          <TabletRail />
          <div className="workspace-content">
            <NotesList />
            <NoteEditor />
          </div>
          <MobileNavigation />
          <CommandPalette />
          <SettingsSheet />
          <NoteDetailsDrawer />
          <ToastStack />
        </main>
      </TooltipGroup>
    </MotionConfig>
  );
}

function WorkspaceSkeleton() {
  return (
    <main className="workspace-skeleton" aria-label="Loading notes">
      <span className="skeleton-rail" />
      <section><span /><span /><span /><span /></section>
      <article><span /><span /><span /></article>
    </main>
  );
}
