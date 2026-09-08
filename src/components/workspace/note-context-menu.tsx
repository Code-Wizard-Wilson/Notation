"use client";

import type { ReactNode } from "react";
import { Archive, Copy, CopyPlus, Pin, PinOff, RotateCcw, Trash2 } from "lucide-react";
import {
  ContextMenu,
  type ContextMenuItem,
} from "@/components/interior/context-menu";
import { useNotesActions } from "@/hooks/use-notes-actions";
import type { Note } from "@/types/note";

export function NoteContextMenu({ note, children }: { note: Note; children: ReactNode }) {
  const { togglePin, archiveNote, restoreNote, trashNote, duplicateNote, copyNoteLink } = useNotesActions();

  const items: ContextMenuItem[] = [];

  if (!note.isArchived && !note.isDeleted) {
    items.push({
      id: "pin",
      label: note.isPinned ? "Unpin" : "Pin",
      icon: note.isPinned ? <PinOff size={15} /> : <Pin size={15} />,
      onSelect: () => void togglePin(note.id),
    });
  }

  items.push(
    note.isArchived || note.isDeleted
      ? {
          id: "restore",
          label: "Restore",
          icon: <RotateCcw size={15} />,
          onSelect: () => void restoreNote(note.id),
        }
      : {
          id: "archive",
          label: "Archive",
          icon: <Archive size={15} />,
          onSelect: () => void archiveNote(note.id),
        },
    {
      id: "duplicate",
      label: "Duplicate",
      icon: <CopyPlus size={15} />,
      onSelect: () => void duplicateNote(note.id),
    },
    {
      id: "copy",
      label: "Copy link",
      icon: <Copy size={15} />,
      onSelect: () => void copyNoteLink(note.id),
    },
  );

  if (!note.isDeleted) {
    items.push(
      { id: "danger-divider", type: "separator" },
      {
        id: "trash",
        label: "Move to Trash",
        icon: <Trash2 size={15} />,
        onSelect: () => void trashNote(note.id),
      },
    );
  }

  return (
    <ContextMenu items={items} label={`Actions for ${note.title || "Untitled"}`} width={224} className="note-context-anchor">
      {children}
    </ContextMenu>
  );
}
