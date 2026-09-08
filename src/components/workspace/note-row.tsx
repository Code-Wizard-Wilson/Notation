"use client";

import { memo } from "react";
import { Archive, MoreHorizontal, Paperclip, Pin, RotateCcw } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useNotesActions } from "@/hooks/use-notes-actions";
import { formatRelativeTime, getNoteDisplayTitle, getNotePreview, cn } from "@/lib/utils";
import { NoteContextMenu } from "@/components/workspace/note-context-menu";
import { Tooltip } from "@/components/ui/tooltip";
import type { Note } from "@/types/note";

export const NoteRow = memo(function NoteRow({ note }: { note: Note }) {
  const selected = useWorkspaceStore((state) => state.selectedNoteId === note.id);
  const setSelected = useWorkspaceStore((state) => state.setSelectedNoteId);
  const setDetailsOpen = useWorkspaceStore((state) => state.setDetailsOpen);
  const { togglePin, archiveNote, restoreNote } = useNotesActions();

  function openDetails() {
    setSelected(note.id);
    setDetailsOpen(true);
  }

  return (
    <NoteContextMenu note={note}>
      <article className={cn("note-row", selected && "is-selected")}>
        <button className="note-row-main" type="button" onClick={() => setSelected(note.id)}>
          <span className="note-row-title">{getNoteDisplayTitle(note)}</span>
          <span className="note-row-preview">{getNotePreview(note)}</span>
          <span className="note-row-meta">
            <time dateTime={note.updatedAt}>{formatRelativeTime(note.updatedAt)}</time>
            {note.attachments.length > 0 && (
              <span aria-label={`${note.attachments.length} attachments`}>
                <Paperclip size={11} /> {note.attachments.length}
              </span>
            )}
          </span>
        </button>

        <div className="note-row-actions" aria-label="Note actions">
          {!note.isArchived && !note.isDeleted && (
            <Tooltip label={note.isPinned ? "Unpin note" : "Pin note"} side="top">
              <button
                className={cn("note-row-action", note.isPinned && "is-pinned")}
                type="button"
                aria-label={note.isPinned ? "Unpin note" : "Pin note"}
                onClick={(event) => {
                  event.stopPropagation();
                  void togglePin(note.id);
                }}
              >
                <Pin size={13} fill={note.isPinned ? "currentColor" : "none"} />
              </button>
            </Tooltip>
          )}

          <Tooltip label={note.isArchived || note.isDeleted ? "Restore note" : "Archive note"} side="top">
            <button
              className="note-row-action"
              type="button"
              aria-label={note.isArchived || note.isDeleted ? "Restore note" : "Archive note"}
              onClick={(event) => {
                event.stopPropagation();
                if (note.isArchived || note.isDeleted) void restoreNote(note.id);
                else void archiveNote(note.id);
              }}
            >
              {note.isArchived || note.isDeleted ? <RotateCcw size={13} /> : <Archive size={13} />}
            </button>
          </Tooltip>

          <Tooltip label="Note details" side="top">
            <button
              className="note-row-action"
              type="button"
              aria-label="Note details"
              onClick={(event) => {
                event.stopPropagation();
                openDetails();
              }}
            >
              <MoreHorizontal size={14} />
            </button>
          </Tooltip>
        </div>
      </article>
    </NoteContextMenu>
  );
});
