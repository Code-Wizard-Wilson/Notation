"use client";

import { useEffect, useRef } from "react";
import { MotionConfig } from "motion/react";
import { useRouter } from "next/navigation";
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
import { flushMutationQueue } from "@/lib/data/mutation-queue";
import { createClient } from "@/lib/supabase/client";
import { mapAttachment, mapNote } from "@/lib/utils";
import { UI_MOTION } from "@/lib/motion";
import type { Database } from "@/types/database";
import type { Note, WorkspaceUser } from "@/types/note";

export function Workspace({
  initialNotes,
  user,
  localMode,
}: {
  initialNotes: Note[];
  user: WorkspaceUser;
  localMode: boolean;
}) {
  const router = useRouter();
  const initialized = useWorkspaceStore((state) => state.initialized);
  const initialize = useWorkspaceStore((state) => state.initialize);
  const setOffline = useWorkspaceStore((state) => state.setOffline);
  const setSyncState = useWorkspaceStore((state) => state.setSyncState);
  const receiveNote = useWorkspaceStore((state) => state.receiveNote);
  const removeNote = useWorkspaceStore((state) => state.removeNote);
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const started = useRef(false);

  useWorkspaceShortcuts();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    initialize(initialNotes, user, localMode);
    hydrateSettings();
  }, [hydrateSettings, initialNotes, initialize, localMode, user]);

  useEffect(() => {
    function offline() {
      setOffline(true);
    }
    async function online() {
      setOffline(false);
      if (!localMode) {
        const synced = await flushMutationQueue();
        if (synced) {
          useWorkspaceStore.getState().notes.forEach((note) => {
            if (note.syncState === "offline" || note.syncState === "error") setSyncState(note.id, "idle");
          });
        }
      }
    }
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    if (navigator.onLine) void online();
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [localMode, setOffline, setSyncState]);

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

  useEffect(() => {
    if (localMode) return;
    const supabase = createClient();
    type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
    type AttachmentRow = Database["public"]["Tables"]["attachments"]["Row"];
    const channel = supabase
      .channel(`personal-notes:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            removeNote((payload.old as { id: string }).id);
            return;
          }
          const row = payload.new as NoteRow;
          const existing = useWorkspaceStore.getState().notes.find((note) => note.id === row.id);
          receiveNote({ ...mapNote(row, []), attachments: existing?.attachments ?? [] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attachments", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const store = useWorkspaceStore.getState();
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            const owner = store.notes.find((note) =>
              note.attachments.some((attachment) => attachment.id === deletedId),
            );
            if (owner) {
              store.patchNote(
                owner.id,
                { attachments: owner.attachments.filter((attachment) => attachment.id !== deletedId) },
                false,
              );
            }
            return;
          }

          const row = payload.new as AttachmentRow;
          const owner = store.notes.find((note) => note.id === row.note_id);
          if (!owner) return;
          const attachment = { ...mapAttachment(row), url: `/api/attachments/${row.id}` };
          store.patchNote(
            owner.id,
            {
              attachments: owner.attachments.some((item) => item.id === row.id)
                ? owner.attachments.map((item) => (item.id === row.id ? attachment : item))
                : [...owner.attachments, attachment],
            },
            false,
          );
        },
      )
      .subscribe();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.refresh();
    });

    return () => {
      void supabase.removeChannel(channel);
      authListener.subscription.unsubscribe();
    };
  }, [localMode, receiveNote, removeNote, router, user.id]);

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
