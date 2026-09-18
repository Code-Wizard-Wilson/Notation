"use client";

import { Archive, FileText, Pin, Plus, Search, Trash2 } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useNotesActions } from "@/hooks/use-notes-actions";
import { NoteRow } from "@/components/workspace/note-row";
import { FolderTree } from "@/components/workspace/folder-tree";

const viewCopy = {
  all: {
    label: "ALL NOTES",
    heading: "Notes",
    emptyTitle: "No notes yet",
    emptyBody: "Create your first note and start writing.",
    emptyAction: "New note",
    icon: FileText,
  },
  pinned: {
    label: "QUICK ACCESS",
    heading: "Pinned",
    emptyTitle: "Nothing pinned",
    emptyBody: "Pin important notes so they stay easy to reach.",
    emptyAction: "View all notes",
    icon: Pin,
  },
  archive: {
    label: "PUT AWAY",
    heading: "Archive",
    emptyTitle: "Archive is empty",
    emptyBody: "Notes you put away will live here until you restore them.",
    emptyAction: "View all notes",
    icon: Archive,
  },
  trash: {
    label: "RECENTLY DELETED",
    heading: "Trash",
    emptyTitle: "Trash is empty",
    emptyBody: "Deleted notes will appear here before they are removed forever.",
    emptyAction: "View all notes",
    icon: Trash2,
  },
} as const;

export function NotesList() {
  const notes = useWorkspaceStore((state) => state.notes);
  const view = useWorkspaceStore((state) => state.view);
  const setView = useWorkspaceStore((state) => state.setView);
  const setCommandOpen = useWorkspaceStore((state) => state.setCommandOpen);
  const { createNote } = useNotesActions();

  const visible = notes
    .filter((note) => {
      if (view === "pinned") return note.isPinned && !note.isArchived && !note.isDeleted;
      if (view === "archive") return note.isArchived && !note.isDeleted;
      if (view === "trash") return note.isDeleted;
      return !note.isArchived && !note.isDeleted;
    })
    .sort((a, b) => {
      if (view === "all" && a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const rootVisible = view === "all" ? visible.filter((note) => !note.folderId) : visible;
  const pinned = view === "all" ? rootVisible.filter((note) => note.isPinned) : [];
  const regular = view === "all" ? rootVisible.filter((note) => !note.isPinned) : rootVisible;
  const copy = viewCopy[view];
  const EmptyIcon = copy.icon;

  return (
    <section className="notes-list-pane" aria-label={`${copy.heading} list`}>
      <header className="notes-list-head">
        <div>
          <p className="micro-label">{copy.label}</p>
          <h1>{copy.heading}</h1>
        </div>
        <button type="button" className="list-search" onClick={() => setCommandOpen(true)} aria-label="Search notes">
          <Search size={17} />
        </button>
      </header>

      <div className="notes-count"><span>{visible.length}</span> {visible.length === 1 ? "NOTE" : "NOTES"}</div>

      <div className="notes-scroll">
        {visible.length || view === "all" ? (
          <>
            {view === "all" && <FolderTree mode="list" />}
            {pinned.length > 0 && (
              <section className="note-group">
                <p className="note-group-label">PINNED</p>
                {pinned.map((note) => <NoteRow key={note.id} note={note} />)}
              </section>
            )}
            {regular.length > 0 && (
              <section className="note-group">
                {pinned.length > 0 && <p className="note-group-label">RECENT</p>}
                {regular.map((note) => <NoteRow key={note.id} note={note} />)}
              </section>
            )}
            {visible.length === 0 && (
              <div className="list-empty">
                <span className="list-empty-icon" aria-hidden="true"><EmptyIcon size={18} /></span>
                <h2>{copy.emptyTitle}</h2>
                <p>{copy.emptyBody}</p>
                <button
                  type="button"
                  className="list-empty-primary"
                  onClick={createNote}
                >
                  <Plus size={15} />
                  {copy.emptyAction}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="list-empty">
            <span className="list-empty-icon" aria-hidden="true"><EmptyIcon size={18} /></span>
            <h2>{copy.emptyTitle}</h2>
            <p>{copy.emptyBody}</p>
            <button
              type="button"
              className="list-empty-secondary"
              onClick={() => setView("all")}
            >
              {copy.emptyAction}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
