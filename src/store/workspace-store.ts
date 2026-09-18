"use client";

import { create } from "zustand";
import { EMPTY_DOCUMENT, SIDEBAR_KEY } from "@/lib/constants";
import { readLocalFolders, readLocalNotes, writeLocalFolders, writeLocalNotes } from "@/lib/data/local";
import type { Note, NoteFolder, NotesView, ToastMessage, WorkspaceUser } from "@/types/note";

type MobilePane = "list" | "editor";

type WorkspaceState = {
  initialized: boolean;
  user: WorkspaceUser | null;
  notes: Note[];
  folders: NoteFolder[];
  selectedNoteId: string | null;
  view: NotesView;
  sidebarCollapsed: boolean;
  mobilePane: MobilePane;
  commandOpen: boolean;
  settingsOpen: boolean;
  detailsOpen: boolean;
  editorFocusRequest: number;
  toasts: ToastMessage[];
  initialize: (notes: Note[], user: WorkspaceUser) => Promise<void>;
  addNote: (note: Note) => void;
  patchNote: (id: string, patch: Partial<Note>, touch?: boolean) => Note | undefined;
  setSyncState: (id: string, state: Note["syncState"]) => void;
  removeNote: (id: string) => void;
  receiveNote: (note: Note) => void;
  createFolder: (name?: string) => NoteFolder;
  renameFolder: (id: string, name: string) => NoteFolder | undefined;
  deleteFolder: (id: string) => void;
  moveNoteToFolder: (noteId: string, folderId: string | null) => Note | undefined;
  setSelectedNoteId: (id: string | null, openEditor?: boolean) => void;
  setView: (view: NotesView) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobilePane: (pane: MobilePane) => void;
  setCommandOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setDetailsOpen: (open: boolean) => void;
  requestEditorFocus: () => void;
  pushToast: (toast: Omit<ToastMessage, "id">) => string;
  dismissToast: (id: string) => void;
};

function persistNotes(state: Pick<WorkspaceState, "notes">) {
  writeLocalNotes(state.notes);
}

function persistFolders(state: Pick<WorkspaceState, "folders">) {
  writeLocalFolders(state.folders);
}

