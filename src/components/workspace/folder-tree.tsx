"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FilePlus2, FileText, Folder, FolderPlus, MoreHorizontal, Pencil, Pin, Trash2 } from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "@/components/interior/context-menu";
import { NoteContextMenu } from "@/components/workspace/note-context-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useNotesActions } from "@/hooks/use-notes-actions";
import { cn, getNoteDisplayTitle } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Note, NoteFolder } from "@/types/note";

type FolderTreeProps = {
  mode?: "sidebar" | "list";
};

const SIDEBAR_ROW = 36;
const LIST_ROW = 36;
const PAD = 6;
const TRUNK = 14;
const RADIUS = 10;

function noteSort(a: Note, b: Note) {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function branchPath(index: number, rowHeight: number, indent: number) {
  const y = PAD + index * rowHeight + rowHeight / 2;
  const endX = indent - 8;
  return `M ${TRUNK} ${y - RADIUS} A ${RADIUS} ${RADIUS} 0 0 0 ${TRUNK + RADIUS} ${y} H ${endX}`;
}

function reachPath(index: number, rowHeight: number, indent: number) {
  const y = PAD + index * rowHeight + rowHeight / 2;
  const endX = indent - 8;
  return `M ${TRUNK} 0 V ${y - RADIUS} A ${RADIUS} ${RADIUS} 0 0 0 ${TRUNK + RADIUS} ${y} H ${endX}`;
}

function reachLength(index: number, rowHeight: number, indent: number) {
  const y = PAD + index * rowHeight + rowHeight / 2;
  const endX = indent - 8;
  return y - RADIUS + (Math.PI * RADIUS) / 2 + (endX - TRUNK - RADIUS);
}

function FolderMenu({
  folder,
  children,
  onRename,
  onDelete,
}: {
  folder: NoteFolder;
  children: React.ReactNode;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { createNoteInFolder } = useNotesActions();
  const items: ContextMenuItem[] = [
    {
      id: "new-note",
      label: "New note in folder",
      icon: <FilePlus2 size={15} />,
      onSelect: () => createNoteInFolder(folder.id),
    },
    {
      id: "rename",
      label: "Rename folder",
      icon: <Pencil size={15} />,
      onSelect: onRename,
    },
    { id: "divider", type: "separator" },
    {
      id: "delete",
      label: "Delete folder",
      icon: <Trash2 size={15} />,
      onSelect: onDelete,
    },
  ];

  return (
    <ContextMenu items={items} label={`Actions for ${folder.name}`} width={214} className="folder-context-anchor">
      {children}
    </ContextMenu>
  );
}

export function FolderTree({ mode = "sidebar" }: FolderTreeProps) {
  const folders = useWorkspaceStore((state) => state.folders);
  const notes = useWorkspaceStore((state) => state.notes);
  const selectedId = useWorkspaceStore((state) => state.selectedNoteId);
  const setSelected = useWorkspaceStore((state) => state.setSelectedNoteId);
  const createFolder = useWorkspaceStore((state) => state.createFolder);
  const renameFolder = useWorkspaceStore((state) => state.renameFolder);
  const deleteFolder = useWorkspaceStore((state) => state.deleteFolder);
  const pushToast = useWorkspaceStore((state) => state.pushToast);
  const { createNoteInFolder, moveNoteToFolder, savePatch, togglePin } = useNotesActions();

  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set(folders.map((folder) => folder.id)));
  const [creating, setCreating] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [noteRenameDraft, setNoteRenameDraft] = useState("");
  const createInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const noteRenameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) createInputRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (mode !== "sidebar") return;
    const create = () => {
      setFolderDraft("");
      setCreating(true);
    };
    window.addEventListener("notation:new-folder", create);
    return () => window.removeEventListener("notation:new-folder", create);
  }, [mode]);

  useEffect(() => {
    if (!renamingId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renamingId]);


  useEffect(() => {
    if (!renamingNoteId) return;
    noteRenameInputRef.current?.focus();
    noteRenameInputRef.current?.select();
  }, [renamingNoteId]);

  const activeNotes = useMemo(
    () => notes.filter((note) => !note.isArchived && !note.isDeleted),
    [notes],
  );

  const selectedFolderId = activeNotes.find((note) => note.id === selectedId)?.folderId ?? null;
  const rowHeight = mode === "sidebar" ? SIDEBAR_ROW : LIST_ROW;
  const indent = 40;

  function toggleFolder(id: string) {
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submitFolder() {
    const name = folderDraft.trim();
    if (!name) return;
    const folder = createFolder(name);
    setOpenFolders((current) => new Set(current).add(folder.id));
    setFolderDraft("");
    setCreating(false);
  }

  function beginRename(folder: NoteFolder) {
    setRenamingId(folder.id);
    setRenameDraft(folder.name);
    setOpenFolders((current) => new Set(current).add(folder.id));
  }

  function saveRename(folder: NoteFolder) {
    const name = renameDraft.trim();
    renameFolder(folder.id, name || folder.name);
    setRenamingId(null);
    setRenameDraft("");
  }

  function beginNoteRename(note: Note) {
    setSelected(note.id);
    setRenamingNoteId(note.id);
    setNoteRenameDraft(getNoteDisplayTitle(note));
  }

  async function saveNoteRename(note: Note) {
    const title = noteRenameDraft.trim().slice(0, 120) || "Untitled";
    setRenamingNoteId(null);
    setNoteRenameDraft("");
    if (title === getNoteDisplayTitle(note)) return;
    await savePatch(note.id, { title });
  }

  function removeFolder(folder: NoteFolder) {
    const count = activeNotes.filter((note) => note.folderId === folder.id).length;
    deleteFolder(folder.id);
    if (renamingId === folder.id) setRenamingId(null);
    pushToast({
      title: count > 0
        ? `Deleted ${folder.name}; ${count} ${count === 1 ? "note" : "notes"} moved to All notes`
        : `Deleted ${folder.name}`,
    });
  }

  function dispatchFolderMenu(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.closest(".folder-context-anchor")?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: Math.round(rect.right),
        clientY: Math.round(rect.bottom),
      }),
    );
  }

  return (
    <section className={cn("folder-library", `folder-library--${mode}`)} aria-label="Folders">
      {mode === "list" && (
        <div className="folder-library-head">
          <span>Folders</span>
          <Tooltip label="New folder" side="bottom">
            <button
              type="button"
              className="folder-library-add"
              aria-label="New folder"
              onClick={() => {
                setCreating(true);
                setFolderDraft("");
              }}
            >
              <FolderPlus size={14} />
            </button>
          </Tooltip>
        </div>
      )}

      {creating && (
        <form
          className="folder-create-row"
          onSubmit={(event) => {
            event.preventDefault();
            submitFolder();
          }}
        >
          <Folder size={14} aria-hidden="true" />
          <input
            ref={createInputRef}
            value={folderDraft}
            maxLength={80}
            placeholder="Folder name"
            aria-label="Folder name"
            onChange={(event) => setFolderDraft(event.target.value)}
            onBlur={() => {
              if (folderDraft.trim()) submitFolder();
              else setCreating(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setCreating(false);
                setFolderDraft("");
              }
            }}
          />
        </form>
      )}

      {folders.length > 0 ? (
        <div className="folder-branch-menu">
          {folders.map((folder) => {
            const folderNotes = activeNotes.filter((note) => note.folderId === folder.id).sort(noteSort);
            const isOpen = openFolders.has(folder.id);
            const isActiveFolder = selectedFolderId === folder.id;
            const bodyHeight = PAD * 2 + folderNotes.length * rowHeight;

            return (
              <FolderMenu
                key={folder.id}
                folder={folder}
                onRename={() => beginRename(folder)}
                onDelete={() => removeFolder(folder)}
              >
                <div className={cn("folder-branch-section", isOpen && "is-open", isActiveFolder && "is-active-folder")}>
                  {renamingId === folder.id ? (
                    <div className="folder-branch-head folder-branch-head--renaming">
                      <input
                        ref={renameInputRef}
                        className="folder-rename-input"
                        value={renameDraft}
                        maxLength={80}
                        aria-label={`Rename ${folder.name}`}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onBlur={() => saveRename(folder)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            saveRename(folder);
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            setRenamingId(null);
                            setRenameDraft("");
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className="folder-branch-head-wrap"
                      onDragOver={(event) => {
                        if (event.dataTransfer.types.includes("application/x-notation-note")) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        const noteId = event.dataTransfer.getData("application/x-notation-note");
                        if (!noteId) return;
                        event.preventDefault();
                        void moveNoteToFolder(noteId, folder.id);
                        setOpenFolders((current) => new Set(current).add(folder.id));
                      }}
                    >
                      <button
                        type="button"
                        className="folder-branch-head"
                        aria-expanded={isOpen}
                        onClick={() => toggleFolder(folder.id)}
                      >
                        <span className="folder-branch-name">{folder.name}</span>
                        <span className="folder-branch-count">{folderNotes.length}</span>
                      </button>
                      <div className="folder-branch-actions">
                        <Tooltip label="New note in folder" side="top">
                          <button
                            type="button"
                            aria-label={`New note in ${folder.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenFolders((current) => new Set(current).add(folder.id));
                              createNoteInFolder(folder.id);
                            }}
                          >
                            <FilePlus2 size={13} />
                          </button>
                        </Tooltip>
                        <button
                          type="button"
                          aria-label={`More actions for ${folder.name}`}
                          onClick={dispatchFolderMenu}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="folder-branch-body" aria-hidden={!isOpen} inert={!isOpen ? true : undefined}>
                    <div className="folder-branch-fold">
                      {folderNotes.length > 0 ? (
                        <div
                          className="folder-branch-tree"
                          style={{
                            height: bodyHeight,
                            ["--folder-row" as string]: `${rowHeight}px`,
                            ["--folder-indent" as string]: `${indent}px`,
                          }}
                        >
                          <svg className="folder-branch-lines" width={indent} height={bodyHeight} aria-hidden="true">
                            <path
                              className="folder-branch-line-base"
                              d={`M ${TRUNK} 0 V ${PAD + (folderNotes.length - 1) * rowHeight + rowHeight / 2 - RADIUS}`}
                            />
                            {folderNotes.map((note, index) => (
                              <path key={`base:${note.id}`} className="folder-branch-line-base" d={branchPath(index, rowHeight, indent)} />
                            ))}
                            {folderNotes.map((note, index) => {
                              const length = reachLength(index, rowHeight, indent);
                              return (
                                <path
                                  key={`reach:${note.id}`}
                                  className="folder-branch-line-active"
                                  d={reachPath(index, rowHeight, indent)}
                                  style={{
                                    strokeDasharray: length,
                                    strokeDashoffset: note.id === selectedId ? 0 : length,
                                  }}
                                />
                              );
                            })}
                          </svg>

                          {folderNotes.map((note) => (
                            <NoteContextMenu key={note.id} note={note} onRename={() => beginNoteRename(note)}>
                              <div className="folder-note-row">
                                {renamingNoteId === note.id ? (
                                  <div className={cn("folder-note-item", "is-renaming", selectedId === note.id && "is-selected")}>
                                    <FileText size={15} aria-hidden="true" />
                                    <input
                                      ref={noteRenameInputRef}
                                      className="folder-note-rename-input"
                                      value={noteRenameDraft}
                                      maxLength={120}
                                      aria-label={`Rename ${getNoteDisplayTitle(note)}`}
                                      onChange={(event) => setNoteRenameDraft(event.target.value)}
                                      onBlur={() => void saveNoteRename(note)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          void saveNoteRename(note);
                                        } else if (event.key === "Escape") {
                                          event.preventDefault();
                                          setRenamingNoteId(null);
                                          setNoteRenameDraft("");
                                        }
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className={cn("folder-note-item", selectedId === note.id && "is-selected")}
                                    aria-current={selectedId === note.id ? "page" : undefined}
                                    draggable={mode === "sidebar"}
                                    onDragStart={(event) => {
                                      event.dataTransfer.effectAllowed = "move";
                                      event.dataTransfer.setData("application/x-notation-note", note.id);
                                    }}
                                    onClick={() => setSelected(note.id)}
                                    onDoubleClick={() => beginNoteRename(note)}
                                  >
                                    <FileText size={15} aria-hidden="true" />
                                    <span>{getNoteDisplayTitle(note)}</span>
                                  </button>
                                )}
                                {renamingNoteId !== note.id && note.isPinned && (
                                  <span className="folder-note-pinned-indicator" aria-label="Pinned note">
                                    <Pin size={13} fill="currentColor" />
                                  </span>
                                )}
                                {renamingNoteId !== note.id && (
                                  <div className="folder-note-hover-actions" aria-label={`Actions for ${getNoteDisplayTitle(note)}`}>
                                    <button
                                      type="button"
                                      className={cn("folder-note-quick-action", note.isPinned && "is-active")}
                                      aria-label={note.isPinned ? "Unpin note" : "Pin note"}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        event.currentTarget.blur();
                                        void togglePin(note.id);
                                      }}
                                    >
                                      <Pin size={14} fill={note.isPinned ? "currentColor" : "none"} />
                                    </button>
                                    <button
                                      type="button"
                                      className="folder-note-quick-action"
                                      aria-label="More actions"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        event.currentTarget.blur();
                                        const rect = event.currentTarget.getBoundingClientRect();
                                        event.currentTarget.closest(".note-context-anchor")?.dispatchEvent(
                                          new MouseEvent("contextmenu", {
                                            bubbles: true,
                                            cancelable: true,
                                            clientX: Math.round(rect.right),
                                            clientY: Math.round(rect.bottom),
                                          }),
                                        );
                                      }}
                                    >
                                      <MoreHorizontal size={15} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </NoteContextMenu>
                          ))}
                        </div>
                      ) : (
                        <div className="folder-branch-empty">
                          <button type="button" onClick={() => createNoteInFolder(folder.id)}>Add a note</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </FolderMenu>
            );
          })}
        </div>
      ) : mode === "list" && !creating ? (
        <button
          type="button"
          className="folder-library-empty"
          onClick={() => {
            setCreating(true);
            setFolderDraft("");
          }}
        >
          Organize notes into folders
        </button>
      ) : null}
    </section>
  );
}
