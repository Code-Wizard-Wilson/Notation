"use client";

import { useMemo } from "react";
import {
  Archive,
  FilePlus2,
  FileText,
  ImagePlus,
  Link2,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
} from "lucide-react";
import {
  CommandPalette as InteriorCommandPalette,
  type CommandItem,
} from "@/components/interior/command-palette";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useNotesActions } from "@/hooks/use-notes-actions";
import { getNoteDisplayTitle, getNotePreview } from "@/lib/utils";

const iconProps = { size: 18, strokeWidth: 1.7 } as const;

export function CommandPalette() {
  const open = useWorkspaceStore((state) => state.commandOpen);
  const notes = useWorkspaceStore((state) => state.notes);
  const folders = useWorkspaceStore((state) => state.folders);
  const selectedId = useWorkspaceStore((state) => state.selectedNoteId);
  const setOpen = useWorkspaceStore((state) => state.setCommandOpen);
  const setSelected = useWorkspaceStore((state) => state.setSelectedNoteId);
  const setView = useWorkspaceStore((state) => state.setView);
  const setSettingsOpen = useWorkspaceStore((state) => state.setSettingsOpen);
  const { createNote, togglePin, archiveNote, restoreNote, trashNote, copyNoteLink } = useNotesActions();

  const current = notes.find((note) => note.id === selectedId);

  const { items, actions } = useMemo(() => {
    const actionMap = new Map<string, () => void>();
    const next: CommandItem[] = [];

    const recent = [...notes]
      .filter((note) => !note.isDeleted)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    for (const note of recent) {
      const id = `note:${note.id}`;
      const folderName = note.folderId ? folders.find((folder) => folder.id === note.folderId)?.name : null;
      const state = note.isArchived ? "Archive" : note.isPinned ? "Pinned" : folderName ?? "Note";
      const Icon = note.isArchived ? Archive : note.isPinned ? Pin : FileText;
      next.push({
        id,
        label: getNoteDisplayTitle(note),
        meta: state,
        hint: getNotePreview(note),
        icon: <Icon {...iconProps} />,
        keywords: [
          getNoteDisplayTitle(note),
          note.plainTextContent,
          folderName ?? "",
          note.attachments.map((attachment) => attachment.filename).join(" "),
        ].join(" "),
      });
      actionMap.set(id, () => {
        setView(note.isArchived ? "archive" : note.isPinned ? "pinned" : "all");
        setSelected(note.id);
      });
    }

    const add = (item: CommandItem, action: () => void) => {
      next.push({ meta: "Command", ...item });
      actionMap.set(item.id, action);
    };

    add(
      {
        id: "new",
        label: "New note",
        hint: "Create a blank note",
        keywords: "create add note",
        shortcut: ["⌘", "D"],
        icon: <Plus {...iconProps} />,
      },
      createNote,
    );

    if (current && !current.isDeleted && !current.isArchived) {
      add(
        {
          id: "pin",
          label: current.isPinned ? "Unpin current note" : "Pin current note",
          hint: current.isPinned ? "Remove from quick access" : "Keep in quick access",
          keywords: "pin unpin current note",
          shortcut: ["⇧", "⌘", "P"],
          icon: current.isPinned ? <PinOff {...iconProps} /> : <Pin {...iconProps} />,
        },
        () => void togglePin(current.id),
      );
    }

    if (current && !current.isDeleted) {
      add(
        {
          id: current.isArchived ? "restore" : "archive",
          label: current.isArchived ? "Restore current note" : "Archive current note",
          hint: current.isArchived ? "Return note to the library" : "Move note out of the active list",
          keywords: "archive restore current note",
          icon: current.isArchived ? <RotateCcw {...iconProps} /> : <Archive {...iconProps} />,
        },
        () => void (current.isArchived ? restoreNote(current.id) : archiveNote(current.id)),
      );
    }

    if (current && !current.isDeleted && !current.isArchived) {
      add(
        {
          id: "image",
          label: "Insert image",
          hint: "Add an image to the current note",
          keywords: "image photo insert upload",
          icon: <ImagePlus {...iconProps} />,
        },
        () => window.dispatchEvent(new CustomEvent("notation:pick-image")),
      );
      add(
        {
          id: "file",
          label: "Attach file",
          hint: "Attach a file to the current note",
          keywords: "file attachment upload",
          icon: <FilePlus2 {...iconProps} />,
        },
        () => window.dispatchEvent(new CustomEvent("notation:pick-file")),
      );
    }

    if (current) {
      add(
        {
          id: "copy",
          label: "Copy note link",
          hint: "Copy a direct link to this note",
          keywords: "copy link url",
          icon: <Link2 {...iconProps} />,
        },
        () => void copyNoteLink(current.id),
      );
    }

    if (current && !current.isDeleted) {
      add(
        {
          id: "trash",
          label: "Move current note to Trash",
          hint: "Remove it from the library",
          keywords: "delete trash remove note",
          icon: <Trash2 {...iconProps} />,
        },
        () => void trashNote(current.id),
      );
    }

    add(
      { id: "open-archive", label: "Open Archive", hint: "View archived notes", keywords: "archive library", icon: <Archive {...iconProps} /> },
      () => setView("archive"),
    );
    add(
      { id: "open-trash", label: "Open Trash", hint: "View deleted notes", keywords: "trash deleted notes", icon: <Trash2 {...iconProps} /> },
      () => setView("trash"),
    );
    add(
      { id: "settings", label: "Open settings", hint: "Workspace preferences", keywords: "settings preferences options", icon: <Settings {...iconProps} /> },
      () => setSettingsOpen(true),
    );

    return { items: next, actions: actionMap };
  }, [archiveNote, copyNoteLink, createNote, current, folders, notes, restoreNote, setSelected, setSettingsOpen, setView, togglePin, trashNote]);

  return (
    <InteriorCommandPalette
      open={open}
      autoFocus={open}
      items={items}
      maxRows={4}
      label="Search notes or run a command"
      placeholder="Search notes or commands…"
      emptyLabel="No note or command matches"
      onDismiss={() => setOpen(false)}
      onSelect={(item) => {
        setOpen(false);
        actions.get(item.id)?.();
      }}
    />
  );
}
