"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { HoverMarquee } from "@/components/ui/hover-marquee";
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

const TREE_PAD = 6;
const TREE_ROW = 36;
const TREE_INDENT = 40;
const TREE_TRUNK = 14;
const TREE_RADIUS = 10;

function treeRowY(index: number) {
  return TREE_PAD + index * TREE_ROW + TREE_ROW / 2;
}

function treeBranchPath(index: number) {
  const y = treeRowY(index);
  return `M ${TREE_TRUNK} ${y - TREE_RADIUS} A ${TREE_RADIUS} ${TREE_RADIUS} 0 0 0 ${TREE_TRUNK + TREE_RADIUS} ${y} H ${TREE_INDENT - 8}`;
}

function treeReachPath(index: number) {
  const y = treeRowY(index);
  return `M ${TREE_TRUNK} 0 V ${y - TREE_RADIUS} A ${TREE_RADIUS} ${TREE_RADIUS} 0 0 0 ${TREE_TRUNK + TREE_RADIUS} ${y} H ${TREE_INDENT - 8}`;
}

function treeReachLength(index: number) {
  const y = treeRowY(index);
  return y - TREE_RADIUS + (Math.PI * TREE_RADIUS) / 2 + (TREE_INDENT - 8 - TREE_TRUNK - TREE_RADIUS);
}

export function Navigation() {
  const collapsed = useWorkspaceStore((state) => state.sidebarCollapsed);
  const view = useWorkspaceStore((state) => state.view);
  const notes = useWorkspaceStore((state) => state.notes);
  const folders = useWorkspaceStore((state) => state.folders);
  const selectedId = useWorkspaceStore((state) => state.selectedNoteId);
  const setCollapsed = useWorkspaceStore((state) => state.setSidebarCollapsed);
  const setSelected = useWorkspaceStore((state) => state.setSelectedNoteId);
  const setView = useWorkspaceStore((state) => state.setView);
  const setCommandOpen = useWorkspaceStore((state) => state.setCommandOpen);
  const setSettingsOpen = useWorkspaceStore((state) => state.setSettingsOpen);
  const { createNote, savePatch, deleteForever, togglePin } = useNotesActions();

  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [noteNameDraft, setNoteNameDraft] = useState("");
  const noteNameInputRef = useRef<HTMLInputElement>(null);
  const sidebarTreeRef = useRef<HTMLDivElement>(null);
  const sidebarMarkerRef = useRef<HTMLSpanElement>(null);
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

  useLayoutEffect(() => {
    const nav = sidebarTreeRef.current;
    const marker = sidebarMarkerRef.current;
    if (!nav || !marker || view !== "all") return;

    const place = (glide: boolean) => {
      const head = nav.querySelector<HTMLElement>(
        ".folder-branch-section.is-active-folder.is-open .folder-branch-head, .sidebar-tree-section--unfiled:has(.sidebar-unfiled-row.is-selected) .sidebar-tree-heading",
      );
      if (!glide) marker.style.transition = "none";
      if (head) {
        const navRect = nav.getBoundingClientRect();
        const headRect = head.getBoundingClientRect();
        marker.style.top = `${headRect.top - navRect.top + nav.scrollTop + (headRect.height - 16) / 2}px`;
        marker.setAttribute("data-on", "");
      } else {
        marker.removeAttribute("data-on");
      }
      if (!glide) {
        void marker.offsetHeight;
        marker.style.transition = "";
      }
    };

    place(true);
    let first = true;
    const observer = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      place(false);
    });
    observer.observe(nav);
    const mutationObserver = new MutationObserver(() => place(true));
    mutationObserver.observe(nav, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [folders, rootVisibleNotes.length, selectedId, view]);

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

  function handleTouchTap(id: string, title: string, pointerType: string, eventTime: number) {
    if (pointerType === "mouse") return;
    const last = lastTouchTapRef.current;
    if (last?.id === id && eventTime - last.at <= 340) {
      lastTouchTapRef.current = null;
      startNoteRename(id, title);
      return;
    }
    lastTouchTapRef.current = { id, at: eventTime };
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

            <div ref={sidebarTreeRef} className="sidebar-notes-scroll">
              {view === "all" && <span ref={sidebarMarkerRef} className="sidebar-tree-marker" aria-hidden="true" />}
              {view === "all" ? (
                <>
                  <FolderTree mode="sidebar" />
                  {rootVisibleNotes.length > 0 && (
                    <section className="sidebar-tree-section sidebar-tree-section--unfiled" aria-label="Unfiled notes">
                      <div className="sidebar-tree-heading">Unfiled</div>
                      <div
                        className="sidebar-unfiled-tree"
                        style={{ height: TREE_PAD * 2 + rootVisibleNotes.length * TREE_ROW }}
                      >
                        <svg
                          className="sidebar-unfiled-lines"
                          width={TREE_INDENT}
                          height={TREE_PAD * 2 + rootVisibleNotes.length * TREE_ROW}
                          aria-hidden="true"
                        >
                          <path
                            className="sidebar-unfiled-line-base"
                            d={`M ${TREE_TRUNK} 0 V ${treeRowY(rootVisibleNotes.length - 1) - TREE_RADIUS}`}
                          />
                          {rootVisibleNotes.map((note, index) => (
                            <path key={`base:${note.id}`} className="sidebar-unfiled-line-base" d={treeBranchPath(index)} />
                          ))}
                          {rootVisibleNotes.map((note, index) => {
                            const length = treeReachLength(index);
                            return (
                              <path
                                key={`reach:${note.id}`}
                                className="sidebar-unfiled-line-active"
                                d={treeReachPath(index)}
                                style={{
                                  strokeDasharray: length,
                                  strokeDashoffset: note.id === selectedId ? 0 : length,
                                }}
                              />
                            );
                          })}
                        </svg>
                        {rootVisibleNotes.map((note) => (
                          <NoteContextMenu key={note.id} note={note}>
                            {renamingNoteId === note.id ? (
                              <div className={cn("sidebar-unfiled-row", "is-renaming", selectedId === note.id && "is-selected")}>
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
                                    onPointerUp={(event) => handleTouchTap(note.id, getNoteDisplayTitle(note), event.pointerType, event.timeStamp)}
                                  >
                                    <FileText size={15} aria-hidden="true" />
                                    <HoverMarquee text={getNoteDisplayTitle(note)} />
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
                        <HoverMarquee text={getNoteDisplayTitle(note)} />
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
                            onPointerUp={(event) => handleTouchTap(note.id, getNoteDisplayTitle(note), event.pointerType, event.timeStamp)}
                          >
                            <HoverMarquee text={getNoteDisplayTitle(note)} />
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
            <div className="sidebar-view-switcher" aria-label="Note views and settings">
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
              <Tooltip label="Settings" side="top">
                <button
                  type="button"
                  className="sidebar-settings-button"
                  aria-label="Settings"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings size={16} />
                </button>
              </Tooltip>
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
          ) : null}
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
