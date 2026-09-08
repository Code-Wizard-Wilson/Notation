"use client";

import { create } from "zustand";
import { EMPTY_DOCUMENT, SIDEBAR_KEY } from "@/lib/constants";
import { readLocalNotes, writeLocalNotes } from "@/lib/data/local";
import type { Note, NotesView, ToastMessage, WorkspaceUser } from "@/types/note";

type MobilePane = "list" | "editor";

type WorkspaceState = {
  initialized: boolean;
  user: WorkspaceUser | null;
  localMode: boolean;
  notes: Note[];
  selectedNoteId: string | null;
  view: NotesView;
  sidebarCollapsed: boolean;
  mobilePane: MobilePane;
  commandOpen: boolean;
  settingsOpen: boolean;
  detailsOpen: boolean;
  isOffline: boolean;
  editorFocusRequest: number;
  toasts: ToastMessage[];
  initialize: (notes: Note[], user: WorkspaceUser, localMode: boolean) => void;
  addNote: (note: Note) => void;
  patchNote: (id: string, patch: Partial<Note>, touch?: boolean) => Note | undefined;
  setSyncState: (id: string, state: Note["syncState"]) => void;
  removeNote: (id: string) => void;
  receiveNote: (note: Note) => void;
  setSelectedNoteId: (id: string | null, openEditor?: boolean) => void;
  setView: (view: NotesView) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobilePane: (pane: MobilePane) => void;
  setCommandOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setDetailsOpen: (open: boolean) => void;
  setOffline: (offline: boolean) => void;
  requestEditorFocus: () => void;
  pushToast: (toast: Omit<ToastMessage, "id">) => string;
  dismissToast: (id: string) => void;
};

function persistIfLocal(state: Pick<WorkspaceState, "localMode" | "notes">) {
  if (state.localMode) writeLocalNotes(state.notes);
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
  localMode: false,
  notes: [],
  selectedNoteId: null,
  view: "all",
  sidebarCollapsed: false,
  mobilePane: "list",
  commandOpen: false,
  settingsOpen: false,
  detailsOpen: false,
  isOffline: false,
  editorFocusRequest: 0,
  toasts: [],
  initialize(notes, user, localMode) {
    const hydratedNotes = localMode ? readLocalNotes(notes) : notes;
    const storedSidebar =
      typeof window !== "undefined" && window.localStorage.getItem(SIDEBAR_KEY) === "true";
    const requestedNote =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("note")
        : null;
    const selected =
      (requestedNote && hydratedNotes.some((note) => note.id === requestedNote)
        ? requestedNote
        : hydratedNotes.find((note) => !note.isArchived && !note.isDeleted)?.id) ?? null;

    set({
      initialized: true,
      notes: hydratedNotes,
      user,
      localMode,
      selectedNoteId: selected,
      sidebarCollapsed: storedSidebar,
      isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
    });
  },
  addNote(note) {
    set((state) => ({ notes: [note, ...state.notes], selectedNoteId: note.id, mobilePane: "editor" }));
    persistIfLocal(get());
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
    persistIfLocal(get());
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
    persistIfLocal(get());
  },
  receiveNote(incoming) {
    set((state) => {
      const existing = state.notes.find((note) => note.id === incoming.id);
      if (existing?.syncState === "saving" || existing?.syncState === "offline") return state;
      if (existing && new Date(existing.updatedAt) >= new Date(incoming.updatedAt)) return state;
      return {
        notes: existing
          ? state.notes.map((note) => (note.id === incoming.id ? incoming : note))
          : [incoming, ...state.notes],
      };
    });
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
  setOffline: (isOffline) => set({ isOffline }),
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

export function createEmptyNote(userId: string): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    title: "",
    emoji: "🐶",
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