function notesInView(notes: Note[], view: NotesView) {
  return notes.filter((note) => {
    if (view === "pinned") return note.isPinned && !note.isArchived && !note.isDeleted;
    if (view === "archive") return note.isArchived && !note.isDeleted;
    if (view === "trash") return note.isDeleted;
    return !note.isArchived && !note.isDeleted;
  });
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  initialized: false,
  user: null,
  notes: [],
  folders: [],
  selectedNoteId: null,
  view: "all",
  sidebarCollapsed: false,
  mobilePane: "list",
  commandOpen: false,
  settingsOpen: false,
  detailsOpen: false,
  editorFocusRequest: 0,
  toasts: [],
  async initialize(notes, user) {
    const [hydratedNotes, hydratedFolders] = await Promise.all([readLocalNotes(notes), readLocalFolders()]);
    const folderIds = new Set(hydratedFolders.map((folder) => folder.id));
    const normalizedNotes = hydratedNotes.map((note) =>
      note.folderId && !folderIds.has(note.folderId) ? { ...note, folderId: null } : note,
    );
    if (normalizedNotes.some((note, index) => note !== hydratedNotes[index])) writeLocalNotes(normalizedNotes);

    const storedSidebar =
      typeof window !== "undefined" && window.localStorage.getItem(SIDEBAR_KEY) === "true";
    const requestedNote =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("note")
        : null;
    const selected =
      (requestedNote && normalizedNotes.some((note) => note.id === requestedNote)
        ? requestedNote
        : normalizedNotes.find((note) => !note.isArchived && !note.isDeleted)?.id) ?? null;

    set({
      initialized: true,
      notes: normalizedNotes,
      folders: hydratedFolders,
      user,
      selectedNoteId: selected,
      sidebarCollapsed: storedSidebar,
    });
  },
  addNote(note) {
    set((state) => ({ notes: [note, ...state.notes], selectedNoteId: note.id, mobilePane: "editor" }));
    persistNotes(get());
  },
  patchNote(id, patch, touch = true) {
    let updated: Note | undefined;
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== id) return note;
        updated = {
          ...note,
          ...patch,
          updatedAt: touch ? new Date().toISOString() : patch.updatedAt ?? note.updatedAt,
        };
        return updated;
      }),
    }));
    persistNotes(get());
    return updated;
  },
  setSyncState(id, syncState) {
    set((state) => ({
      notes: state.notes.map((note) => (note.id === id ? { ...note, syncState } : note)),
    }));
  },
  removeNote(id) {
    set((state) => {
      const notes = state.notes.filter((note) => note.id !== id);
      return {
        notes,
        detailsOpen: state.selectedNoteId === id ? false : state.detailsOpen,
        selectedNoteId:
          state.selectedNoteId === id
            ? notes.find((note) => !note.isArchived && !note.isDeleted)?.id ?? null
            : state.selectedNoteId,
      };
    });
    persistNotes(get());
  },
  receiveNote(incoming) {
    set((state) => {
      const existing = state.notes.find((note) => note.id === incoming.id);
      if (existing?.syncState === "saving") return state;
      if (existing && new Date(existing.updatedAt) >= new Date(incoming.updatedAt)) return state;
      return {
        notes: existing
          ? state.notes.map((note) => (note.id === incoming.id ? incoming : note))
          : [incoming, ...state.notes],
      };
    });
  },
  createFolder(name = "New folder") {
    const now = new Date().toISOString();
    const folder: NoteFolder = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 80) || "New folder",
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ folders: [...state.folders, folder] }));
    persistFolders(get());
    return folder;
  },
  renameFolder(id, name) {
    let updated: NoteFolder | undefined;
    const nextName = name.trim().slice(0, 80) || "Untitled folder";
    set((state) => ({
      folders: state.folders.map((folder) => {
        if (folder.id !== id) return folder;
        updated = { ...folder, name: nextName, updatedAt: new Date().toISOString() };
        return updated;
      }),
    }));
    persistFolders(get());
    return updated;
  },
  deleteFolder(id) {
    set((state) => ({
      folders: state.folders.filter((folder) => folder.id !== id),
      notes: state.notes.map((note) => (note.folderId === id ? { ...note, folderId: null } : note)),
    }));
    persistFolders(get());
    persistNotes(get());
  },
  moveNoteToFolder(noteId, folderId) {
    let updated: Note | undefined;
    const validFolder = folderId === null || get().folders.some((folder) => folder.id === folderId);
    if (!validFolder) return undefined;
    set((state) => ({
      notes: state.notes.map((note) => {
        if (note.id !== noteId) return note;
        updated = { ...note, folderId };
        return updated;
      }),
    }));
    persistNotes(get());
    return updated;
  },
  setSelectedNoteId(id, openEditor = true) {
    const previousPane = get().mobilePane;
    set({ selectedNoteId: id, mobilePane: openEditor && id ? "editor" : get().mobilePane });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("note", id);
      else url.searchParams.delete("note");
      const openingOnMobile =
        Boolean(id && openEditor) &&
        previousPane === "list" &&
        window.matchMedia("(max-width: 700px)").matches;
      if (openingOnMobile) {
        window.history.pushState({ notationPane: "editor" }, "", url);
      } else {
        window.history.replaceState(window.history.state ?? {}, "", url);
      }
    }
  },
  setView(view) {
    const state = get();
    const visible = notesInView(state.notes, view).sort((a, b) => {
      if (view === "all" && a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    const keepCurrent = visible.some((note) => note.id === state.selectedNoteId);
    set({
      view,
      mobilePane: "list",
      detailsOpen: false,
      selectedNoteId: keepCurrent ? state.selectedNoteId : (visible[0]?.id ?? null),
    });
  },
  setSidebarCollapsed(sidebarCollapsed) {
    set({ sidebarCollapsed });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
    }
  },
  setMobilePane: (mobilePane) => set({ mobilePane }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
  requestEditorFocus: () => set((state) => ({ editorFocusRequest: state.editorFocusRequest + 1 })),
  pushToast(toast) {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-3) }));
    return id;
  },
  dismissToast(id) {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

export function createEmptyNote(userId: string, folderId: string | null = null): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    title: "",
    emoji: "🐶",
    folderId,
    content: EMPTY_DOCUMENT,
    plainTextContent: "",
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    attachments: [],
    syncState: "saving",
  };
}
