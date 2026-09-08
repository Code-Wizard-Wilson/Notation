"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  Copy,
  FileText,
  Paperclip,
  Pin,
  PinOff,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Drawer } from "@/components/interior/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useNotesActions } from "@/hooks/use-notes-actions";
import { useWorkspaceStore } from "@/store/workspace-store";
import { getNoteDisplayTitle } from "@/lib/utils";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function NoteDetailsDrawer() {
  const open = useWorkspaceStore((state) => state.detailsOpen);
  const setOpen = useWorkspaceStore((state) => state.setDetailsOpen);
  const note = useWorkspaceStore((state) =>
    state.notes.find((item) => item.id === state.selectedNoteId),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const {
    togglePin,
    archiveNote,
    restoreNote,
    trashNote,
    deleteForever,
    copyNoteLink,
  } = useNotesActions();

  const wordCount = useMemo(() => {
    if (!note) return 0;
    const text = note.plainTextContent.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [note]);

  if (!note) return null;
  const noteId = note.id;

  async function permanentlyDelete() {
    setConfirmDelete(false);
    setOpen(false);
    await deleteForever(noteId);
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        side="right"
        width={360}
        title="Note details"
        description={getNoteDisplayTitle(note)}
        closeLabel="Close note details"
      >
        <div className="note-details-content">
          <section className="note-details-section">
            <p className="settings-label">DETAILS</p>
            <dl className="note-details-grid">
              <div>
                <dt><CalendarDays size={14} /> Created</dt>
                <dd>{formatDate(note.createdAt)}</dd>
              </div>
              <div>
                <dt><CalendarDays size={14} /> Edited</dt>
                <dd>{formatDate(note.updatedAt)}</dd>
              </div>
              <div>
                <dt><FileText size={14} /> Words</dt>
                <dd>{wordCount}</dd>
              </div>
              <div>
                <dt><Paperclip size={14} /> Attachments</dt>
                <dd>{note.attachments.length}</dd>
              </div>
            </dl>
          </section>

          {note.attachments.length > 0 && (
            <section className="note-details-section">
              <p className="settings-label">ATTACHMENTS</p>
              <div className="note-details-attachments">
                {note.attachments.map((attachment) => (
                  <div key={attachment.id} className="note-details-attachment">
                    <span><Paperclip size={14} /></span>
                    <div>
                      <strong>{attachment.filename}</strong>
                      <small>{formatBytes(attachment.size)}</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="note-details-section note-details-actions-section">
            <p className="settings-label">ACTIONS</p>
            <div className="note-details-actions">
              <button type="button" onClick={() => void copyNoteLink(note.id)}>
                <Copy size={15} /><span>Copy link</span>
              </button>

              {!note.isArchived && !note.isDeleted && (
                <button type="button" onClick={() => void togglePin(note.id)}>
                  {note.isPinned ? <PinOff size={15} /> : <Pin size={15} />}
                  <span>{note.isPinned ? "Unpin" : "Pin"}</span>
                </button>
              )}

              {note.isArchived || note.isDeleted ? (
                <button type="button" onClick={() => { void restoreNote(note.id); setOpen(false); }}>
                  <RotateCcw size={15} /><span>Restore note</span>
                </button>
              ) : (
                <button type="button" onClick={() => { void archiveNote(note.id); setOpen(false); }}>
                  <Archive size={15} /><span>Archive</span>
                </button>
              )}

              {!note.isDeleted ? (
                <button className="is-danger" type="button" onClick={() => { void trashNote(note.id); setOpen(false); }}>
                  <Trash2 size={15} /><span>Move to Trash</span>
                </button>
              ) : (
                <button className="is-danger" type="button" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={15} /><span>Delete forever</span>
                </button>
              )}
            </div>
          </section>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this note forever?"
        description="The note and its attachments cannot be recovered."
        confirmLabel="Delete forever"
        onConfirm={() => void permanentlyDelete()}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
