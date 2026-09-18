"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  PanelLeft,
  FileText,
  FolderPlus,
  MoreHorizontal,
  Pin,
  Search,
  Settings,
  SquarePen,
  Trash2,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { shortcutLabel, cn, getNoteDisplayTitle } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useNotesActions } from "@/hooks/use-notes-actions";
import { Tooltip } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NoteContextMenu } from "@/components/workspace/note-context-menu";
import { FolderTree } from "@/components/workspace/folder-tree";
import type { NotesView } from "@/types/note";

const entries: Array<{ id: NotesView; label: string; icon: typeof FileText }> = [
  { id: "all", label: "All notes", icon: FileText },
  { id: "pinned", label: "Pinned", icon: Pin },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "trash", label: "Trash", icon: Trash2 },
];

export function Navigation() {
  const collapsed = useWorkspaceStore((state) => state.sidebarCollapsed);
  const view = useWorkspaceStore((state) => state.view);
  const notes = useWorkspaceStore((state) => state.notes);
  const folders = useWorkspaceStore((state) => state.folders);
  const selectedId = useWorkspaceStore((state) => state.selectedNoteId);
  const user = useWorkspaceStore((state) => state.user);
  const setCollapsed = useWorkspaceStore((state) => state.setSidebarCollapsed);
  const setSelected = useWorkspaceStore((state) => state.setSelectedNoteId);
  const setView = useWorkspaceStore((state) => state.setView);
  const setCommandOpen = useWorkspaceStore((state) => state.setCommandOpen);
  const setSettingsOpen = useWorkspaceStore((state) => state.setSettingsOpen);
  const { createNote, savePatch, restoreNote, deleteForever, togglePin } = useNotesActions();

  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [noteNameDraft, setNoteNameDraft] = useState("");
  const noteNameInputRef = useRef<HTMLInputElement>(null);
  const cancelRenameRef = useRef(false);
  const lastTouchTapRef = useRef<{ id: string; at: number } | null>(null);

  useEffect(() => {
    if (!renamingNoteId) return;
    noteNameInputRef.current?.focus();
    noteNameInputRef.current?.select();
  }, [renamingNoteId]);

  const visibleNotes = notes
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

  const rootVisibleNotes = view === "all" ? visibleNotes.filter((note) => !note.folderId) : visibleNotes;
  const unfiledActiveIndex = view === "all" ? rootVisibleNotes.findIndex((note) => note.id === selectedId) : -1;

  function startNoteRename(id: string, title: string) {
    cancelRenameRef.current = false;
    setSelected(id);
    setNoteNameDraft(title || "Untitled");
    setRenamingNoteId(id);
  }

  async function saveNoteRename(id: string) {
    if (cancelRenameRef.current) return;
    const title = noteNameDraft.trim().slice(0, 120) || "Untitled";
    setRenamingNoteId(null);
    setNoteNameDraft("");
    await savePatch(id, { title });
  }

  function cancelNoteRename() {
    cancelRenameRef.current = true;
    setRenamingNoteId(null);
    setNoteNameDraft("");
    window.requestAnimationFrame(() => {
      cancelRenameRef.current = false;
    });
  }

  function handleTouchTap(id: string, title: string, pointerType: string) {
    if (pointerType === "mouse") return;
    const now = Date.now();
    const last = lastTouchTapRef.current;
    if (last?.id === id && now - last.at <= 340) {
      lastTouchTapRef.current = null;
      startNoteRename(id, title);
      return;
    }
    lastTouchTapRef.current = { id, at: now };
  }

  async function confirmDeleteNote() {
    if (!deleteNoteId) return;
    const id = deleteNoteId;
    setDeleteNoteId(null);
    await deleteForever(id);
  }

  async function confirmDeleteAll() {
    setDeleteAllOpen(false);
    const ids = notes.filter((note) => note.isDeleted).map((note) => note.id);
    for (const id of ids) await deleteForever(id);
  }

  return (
    <>
      <aside
        className={cn("desktop-navigation", collapsed && "is-collapsed")}
        aria-label="Workspace navigation"
      >
        <div className="navigation-head">
          <div className="workspace-identity" aria-hidden={collapsed}>
            <span className="identity-mark workspace-favicon" aria-hidden="true" />
            <span className="workspace-name">{APP_NAME}</span>
          </div>
          <Tooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} side={collapsed ? "right" : "bottom"}>
            <button
              className="nav-collapse sidebar-toggle"
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              <PanelLeft size={18} strokeWidth={1.8} />
            </button>
          </Tooltip>
        </div>

        <nav className="navigation-main">
          <Tooltip label="New note" shortcut={shortcutLabel("⌘D")} side="right" disabled={!collapsed}>
            <button className="new-note-control" type="button" onClick={createNote}>
              <SquarePen size={17} />
              <span className="nav-copy">New note</span>
              <kbd className="nav-shortcut">{shortcutLabel("⌘D")}</kbd>
            </button>
          </Tooltip>

          <Tooltip label="Search" shortcut={shortcutLabel("⌘K")} side="right" disabled={!collapsed}>
            <button className="nav-entry" type="button" onClick={() => setCommandOpen(true)}>
              <Search size={17} />
              <span className="nav-copy">Search</span>
              <kbd className="nav-shortcut">{shortcutLabel("⌘K")}</kbd>
            </button>
          </Tooltip>

          {collapsed && (
            <div className="collapsed-view-rail" aria-label="Note views">
              {entries.map((entry) => {
                const Icon = entry.icon;
                return (
                  <Tooltip key={entry.id} label={entry.label} side="right">
                    <button
                      type="button"
                      className={cn("collapsed-view-button", view === entry.id && "is-active")}
                      aria-label={entry.label}
                      aria-pressed={view === entry.id}
                      onClick={() => setView(entry.id)}
                    >
                      <Icon size={18} />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          )}

          <section
            className={cn("sidebar-notes", collapsed && "is-collapsed-content")}
            aria-label={`${entries.find((entry) => entry.id === view)?.label ?? "Notes"} notes`}
            aria-hidden={collapsed}
            inert={collapsed ? true : undefined}
          >
            <div className="sidebar-notes-head">
              <span>{entries.find((entry) => entry.id === view)?.label ?? "Notes"}</span>
              <div className="sidebar-notes-head-actions">
                <small>{visibleNotes.length}</small>
                {view === "all" && (
                  <Tooltip label="New folder" side="top">
                    <button
                      type="button"
                      className="sidebar-new-folder"
                      aria-label="New folder"
                      onClick={() => window.dispatchEvent(new CustomEvent("notation:new-folder"))}
                    >
                      <FolderPlus size={14} />
                    </button>
                  </Tooltip>
                )}
                {view === "trash" && visibleNotes.length > 0 && (
                  <Tooltip label="Delete all forever" side="top">
                    <button
                      type="button"
                      className="trash-delete-all"
                      aria-label="Delete all forever"
                      onClick={() => setDeleteAllOpen(true)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>

            <div className="sidebar-notes-scroll">
              {view === "all" ? (
                <>
                  <FolderTree mode="sidebar" />
                  {rootVisibleNotes.length > 0 && (
                    <section className="sidebar-tree-section sidebar-tree-section--unfiled" aria-label="Unfiled notes">
                      <div className="sidebar-tree-heading">Unfiled</div>
                      <div className="sidebar-unfiled-tree" style={{ ["--unfiled-count" as string]: rootVisibleNotes.length }}>
                        <span className="sidebar-unfiled-trunk" aria-hidden="true" />
                        {unfiledActiveIndex >= 0 && (
                          <span
                            className="sidebar-unfiled-active-path"
                            aria-hidden="true"
                            style={{ ["--active-row" as string]: unfiledActiveIndex }}
                          />
                        )}
                        {rootVisibleNotes.map((note) => (
                          <NoteContextMenu key={note.id} note={note}>
                            {renamingNoteId === note.id ? (
                              <div className={cn("sidebar-unfiled-row", "is-renaming", selectedId === note.id && "is-selected")}>
                                <span className="sidebar-unfiled-elbow" aria-hidden="true" />
                                <div className="sidebar-note-item is-renaming">
                                  <FileText size={15} aria-hidden="true" />
                                  <input
                                    ref={noteNameInputRef}
                                    className="sidebar-note-rename-input"
                                    value={noteNameDraft}
                                    maxLength={120}
                                    aria-label={`Rename ${getNoteDisplayTitle(note)}`}
                                    onChange={(event) => setNoteNameDraft(event.target.value)}
                                    onBlur={() => void saveNoteRename(note.id)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void saveNoteRename(note.id);
                                      } else if (event.key === "Escape") {
                                        event.preventDefault();
                                        cancelNoteRename();
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className={cn("sidebar-unfiled-row", selectedId === note.id && "is-selected")}>
                                <span className="sidebar-unfiled-elbow" aria-hidden="true" />
                                <div className="sidebar-note-row">
                                  <button
                                    type="button"
                                    className={cn("sidebar-note-item", selectedId === note.id && "is-selected")}
                                    aria-current={selectedId === note.id ? "page" : undefined}
                                    draggable
                                    onDragStart={(event) => {
                                      event.dataTransfer.effectAllowed = "move";
                                      event.dataTransfer.setData("application/x-notation-note", note.id);
                                    }}
                                    onClick={() => setSelected(note.id)}
                                    onDoubleClick={() => startNoteRename(note.id, getNoteDisplayTitle(note))}
                                    onPointerUp={(event) => handleTouchTap(note.id, getNoteDisplayTitle(note), event.pointerType)}
                                  >
                                    <FileText size={15} aria-hidden="true" />
                                    <span>{getNoteDisplayTitle(note)}</span>
                                  </button>
                                  {note.isPinned && (
                                    <span className="sidebar-note-pinned-indicator" aria-label="Pinned note">
                                      <Pin size={13} fill="currentColor" />
                                    </span>
                                  )}
                                  <div className="sidebar-note-hover-actions" aria-label={`Actions for ${getNoteDisplayTitle(note)}`}>
                                    <button
                                      type="button"
                                      className={cn("sidebar-note-quick-action", note.isPinned && "is-active")}
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
                                      className="sidebar-note-quick-action"
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
                                </div>
                              </div>
                            )}
                          </NoteContextMenu>
                        ))}
                      </div>
                    </section>
                  )}
                  {visibleNotes.length === 0 && <div className="sidebar-notes-empty">No notes yet</div>}
                </>
              ) : rootVisibleNotes.length ? (
                rootVisibleNotes.map((note) =>
                  view === "trash" ? (
                    <div key={note.id} className="sidebar-note-row">
                      <button
                        type="button"
                        className={cn("sidebar-note-item", selectedId === note.id && "is-selected")}
                        aria-current={selectedId === note.id ? "page" : undefined}
                        onClick={() => setSelected(note.id)}
                      >
                        <span>{getNoteDisplayTitle(note)}</span>
                      </button>
                    </div>
                  ) : (
                    <NoteContextMenu key={note.id} note={note}>
                      {renamingNoteId === note.id ? (
                        <div className={cn("sidebar-note-item", "is-renaming", selectedId === note.id && "is-selected")}>
                          <input
                            ref={noteNameInputRef}
                            className="sidebar-note-rename-input"
                            value={noteNameDraft}
                            maxLength={120}
                            aria-label={`Rename ${getNoteDisplayTitle(note)}`}
                            onChange={(event) => setNoteNameDraft(event.target.value)}
                            onBlur={() => void saveNoteRename(note.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void saveNoteRename(note.id);
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                cancelNoteRename();
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="sidebar-note-row">
                          <button
                            type="button"
                            className={cn("sidebar-note-item", selectedId === note.id && "is-selected")}
                            aria-current={selectedId === note.id ? "page" : undefined}
                            onClick={() => setSelected(note.id)}
                            onDoubleClick={() => startNoteRename(note.id, getNoteDisplayTitle(note))}
                            onPointerUp={(event) => handleTouchTap(note.id, getNoteDisplayTitle(note), event.pointerType)}
                          >
                            <span>{getNoteDisplayTitle(note)}</span>
                          </button>
                          {note.isPinned && !note.isArchived && !note.isDeleted && (
                            <span className="sidebar-note-pinned-indicator" aria-label="Pinned note">
                              <Pin size={13} fill="currentColor" />
                            </span>
                          )}
                          {!note.isArchived && !note.isDeleted && (
                            <div className="sidebar-note-hover-actions" aria-label={`Actions for ${getNoteDisplayTitle(note)}`}>
                              <button
                                type="button"
                                className={cn("sidebar-note-quick-action", note.isPinned && "is-active")}
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
                                className="sidebar-note-quick-action"
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
                      )}
                    </NoteContextMenu>
                  ),
                )
              ) : (
                <div className="sidebar-notes-empty">
                  {view === "pinned" ? "No pinned notes" : view === "archive" ? "Archive is empty" : "Trash is empty"}
                </div>
              )}
            </div>
          </section>
        </nav>

        <div className="navigation-foot">
          {!collapsed && (
            <div className="sidebar-view-switcher" aria-label="Note views">
              {entries.map((entry) => {
                const Icon = entry.icon;
                return (
                  <Tooltip key={entry.id} label={entry.label} side="top">
                    <button
                      type="button"
                      className={cn("sidebar-view-button", view === entry.id && "is-active")}
                      aria-label={entry.label}
                      aria-pressed={view === entry.id}
                      onClick={() => setView(entry.id)}
                    >
                      <Icon size={16} />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          )}

          {collapsed ? (
            <Tooltip label="Settings" side="right">
              <button
                className="collapsed-settings-button"
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
              >
                <Settings size={17} />
              </button>
            </Tooltip>
          ) : (
            <Tooltip label="Settings">
              <button className="account-control" type="button" onClick={() => setSettingsOpen(true)}>
                <span className="account-avatar">{user?.email.slice(0, 1).toUpperCase()}</span>
                <span className="account-copy"><strong>Local notes</strong><small>{user?.email}</small></span>
                <Settings className="account-settings-icon" size={15} />
              </button>
            </Tooltip>
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={deleteNoteId !== null}
        title="Delete this note forever?"
        description="This note and its attachments cannot be recovered."
        confirmLabel="Delete forever"
        onConfirm={() => void confirmDeleteNote()}
        onClose={() => setDeleteNoteId(null)}
      />

      <ConfirmDialog
        open={deleteAllOpen}
        title="Delete all notes forever?"
        description={`This will permanently delete ${notes.filter((note) => note.isDeleted).length} ${notes.filter((note) => note.isDeleted).length === 1 ? "note" : "notes"} from Trash. This cannot be undone.`}
        confirmLabel="Delete all forever"
        onConfirm={() => void confirmDeleteAll()}
        onClose={() => setDeleteAllOpen(false)}
      />
    </>
  );
}
