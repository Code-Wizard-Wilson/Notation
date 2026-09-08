"use client";

import { useCallback } from "react";
import { useWorkspaceStore, createEmptyNote } from "@/store/workspace-store";
import { uploadAttachment, deleteAttachment } from "@/lib/data/notes";
import {
  createWikiLinkLookup,
  markdownFileTitle,
  markdownToNoteDocument,
  splitMarkdownFrontmatter,
} from "@/lib/import/markdown";
import type { Note } from "@/types/note";

function stripMatchingLeadingHeading(markdown: string, title: string) {
  const match = markdown.match(/^\s*#\s+(.+?)\s*(?:\r?\n|$)/);
  if (!match) return markdown;
  const heading = match[1].replace(/\s+#+\s*$/, "").trim();
  return heading.localeCompare(title.trim(), undefined, { sensitivity: "accent" }) === 0
    ? markdown.slice(match[0].length).replace(/^\s*\r?\n/, "")
    : markdown;
}

export function useNotesActions() {
  const user = useWorkspaceStore((state) => state.user);

  const sync = useCallback(async (note: Note) => {
    const store = useWorkspaceStore.getState();
    store.setSyncState(note.id, "saved");
    window.setTimeout(() => {
      const current = useWorkspaceStore.getState().notes.find((item) => item.id === note.id);
      if (current?.syncState === "saved") store.setSyncState(note.id, "idle");
    }, 900);
    return true;
  }, []);

  const createNote = useCallback(() => {
    if (!user) return null;
    const store = useWorkspaceStore.getState();
    const note = createEmptyNote(user.id);
    store.setView("all");
    store.addNote(note);
    store.requestEditorFocus();
    void sync(note);
    return note.id;
  }, [sync, user]);

  const savePatch = useCallback(
    async (id: string, patch: Partial<Note>, touch = true) => {
      const note = useWorkspaceStore.getState().patchNote(id, patch, touch);
      if (!note) return false;
      return sync(note);
    },
    [sync],
  );

  const syncSnapshot = useCallback(
    async (id: string) => {
      const note = useWorkspaceStore.getState().notes.find((item) => item.id === id);
      if (!note) return false;
      return sync(note);
    },
    [sync],
  );

  const importMarkdownFiles = useCallback(
    async (files: File[]) => {
      const store = useWorkspaceStore.getState();
      if (!user) return [] as string[];

      const markdownFiles = files.filter((file) => /\.(?:md|markdown)$/i.test(file.name));
      if (!markdownFiles.length) {
        store.pushToast({ title: "Choose one or more Markdown files", tone: "error" });
        return [] as string[];
      }

      try {
        const sources = await Promise.all(
          markdownFiles.map(async (file) => {
            const parsed = splitMarkdownFrontmatter(await file.text());
            const title = parsed.frontmatter.title?.trim() || markdownFileTitle(file.name);
            const note = createEmptyNote(user.id);
            note.title = title;
            note.emoji = parsed.frontmatter.emoji?.trim() || "🐶";
            return { file, parsed, note };
          }),
        );

        const wikiLookup = createWikiLinkLookup([
          ...store.notes.map((note) => ({ title: note.title, id: note.id })),
          ...sources.map(({ file, note }) => ({ title: note.title, id: note.id, filename: file.name })),
        ]);

        const imported = sources.map(({ parsed, note }) => {
          const body = stripMatchingLeadingHeading(parsed.body, note.title);
          const document = markdownToNoteDocument(body, wikiLookup);
          return {
            ...note,
            ...document,
            syncState: "saving" as const,
          };
        });

        store.setView("all");
        for (const note of imported) store.addNote(note);
        if (imported[0]) store.setSelectedNoteId(imported[0].id);
        await Promise.all(imported.map((note) => sync(note)));

        store.pushToast({
          title: imported.length === 1 ? "Imported 1 Markdown note" : `Imported ${imported.length} Markdown notes`,
        });
        return imported.map((note) => note.id);
      } catch (error) {
        store.pushToast({
          title: error instanceof Error ? `Markdown import failed: ${error.message}` : "Markdown import failed",
          tone: "error",
        });
        return [] as string[];
      }
    },
    [sync, user],
  );

  const selectVisibleFallback = useCallback((excludedId: string) => {
    const store = useWorkspaceStore.getState();
    const next = store.notes.find((note) => {
      if (note.id === excludedId) return false;
      if (store.view === "archive") return note.isArchived && !note.isDeleted;
      if (store.view === "trash") return note.isDeleted;
      if (store.view === "pinned") return note.isPinned && !note.isArchived && !note.isDeleted;
      return !note.isArchived && !note.isDeleted;
    });
    store.setSelectedNoteId(next?.id ?? null, false);
    if (!next && typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches) {
      store.setMobilePane("list");
    }
  }, []);

  const togglePin = useCallback(
    async (id: string) => {
      const store = useWorkspaceStore.getState();
      const current = store.notes.find((note) => note.id === id);
      if (!current) return;
      await savePatch(id, { isPinned: !current.isPinned });
      if (store.view === "pinned" && current.isPinned) selectVisibleFallback(id);
    },
    [savePatch, selectVisibleFallback],
  );

  const archiveNote = useCallback(
    async (id: string) => {
      const store = useWorkspaceStore.getState();
      const original = store.notes.find((note) => note.id === id);
      if (!original) return;
      await savePatch(id, { isArchived: true, isPinned: false });
      selectVisibleFallback(id);
      store.pushToast({
        title: "Note archived",
        actionLabel: "Undo",
        onAction: () => {
          void savePatch(id, { isArchived: original.isArchived, isPinned: original.isPinned });
          store.setSelectedNoteId(id);
        },
      });
    },
    [savePatch, selectVisibleFallback],
  );

  const restoreNote = useCallback(
    async (id: string) => {
      const store = useWorkspaceStore.getState();
      const note = store.notes.find((item) => item.id === id);
      if (!note) return;
      await savePatch(id, {
        isArchived: false,
        isDeleted: false,
        deletedAt: null,
      });
      store.setView("all");
      store.setSelectedNoteId(id);
      store.pushToast({ title: "Note restored" });
    },
    [savePatch],
  );

  const trashNote = useCallback(
    async (id: string) => {
      const store = useWorkspaceStore.getState();
      const original = store.notes.find((note) => note.id === id);
      if (!original) return;
      await savePatch(id, {
        isDeleted: true,
        isPinned: false,
        deletedAt: new Date().toISOString(),
      });
      selectVisibleFallback(id);
      store.pushToast({
        title: "Note moved to Trash",
        actionLabel: "Undo",
        onAction: () => {
          void savePatch(id, {
            isDeleted: original.isDeleted,
            isPinned: original.isPinned,
            deletedAt: original.deletedAt,
          });
          store.setSelectedNoteId(id);
        },
      });
    },
    [savePatch, selectVisibleFallback],
  );

  const deleteForever = useCallback(
    async (id: string) => {
      const store = useWorkspaceStore.getState();
      const note = store.notes.find((item) => item.id === id);
      if (!note) return false;
      store.removeNote(id);
      return true;
    },
    [],
  );

  const addAttachment = useCallback(
    async (noteId: string, file: File, onProgress?: (value: number) => void) => {
      const store = useWorkspaceStore.getState();
      const note = store.notes.find((item) => item.id === noteId);
      if (!note) throw new Error("Open a note before adding a file.");
      const attachment = await uploadAttachment({ note, file, onProgress });
      const updated = store.patchNote(
        noteId,
        { attachments: [...note.attachments, attachment] },
        false,
      );
      if (updated) await sync(updated);
      return attachment;
    },
    [sync],
  );

  const removeAttachment = useCallback(
    async (noteId: string, attachmentId: string) => {
      const store = useWorkspaceStore.getState();
      const note = store.notes.find((item) => item.id === noteId);
      const attachment = note?.attachments.find((item) => item.id === attachmentId);
      if (!note || !attachment) return;
      await deleteAttachment(attachment);
      const updated = store.patchNote(
        noteId,
        { attachments: note.attachments.filter((item) => item.id !== attachmentId) },
        false,
      );
      if (updated) await sync(updated);
    },
    [sync],
  );

  const duplicateNote = useCallback(
    async (id: string) => {
      const store = useWorkspaceStore.getState();
      const source = store.notes.find((note) => note.id === id);
      if (!source || !user) return null;

      const now = new Date().toISOString();
      const duplicate: Note = {
        ...source,
        id: crypto.randomUUID(),
        userId: user.id,
        title: `${source.title.trim() || "Untitled"} copy`,
        content: structuredClone(source.content),
        isPinned: false,
        isArchived: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        // Do not share attachment ownership records between two notes. Embedded
        // image content remains visible, but future attachment mutations belong
        // only to the new note.
        attachments: [],
        syncState: "saving",
      };

      store.setView("all");
      store.addNote(duplicate);
      await sync(duplicate);
      store.pushToast({ title: "Note duplicated" });
      return duplicate.id;
    },
    [sync, user],
  );

  const copyNoteLink = useCallback(async (id: string) => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("note", id);
    await navigator.clipboard.writeText(url.toString());
    useWorkspaceStore.getState().pushToast({ title: "Note link copied" });
  }, []);

  return {
    createNote,
    importMarkdownFiles,
    savePatch,
    syncSnapshot,
    togglePin,
    archiveNote,
    restoreNote,
    trashNote,
    deleteForever,
    addAttachment,
    removeAttachment,
    duplicateNote,
    copyNoteLink,
  };
}
