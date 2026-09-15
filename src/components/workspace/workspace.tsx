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
      <aside className="skeleton-navigation" aria-hidden="true">
        <div className="skeleton-nav-head">
          <div className="skeleton-brand">
            <span className="skeleton-block skeleton-brand-icon" />
            <span className="skeleton-block skeleton-brand-name" />
          </div>
          <span className="skeleton-block skeleton-square-control" />
        </div>

        <div className="skeleton-nav-main">
          <div className="skeleton-nav-row skeleton-nav-row-primary">
            <span className="skeleton-block skeleton-nav-icon" />
            <span className="skeleton-block skeleton-nav-copy skeleton-nav-copy-wide" />
          </div>
          <div className="skeleton-nav-row">
            <span className="skeleton-block skeleton-nav-icon" />
            <span className="skeleton-block skeleton-nav-copy" />
          </div>

          <div className="skeleton-sidebar-notes">
            <div className="skeleton-sidebar-head">
              <span className="skeleton-block skeleton-label-line" />
              <span className="skeleton-block skeleton-count-dot" />
            </div>
            <div className="skeleton-sidebar-list">
              <div className="skeleton-sidebar-note"><span className="skeleton-block skeleton-sidebar-note-a" /></div>
              <div className="skeleton-sidebar-note"><span className="skeleton-block skeleton-sidebar-note-b" /></div>
              <div className="skeleton-sidebar-note"><span className="skeleton-block skeleton-sidebar-note-c" /></div>
              <div className="skeleton-sidebar-note"><span className="skeleton-block skeleton-sidebar-note-d" /></div>
              <div className="skeleton-sidebar-note"><span className="skeleton-block skeleton-sidebar-note-e" /></div>
            </div>
          </div>
        </div>

        <div className="skeleton-nav-foot">
          <div className="skeleton-view-switcher">
            <span className="skeleton-block skeleton-view-icon" />
            <span className="skeleton-block skeleton-view-icon" />
            <span className="skeleton-block skeleton-view-icon" />
            <span className="skeleton-block skeleton-view-icon" />
          </div>
          <div className="skeleton-account-row">
            <span className="skeleton-block skeleton-avatar" />
            <div className="skeleton-account-copy">
              <span className="skeleton-block" />
              <span className="skeleton-block" />
            </div>
            <span className="skeleton-block skeleton-settings-dot" />
          </div>
        </div>
      </aside>

      <aside className="skeleton-tablet-rail" aria-hidden="true">
        <span className="skeleton-block skeleton-tablet-button" />
        <span className="skeleton-block skeleton-tablet-button skeleton-tablet-primary" />
        <span className="skeleton-block skeleton-tablet-button" />
        <span className="skeleton-block skeleton-tablet-divider" />
        <span className="skeleton-block skeleton-tablet-button" />
        <span className="skeleton-block skeleton-tablet-button" />
        <span className="skeleton-block skeleton-tablet-button" />
        <span className="skeleton-block skeleton-tablet-button skeleton-tablet-settings" />
      </aside>

      <div className="skeleton-workspace-content" aria-hidden="true">
        <section className="skeleton-list-pane">
          <header className="skeleton-list-head">
            <div>
              <span className="skeleton-block skeleton-micro-label" />
              <span className="skeleton-block skeleton-list-title" />
            </div>
            <span className="skeleton-block skeleton-square-control" />
          </header>
          <div className="skeleton-list-count">
            <span className="skeleton-block" />
          </div>
          <div className="skeleton-list-scroll">
            {[0, 1, 2, 3].map((index) => (
              <div className="skeleton-note-row" key={index}>
                <span className="skeleton-block skeleton-note-title" />
                <span className="skeleton-block skeleton-note-preview" />
                <span className="skeleton-block skeleton-note-meta" />
              </div>
            ))}
          </div>
        </section>

        <article className="skeleton-editor-pane">
          <div className="skeleton-editor-toolbar">
            <span className="skeleton-block skeleton-editor-status" />
            <div>
              <span className="skeleton-block skeleton-square-control" />
              <span className="skeleton-block skeleton-square-control" />
              <span className="skeleton-block skeleton-square-control" />
            </div>
          </div>
          <div className="skeleton-editor-page">
            <span className="skeleton-block skeleton-editor-title" />
            <div className="skeleton-editor-body">
              <span className="skeleton-block skeleton-editor-line skeleton-editor-line-a" />
              <span className="skeleton-block skeleton-editor-line skeleton-editor-line-b" />
              <span className="skeleton-block skeleton-editor-line skeleton-editor-line-c" />
              <span className="skeleton-block skeleton-editor-line skeleton-editor-line-d" />
            </div>
          </div>
        </article>
      </div>

      <div className="skeleton-mobile-nav" aria-hidden="true">
        <span className="skeleton-block" />
        <span className="skeleton-block" />
        <span className="skeleton-block skeleton-mobile-primary" />
        <span className="skeleton-block" />
        <span className="skeleton-block" />
      </div>
    </main>
  );
}
