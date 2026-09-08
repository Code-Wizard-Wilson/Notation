"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useNotesActions } from "@/hooks/use-notes-actions";

export function useWorkspaceShortcuts() {
  const { createNote, togglePin, trashNote } = useNotesActions();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      const store = useWorkspaceStore.getState();

      if (event.key === "Escape") {
        store.setCommandOpen(false);
        store.setSettingsOpen(false);
        return;
      }

      if (!mod) return;

      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        event.stopPropagation();
        createNote();
        return;
      }

      // On macOS the physical Delete key reports as Backspace. Treat both
      // Backspace and Forward Delete as Cmd+Delete, but do not map Ctrl+Delete
      // because that is a normal text-editing shortcut on other platforms.
      if (event.metaKey && (event.key === "Backspace" || event.key === "Delete") && store.selectedNoteId) {
        const current = store.notes.find((note) => note.id === store.selectedNoteId);
        if (!current || current.isDeleted) return;
        event.preventDefault();
        event.stopPropagation();
        void trashNote(current.id);
        return;
      }

      if (event.key.toLowerCase() === "k") {
        const selection = window.getSelection();
        const active = document.activeElement;
        const editingSelection =
          active?.closest(".ProseMirror") && selection && !selection.isCollapsed;
        if (editingSelection) return;
        event.preventDefault();
        store.setCommandOpen(true);
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        store.setCommandOpen(true);
        return;
      }

      if (!event.shiftKey && event.key.toLowerCase() === "p" && store.selectedNoteId) {
        event.preventDefault();
        event.stopPropagation();
        void togglePin(store.selectedNoteId);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createNote, togglePin, trashNote]);
}
