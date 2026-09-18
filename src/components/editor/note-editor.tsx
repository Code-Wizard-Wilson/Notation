"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  CheckSquare2,
  Copy,
  FileDown,
  FileText,
  Code2,
  FilePlus2,
  Heading1,
  Heading2,
  Heading3,
  GripVertical,
  ImagePlus,
  List,
  ListOrdered,
  Lock,
  LockOpen,
  Minus,
  Link2,
  MoreHorizontal,
  Plus,
  Quote,
  RotateCcw,
  Share2,
  Table2,
  Text,
  Trash2,
} from "lucide-react";
import { CharacterCount } from "@tiptap/extension-character-count";
import type { JSONContent } from "@tiptap/core";
import FileHandler from "@tiptap/extension-file-handler";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { FontFamily, TextStyle } from "@tiptap/extension-text-style";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import Fuse from "fuse.js";
import { AttachmentExtension } from "@/components/editor/extensions/attachment";
import { NoteImage } from "@/components/editor/extensions/note-image";
import { TaskInputRule } from "@/components/editor/extensions/task-input-rule";
import { BubbleToolbar } from "@/components/editor/bubble-toolbar";
import { ImageToolbar } from "@/components/editor/image-toolbar";
import { TableToolbar } from "@/components/editor/table-toolbar";
import { EditorMenu, type EditorMenuItem } from "@/components/editor/editor-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import { Popover } from "@/components/interior/popover";
import { useNotesActions } from "@/hooks/use-notes-actions";
import { useSettingsStore } from "@/store/settings-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn, getNoteDisplayTitle, plainTextFromDocument } from "@/lib/utils";
import { downloadNoteMarkdown, exportNoteAsPdf } from "@/lib/export";
import type { Note } from "@/types/note";

type TriggerMenu = {
  kind: "slash" | "note-link";
  query: string;
  from: number;
  to: number;
  position: { left: number; top: number };
};

type UploadState = { id: string; filename: string; progress: number };

// Bump this whenever the Tiptap schema/extensions change. In dev, Fast Refresh
// can otherwise preserve an Editor instance created with the previous schema
// while the React UI already exposes commands from the new code.
const EDITOR_SCHEMA_VERSION = 4;

function splitDenseSoftBreakParagraphs(content: JSONContent) {
  if (content.type !== "doc" || !content.content?.length) {
    return { content, changed: false };
  }

  let changed = false;
  const blocks: JSONContent[] = [];

  for (const block of content.content) {
    if (block.type !== "paragraph" || !block.content?.length) {
      blocks.push(block);
      continue;
    }

    const hardBreakCount = block.content.reduce(
      (count, child) => count + (child.type === "hardBreak" ? 1 : 0),
      0,
    );

    // Keep normal Shift+Enter behavior intact. A single soft break (or even a
    // short two-line address) stays one block. Dense pasted/imported line sets
    // are normalized into Notion-style independent blocks so each row can be
    // dragged and acted on separately.
    if (hardBreakCount < 2) {
      blocks.push(block);
      continue;
    }

    const lines: JSONContent[][] = [[]];
    for (const child of block.content) {
      if (child.type === "hardBreak") lines.push([]);
      else lines[lines.length - 1].push(child);
    }

    if (lines.length < 3) {
      blocks.push(block);
      continue;
    }

    changed = true;
    for (const line of lines) {
      blocks.push({
        type: "paragraph",
        ...(block.attrs ? { attrs: block.attrs } : {}),
        ...(line.length ? { content: line } : {}),
      });
    }
  }

  return changed
    ? { content: { ...content, content: blocks }, changed: true }
    : { content, changed: false };
}

function noteLinksTo(note: Note, targetId: string) {
  let linked = false;
  function visit(value: unknown) {
    if (linked || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as Record<string, unknown>;
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if (!mark || typeof mark !== "object") continue;
        const href = (mark as { attrs?: { href?: unknown } }).attrs?.href;
        if (href === `note:${targetId}`) {
          linked = true;
          return;
        }
      }
    }
    Object.values(node).forEach(visit);
  }
  visit(note.content);
  return linked;
}

function editorPosition(editor: Editor, position: number) {
  const coordinates = editor.view.coordsAtPos(position);
  return {
    left: Math.max(12, Math.min(coordinates.left, window.innerWidth - 304)),
    top: Math.min(coordinates.bottom + 8, window.innerHeight - 430),
  };
}

function resolveTrigger(editor: Editor): TriggerMenu | null {
  const { selection } = editor.state;
  if (!selection.empty || !selection.$from.parent.isTextblock) return null;

  const before = selection.$from.parent.textBetween(
    0,
    selection.$from.parentOffset,
    "\n",
    "\n",
  );
  const internalMatch = before.match(/\[\[([^\]\n]*)$/);
  if (internalMatch) {
    return {
      kind: "note-link",
      query: internalMatch[1] ?? "",
      from: selection.from - internalMatch[0].length,
      to: selection.from,
      position: editorPosition(editor, selection.from),
    };
  }

  const slashMatch = before.match(/(?:^|\s)\/([^\s/]*)$/);
  if (slashMatch) {
    const fullMatch = slashMatch[0];
    const slashOffset = fullMatch.lastIndexOf("/");
    const length = fullMatch.length - slashOffset;
    return {
      kind: "slash",
      query: slashMatch[1] ?? "",
      from: selection.from - length,
      to: selection.from,
      position: editorPosition(editor, selection.from),
    };
  }

  return null;
}

function countSelectedWords(editor: Editor) {
  const { from, to, empty } = editor.state.selection;
  if (empty || from === to) return 0;
  const text = editor.state.doc.textBetween(from, to, " ", " ").trim();
  if (!text) return 0;
  return text.match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function useAutosizeTextArea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 192)}px`;
  }, [value]);
  return ref;
}

export function NoteEditor() {
  const selectedId = useWorkspaceStore((state) => state.selectedNoteId);
  const note = useWorkspaceStore((state) => state.notes.find((item) => item.id === selectedId));
  const mobilePane = useWorkspaceStore((state) => state.mobilePane);
  const setMobilePane = useWorkspaceStore((state) => state.setMobilePane);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const markdownShortcuts = useSettingsStore((state) => state.markdownShortcuts);

  if (!note) {
    return (
      <section className={cn("editor-pane editor-empty", mobilePane !== "editor" && "mobile-hidden")}>
        <header className="editor-header">
          <IconButton className="mobile-back" aria-label="Back to notes" onClick={() => setMobilePane("list")}>
            <ArrowLeft size={18} />
          </IconButton>
        </header>
        <div><p className="micro-label">EDITOR</p><h2>Select a note.</h2><p>Your writing will appear here.</p></div>
      </section>
    );
  }

  return (
    <EditorDocument
      key={`${note.id}:${markdownShortcuts}:${EDITOR_SCHEMA_VERSION}`}
      note={note}
      fontSize={fontSize}
      markdownShortcuts={markdownShortcuts}
      mobilePane={mobilePane}
    />
  );
}

function EditorDocument({
  note,
  fontSize,
  markdownShortcuts,
  mobilePane,
}: {
  note: Note;
  fontSize: number;
  markdownShortcuts: boolean;
  mobilePane: "list" | "editor";
}) {
  const notes = useWorkspaceStore((state) => state.notes);
  const focusRequest = useWorkspaceStore((state) => state.editorFocusRequest);
  const setMobilePane = useWorkspaceStore((state) => state.setMobilePane);
  const setSelected = useWorkspaceStore((state) => state.setSelectedNoteId);
  const setView = useWorkspaceStore((state) => state.setView);
  const setDetailsOpen = useWorkspaceStore((state) => state.setDetailsOpen);
  const pushToast = useWorkspaceStore((state) => state.pushToast);
  const spellCheck = useSettingsStore((state) => state.spellCheck);
  const showHints = useSettingsStore((state) => state.showHints);
  const readOnly = useSettingsStore((state) => state.readOnly);
  const updateSettings = useSettingsStore((state) => state.update);
  const {
    syncSnapshot,
    savePatch,
    restoreNote,
    deleteForever,
    copyNoteLink,
    addAttachment,
    removeAttachment,
  } = useNotesActions();
  const [trigger, setTrigger] = useState<TriggerMenu | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [blockInsertMenu, setBlockInsertMenu] = useState<{
    insertPos: number;
    position: { left: number; top: number };
  } | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ pos: number; size: number; type: string; json: JSONContent } | null>(null);
  const blockTargetRef = useRef<{ pos: number; size: number; type: string; json: JSONContent } | null>(null);
  const blockDidDragRef = useRef(false);
  const [customEmoji, setCustomEmoji] = useState("");
  const [selectedWordCount, setSelectedWordCount] = useState(0);
  const saveTimer = useRef<number | null>(null);
  const titleRef = useAutosizeTextArea(note.title);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suppressTrigger = useRef<{ kind: TriggerMenu["kind"]; from: number } | null>(null);
  const initialDocument = splitDenseSoftBreakParagraphs(note.content);
  const lastContent = useRef(JSON.stringify(initialDocument.content));

  const setNoteEmoji = useCallback((emoji: string) => {
    const value = emoji.trim();
    if (!value) return;
    void savePatch(note.id, { emoji: value });
    setEmojiPickerOpen(false);
    setCustomEmoji("");
  }, [note.id, savePatch]);

  const applyCustomEmoji = useCallback(() => {
    const value = customEmoji.trim();
    if (!value) return;
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const first = Array.from(segmenter.segment(value))[0]?.segment;
    if (first) setNoteEmoji(first);
  }, [customEmoji, setNoteEmoji]);

  const scheduleSave = useCallback(() => {
    const store = useWorkspaceStore.getState();
    store.setSyncState(note.id, "saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void syncSnapshot(note.id), 650);
  }, [note.id, syncSnapshot]);

  const updateTrigger = useCallback((instance: Editor) => {
    if (!instance.isEditable) {
      setTrigger(null);
      return;
    }
    const next = resolveTrigger(instance);
    if (!next) {
      suppressTrigger.current = null;
      setTrigger(null);
      return;
    }
    if (
      suppressTrigger.current?.kind === next.kind &&
      suppressTrigger.current.from === next.from
    ) {
      setTrigger(null);
      return;
    }
    setTrigger(next);
  }, []);

  const uploadFiles = useCallback(
    async (files: File[], instance: Editor, dropPosition?: number) => {
      if (!files.length || note.isDeleted || readOnly) return;
      setDragActive(false);
      if (typeof dropPosition === "number") {
        instance.commands.setTextSelection(dropPosition);
      }

      for (const file of files) {
        const uploadId = crypto.randomUUID();
        setUploads((current) => [...current, { id: uploadId, filename: file.name, progress: 4 }]);
        try {
          const attachment = await addAttachment(note.id, file, (progress) => {
            setUploads((current) =>
              current.map((upload) =>
                upload.id === uploadId ? { ...upload, progress } : upload,
              ),
            );
          });

          if (attachment.type === "image") {
            instance
              .chain()
              .focus()
              .setImage({
                src: attachment.url ?? "",
                alt: attachment.filename,
                title: attachment.filename,
              })
              .updateAttributes("image", { attachmentId: attachment.id })
              .createParagraphNear()
              .run();
          } else {
            instance
              .chain()
              .focus()
              .insertAttachment({
                attachmentId: attachment.id,
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                size: attachment.size,
                url: attachment.url ?? "",
              })
              .createParagraphNear()
              .run();
          }
        } catch (error) {
          pushToast({
            title: error instanceof Error ? error.message : "Couldn't upload the file. Try again.",
            tone: "error",
          });
        } finally {
          window.setTimeout(
            () => setUploads((current) => current.filter((upload) => upload.id !== uploadId)),
            500,
          );
        }
      }
    },
    [addAttachment, note.id, note.isDeleted, pushToast, readOnly],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      content: initialDocument.content,
      editable: !note.isDeleted && !readOnly,
      enableInputRules: markdownShortcuts,
      extensions: [
        StarterKit.configure({
          trailingNode: { node: "paragraph" },
          dropcursor: { color: "#ef4444", width: 2, class: "block-drop-cursor" },
          link: {
            openOnClick: false,
            autolink: true,
            linkOnPaste: true,
            protocols: ["note"],
            HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
          },
          heading: { levels: [1, 2, 3] },
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TaskInputRule,
        TableKit.configure({
          table: {
            resizable: true,
            handleWidth: 4,
            cellMinWidth: 96,
            lastColumnResizable: true,
            allowTableNodeSelection: true,
          },
          tableCell: {},
          tableHeader: {},
          tableRow: {},
        }),
        Placeholder.configure({
          includeChildren: true,
          showOnlyCurrent: true,
          placeholder: ({ node }) =>
            showHints
              ? node.type.name === "heading"
                ? "Heading"
                : "Type '/' for blocks, '[[' to link a note…"
              : "",
        }),
        CharacterCount,
        TextStyle,
        FontFamily,
        Highlight.configure({ multicolor: true }),
        NoteImage,
        AttachmentExtension,
        FileHandler.configure({
          consumePasteEvent: true,
          onPaste: (instance, files) => void uploadFiles(files, instance),
          onDrop: (instance, files, position) => void uploadFiles(files, instance, position),
        }),
      ],
      editorProps: {
        attributes: {
          class: "note-prose",
          spellcheck: String(spellCheck),
          "aria-label": "Note content",
        },
        handlePaste(view, event) {
          const text = event.clipboardData?.getData("text/plain").trim();
          const { from, to } = view.state.selection;
          if (
            text &&
            from !== to &&
            /^(https?:\/\/|mailto:)[^\s]+$/i.test(text) &&
            view.state.schema.marks.link
          ) {
            const mark = view.state.schema.marks.link.create({
              href: text,
              target: "_blank",
              rel: "noopener noreferrer nofollow",
            });
            view.dispatch(view.state.tr.addMark(from, to, mark));
            return true;
          }
          return false;
        },
        handleKeyDown(view, event) {
          const mod = event.metaKey || event.ctrlKey;
          if (mod && event.key.toLowerCase() === "k" && !view.state.selection.empty) {
            event.preventDefault();
            window.dispatchEvent(new CustomEvent("notation:edit-link"));
            return true;
          }

          // Pasted/imported text can leave a visually invisible tail after the
          // caret (spaces, NBSP or zero-width characters). If Enter is pressed
          // there, ProseMirror moves that hidden tail into the next block and it
          // looks like the first Enter did nothing. Remove only that invisible
          // tail and let the normal Enter command split the block once.
          if (event.key === "Enter" && !mod && !event.shiftKey && view.state.selection.empty) {
            const { $from, from } = view.state.selection;
            if ($from.parent.isTextblock && $from.parent.type.name !== "codeBlock") {
              const parentStart = $from.start();
              const parentEnd = $from.end();
              const invisibleChars = "\u0009\u0020\u00A0\u1680\u180E\u2000-\u200D\u202F\u205F\u2060\u3000\uFEFF";
              const invisibleOnly = new RegExp(`^[${invisibleChars}]*$`, "u");
              const trailingInvisible = new RegExp(`[${invisibleChars}]+$`, "u");

              if (parentEnd > from) {
                const tail = view.state.doc.textBetween(from, parentEnd, "", "\uFFFC");
                if (tail && invisibleOnly.test(tail)) {
                  view.dispatch(view.state.tr.delete(from, parentEnd));
                }
              } else if (from > parentStart) {
                const before = view.state.doc.textBetween(parentStart, from, "", "\uFFFC");
                const trailing = before.match(trailingInvisible)?.[0] ?? "";
                if (trailing) {
                  view.dispatch(view.state.tr.delete(from - trailing.length, from));
                }
              }
            }
          }

          return false;
        },
        handleClick(_view, _position, event) {
          const target = event.target as HTMLElement;
          const anchor = target.closest<HTMLAnchorElement>("a[href]");
          if (!anchor) return false;
          event.preventDefault();
          const href = anchor.getAttribute("href") ?? "";
          if (href.startsWith("note:")) {
            const id = href.slice(5);
            const targetNote = useWorkspaceStore.getState().notes.find((item) => item.id === id);
            if (targetNote) {
              setView(targetNote.isDeleted ? "trash" : targetNote.isArchived ? "archive" : "all");
              setSelected(id);
            }
          } else if (href) {
            window.open(href, "_blank", "noopener,noreferrer");
          }
          return true;
        },
      },
      onCreate: ({ editor: instance }) => {
        // Tiptap may normalize the initial document while mounting. Treat that as
        // initialization, not as a user edit, so simply opening a note does not
        // change updatedAt and reorder the sidebar.
        const mountedContent = instance.getJSON();
        lastContent.current = JSON.stringify(mountedContent);

        if (initialDocument.changed) {
          // Older/imported notes can contain many visual rows inside one
          // paragraph via hardBreak nodes. Persist the one-time structural
          // migration without touching updatedAt, so sidebar ordering stays put.
          useWorkspaceStore.getState().patchNote(note.id, {
            content: mountedContent,
            plainTextContent: plainTextFromDocument(mountedContent),
          }, false);
          void syncSnapshot(note.id);
        }
      },
      onUpdate: ({ editor: instance }) => {
        const content = instance.getJSON();
        const serialized = JSON.stringify(content);

        // Tiptap can emit one or more document-normalization updates while a
        // freshly selected note is mounting. The editor is not focused for
        // those events, so absorb the normalized snapshot without touching the
        // note timestamp. This keeps a simple note click from re-sorting the list.
        if (!instance.isFocused) {
          lastContent.current = serialized;
          updateTrigger(instance);
          setSelectedWordCount(countSelectedWords(instance));
          return;
        }

        if (serialized === lastContent.current) {
          updateTrigger(instance);
          setSelectedWordCount(countSelectedWords(instance));
          return;
        }
        lastContent.current = serialized;
        useWorkspaceStore.getState().patchNote(note.id, {
          content,
          plainTextContent: plainTextFromDocument(content),
        });
        scheduleSave();
        updateTrigger(instance);
        setSelectedWordCount(countSelectedWords(instance));
      },
      onSelectionUpdate: ({ editor: instance }) => {
        updateTrigger(instance);
        setSelectedWordCount(countSelectedWords(instance));
      },
      onBlur: () => {
        if (saveTimer.current) {
          window.clearTimeout(saveTimer.current);
          saveTimer.current = null;
          void syncSnapshot(note.id);
        }
      },
    },
    [note.id, markdownShortcuts, showHints, EDITOR_SCHEMA_VERSION],
  );

  const canEdit = !note.isDeleted && !readOnly;

  const closeBlockInsertMenu = useCallback(() => {
    setBlockInsertMenu(null);
    editor?.commands.setMeta("lockDragHandle", false);
  }, [editor]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      void syncSnapshot(note.id);
    };
  }, [note.id, syncSnapshot]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dom.setAttribute("spellcheck", String(spellCheck));
  }, [editor, spellCheck]);

  useEffect(() => {
    if (!editor || readOnly) return;
    const root = editor.view.dom;

    const bridgeGutterHover = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.(".block-drag-handle")) return;
      if (root.contains(target)) return;

      const rect = root.getBoundingClientRect();
      const gutterWidth = 44;
      const insideVerticalRange = event.clientY >= rect.top && event.clientY <= rect.bottom;
      const insideLeftGutter = event.clientX >= rect.left - gutterWidth && event.clientX < rect.left;
      if (!insideVerticalRange || !insideLeftGutter) return;

      root.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true,
        clientX: rect.left + 1,
        clientY: event.clientY,
      }));
    };

    window.addEventListener("pointermove", bridgeGutterHover, { passive: true });
    return () => window.removeEventListener("pointermove", bridgeGutterHover);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(canEdit);
  }, [canEdit, editor]);

  useEffect(() => {
    if (!editor || !blockMenuOpen) return;

    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".block-action-menu") || target?.closest(".block-handle-button")) return;
      setBlockMenuOpen(false);
      setBlockTarget(null);
      editor.commands.setMeta("lockDragHandle", false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setBlockMenuOpen(false);
      setBlockTarget(null);
      editor.commands.setMeta("lockDragHandle", false);
    };

    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", onKeyDown, true);
      editor.commands.setMeta("lockDragHandle", false);
    };
  }, [blockMenuOpen, editor]);

  useEffect(() => {
    if (!editor || !blockInsertMenu) return;

    const close = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".interior-editor-menu") || target?.closest(".block-insert-button")) return;
      closeBlockInsertMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeBlockInsertMenu();
    };

    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [blockInsertMenu, closeBlockInsertMenu, editor]);

  useEffect(() => {
    if (!editor || initialDocument.changed || note.syncState === "saving") return;
    const serialized = JSON.stringify(note.content);
    if (serialized !== lastContent.current) {
      lastContent.current = serialized;
      editor.commands.setContent(note.content, { emitUpdate: false });
    }
  }, [editor, initialDocument.changed, note.content, note.syncState]);

  useEffect(() => {
    if (!editor || !focusRequest) return;
    if (!note.title.trim()) titleRef.current?.focus();
    else editor.commands.focus("end");
    // Intentionally omit note.title: title keystrokes must not refocus the body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, focusRequest, titleRef]);

  useEffect(() => {
    if (!editor) return;
    const pickImage = () => { if (!readOnly) imageInputRef.current?.click(); };
    const pickFile = () => { if (!readOnly) fileInputRef.current?.click(); };
    const remove = (event: Event) => {
      const id = (event as CustomEvent<{ attachmentId: string }>).detail?.attachmentId;
      if (id) void removeAttachment(note.id, id);
    };
    window.addEventListener("notation:pick-image", pickImage);
    window.addEventListener("notation:pick-file", pickFile);
    window.addEventListener("notation:remove-attachment", remove);
    return () => {
      window.removeEventListener("notation:pick-image", pickImage);
      window.removeEventListener("notation:pick-file", pickFile);
      window.removeEventListener("notation:remove-attachment", remove);
    };
  }, [editor, note.id, readOnly, removeAttachment]);

  function onTitleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    if (readOnly) return;
    useWorkspaceStore.getState().patchNote(note.id, { title: event.target.value });
    scheduleSave();
  }

  function dismissTrigger() {
    if (trigger) suppressTrigger.current = { kind: trigger.kind, from: trigger.from };
    setTrigger(null);
  }

  const slashItems = useMemo(() => {
    if (!editor || trigger?.kind !== "slash") return [];
    const choose = (command: (chain: ReturnType<Editor["chain"]>) => void) => () => {
      const chain = editor.chain().focus().deleteRange({ from: trigger.from, to: trigger.to });
      command(chain);
      setTrigger(null);
    };
    const all: Array<EditorMenuItem & { keywords: string }> = [
      { id: "text", label: "Text", description: "Plain paragraph", icon: Text, group: "BASIC", keywords: "paragraph text", onSelect: choose((chain) => { chain.setParagraph().run(); }) },
      { id: "h1", label: "Heading 1", description: "Large section title", icon: Heading1, group: "BASIC", keywords: "title heading", onSelect: choose((chain) => { chain.toggleHeading({ level: 1 }).run(); }) },
      { id: "h2", label: "Heading 2", description: "Medium section title", icon: Heading2, group: "BASIC", keywords: "subtitle heading", onSelect: choose((chain) => { chain.toggleHeading({ level: 2 }).run(); }) },
      { id: "h3", label: "Heading 3", description: "Small section title", icon: Heading3, group: "BASIC", keywords: "heading", onSelect: choose((chain) => { chain.toggleHeading({ level: 3 }).run(); }) },
      { id: "quote", label: "Quote", description: "Quoted passage", icon: Quote, group: "BASIC", keywords: "blockquote quote", onSelect: choose((chain) => { chain.toggleBlockquote().run(); }) },
      { id: "code", label: "Code", description: "Code block", icon: Code2, group: "BASIC", keywords: "code block", onSelect: choose((chain) => { chain.toggleCodeBlock().run(); }) },
      { id: "divider", label: "Divider", description: "Section separator", icon: Minus, group: "BASIC", keywords: "rule divider separator", onSelect: choose((chain) => { chain.setHorizontalRule().run(); }) },
      { id: "bullet", label: "Bullet list", description: "Simple list", icon: List, group: "LISTS", keywords: "unordered list bullet", onSelect: choose((chain) => { chain.toggleBulletList().run(); }) },
      { id: "ordered", label: "Numbered list", description: "Ordered sequence", icon: ListOrdered, group: "LISTS", keywords: "ordered numbered list", onSelect: choose((chain) => { chain.toggleOrderedList().run(); }) },
      { id: "task", label: "Checklist", description: "Tasks with checkboxes", icon: CheckSquare2, group: "LISTS", keywords: "task todo checkbox", onSelect: choose((chain) => { chain.toggleTaskList().run(); }) },
      {
        id: "table",
        label: "Table",
        description: "3 × 3 editable table",
        icon: Table2,
        group: "DATA",
        keywords: "table grid rows columns database",
        onSelect: () => {
          // A stale Fast Refresh editor may have the new menu but the old
          // ProseMirror schema. Never call a missing command and crash the app.
          if (typeof editor.commands.insertTable !== "function" || !editor.schema.nodes.table) {
            pushToast({ title: "Editor updated. Reopening the note…", tone: "neutral" });
            window.setTimeout(() => window.location.reload(), 60);
            return;
          }
          editor
            .chain()
            .focus()
            .deleteRange({ from: trigger.from, to: trigger.to })
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
          setTrigger(null);
        },
      },
      { id: "image", label: "Image", description: "Upload image", icon: ImagePlus, group: "MEDIA", keywords: "photo picture upload", onSelect: choose((chain) => { chain.run(); window.dispatchEvent(new CustomEvent("notation:pick-image")); }) },
      { id: "file", label: "File", description: "Attach document", icon: FilePlus2, group: "MEDIA", keywords: "attachment document upload", onSelect: choose((chain) => { chain.run(); window.dispatchEvent(new CustomEvent("notation:pick-file")); }) },
      {
        id: "note-link",
        label: "Link to note",
        description: "Reference another note",
        icon: Link2,
        group: "LINKS",
        keywords: "link note page reference wiki",
        onSelect: () => {
          editor.chain().focus().deleteRange({ from: trigger.from, to: trigger.to }).insertContent("[[").run();
          setTrigger(resolveTrigger(editor));
        },
      },
    ];
    const query = trigger.query.toLowerCase();
    return all.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(query));
  }, [editor, pushToast, trigger]);

  const noteLinkItems = useMemo(() => {
    if (!editor || trigger?.kind !== "note-link") return [];
    const candidates = notes.filter((item) => item.id !== note.id && !item.isDeleted);
    const results = trigger.query.trim()
      ? new Fuse(candidates, { keys: ["title", "plainTextContent"], threshold: 0.4, ignoreLocation: true })
          .search(trigger.query, { limit: 7 })
          .map((result) => result.item)
      : candidates.slice(0, 7);
    return results.map<EditorMenuItem>((target) => ({
      id: target.id,
      label: getNoteDisplayTitle(target),
      description: target.plainTextContent.slice(0, 60) || "Empty note",
      onSelect: () => {
        editor
          .chain()
          .focus()
          .deleteRange({ from: trigger.from, to: trigger.to })
          .insertContent({
            type: "text",
            text: getNoteDisplayTitle(target),
            marks: [{ type: "link", attrs: { href: `note:${target.id}`, target: null, rel: null } }],
          })
          .run();
        setTrigger(null);
      },
    }));
  }, [editor, note.id, notes, trigger]);

  const backlinks = useMemo(
    () => notes.filter((candidate) => candidate.id !== note.id && !candidate.isDeleted && noteLinksTo(candidate, note.id)),
    [note.id, notes],
  );

  function openBacklink(source: Note) {
    setView(source.isArchived ? "archive" : "all");
    setSelected(source.id);
  }

  function handleImageRemoval(attachmentId?: string) {
    if (attachmentId) void removeAttachment(note.id, attachmentId);
  }

  function closeBlockMenu() {
    setBlockMenuOpen(false);
    setBlockTarget(null);
    editor?.commands.setMeta("lockDragHandle", false);
  }

  function openBlockMenu() {
    if (!editor) return;
    if (blockMenuOpen) {
      closeBlockMenu();
      return;
    }
    const target = blockTargetRef.current;
    if (!target) return;
    setBlockTarget(target);
    editor.commands.setMeta("lockDragHandle", true);
    setBlockMenuOpen(true);
  }

  function openBlockInsertMenu(event: React.MouseEvent<HTMLButtonElement>) {
    if (!editor) return;
    const target = blockTargetRef.current;
    if (!target) return;

    if (blockInsertMenu) {
      closeBlockInsertMenu();
      return;
    }

    if (blockMenuOpen) closeBlockMenu();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 292;
    const menuHeight = 356;
    const left = Math.max(10, Math.min(rect.left - 2, window.innerWidth - menuWidth - 10));
    const below = rect.bottom + 7;
    const top = below + menuHeight <= window.innerHeight - 10
      ? below
      : Math.max(10, rect.top - menuHeight - 7);

    editor.commands.setMeta("lockDragHandle", true);
    setBlockInsertMenu({
      insertPos: target.pos + target.size,
      position: { left, top },
    });
  }

  function insertBlockFromMenu(kind: "text" | "h1" | "h2" | "h3" | "bullet" | "ordered" | "task" | "quote" | "code" | "divider") {
    if (!editor || !blockInsertMenu) return;
    const insertPos = blockInsertMenu.insertPos;

    if (kind === "divider") {
      editor.chain().focus().insertContentAt(insertPos, { type: "horizontalRule" }).run();
      closeBlockInsertMenu();
      return;
    }

    const chain = editor
      .chain()
      .focus()
      .insertContentAt(insertPos, { type: "paragraph" })
      .setTextSelection(insertPos + 1);

    if (kind === "h1") chain.setHeading({ level: 1 });
    else if (kind === "h2") chain.setHeading({ level: 2 });
    else if (kind === "h3") chain.setHeading({ level: 3 });
    else if (kind === "bullet") chain.toggleBulletList();
    else if (kind === "ordered") chain.toggleOrderedList();
    else if (kind === "task") chain.toggleTaskList();
    else if (kind === "quote") chain.toggleBlockquote();
    else if (kind === "code") chain.toggleCodeBlock();

    chain.run();
    closeBlockInsertMenu();
  }

  function duplicateCurrentBlock() {
    if (!editor || !blockTarget) return;
    editor.chain().focus().insertContentAt(blockTarget.pos + blockTarget.size, blockTarget.json).run();
    closeBlockMenu();
  }

  function deleteCurrentBlock() {
    if (!editor || !blockTarget) return;
    editor.chain().focus().deleteRange({ from: blockTarget.pos, to: blockTarget.pos + blockTarget.size }).run();
    closeBlockMenu();
  }

  function turnCurrentBlockInto(kind: "text" | "h1" | "h2" | "quote" | "code") {
    if (!editor || !blockTarget) return;
    const position = Math.min(blockTarget.pos + 1, editor.state.doc.content.size);
    const chain = editor.chain().focus().setTextSelection(position);
    if (kind === "text") chain.setParagraph().run();
    else if (kind === "h1") chain.setHeading({ level: 1 }).run();
    else if (kind === "h2") chain.setHeading({ level: 2 }).run();
    else if (kind === "quote") chain.toggleBlockquote().run();
    else chain.toggleCodeBlock().run();
    closeBlockMenu();
  }

  async function confirmPermanentDelete() {
    setConfirmDelete(false);
    await deleteForever(note.id);
    setMobilePane("list");
  }

  function shareCopyLink() {
    setShareOpen(false);
    void copyNoteLink(note.id);
  }

  function shareMarkdown() {
    setShareOpen(false);
    downloadNoteMarkdown(note);
    pushToast({ title: "Markdown exported" });
  }

  async function sharePdf() {
    setShareOpen(false);
    try {
      await exportNoteAsPdf(note);
      pushToast({ title: "PDF exported" });
    } catch {
      pushToast({ title: "Could not export PDF", tone: "error" });
    }
  }

  return (
    <section
      className={cn(
        "editor-pane",
        mobilePane !== "editor" && "mobile-hidden",
        canEdit && dragActive && "is-dragging",
        readOnly && "is-read-only",
      )}
      onDragEnter={(event: DragEvent) => {
        if (canEdit && event.dataTransfer.types.includes("Files")) setDragActive(true);
      }}
      onDragOver={(event: DragEvent) => {
        if (canEdit && event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDragLeave={(event: DragEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false);
      }}
      onDrop={() => setDragActive(false)}
    >
      <header className="editor-header editor-mini-toolbar">
        <div className="editor-context">
          <Tooltip label="Back to notes" side="bottom">
            <IconButton className="mobile-back" aria-label="Back to notes" onClick={() => setMobilePane("list")}>
              <ArrowLeft size={18} />
            </IconButton>
          </Tooltip>
          <span className="editor-context-copy">
            <Popover
              open={canEdit && emojiPickerOpen}
              onOpenChange={(open) => { if (canEdit) setEmojiPickerOpen(open); }}
              label="Choose note emoji"
              side="bottom"
              align="start"
              offset={8}
              arrowSize={0}
              triggerClassName="editor-emoji-trigger"
              className="emoji-picker-popover"
              trigger={<span className="editor-context-dog" role="img" aria-label="Change note emoji">{note.emoji ?? "🐶"}</span>}
            >
              <div className="emoji-picker">
                <div className="emoji-picker-head">
                  <strong>Note emoji</strong>
                  <span>Choose one or paste your own</span>
                </div>
                <div className="emoji-picker-grid" role="list" aria-label="Emoji choices">
                  {["🐶","🐱","🐻","🐼","🦊","🐸","🐵","🦁","🐯","🐨","🐰","🐧","🦄","🐙","🦋","🌿","🌵","🍀","⭐️","🌙","☀️","🔥","💧","🍋","🍒","🍎","🎧","🎯","💡","📝"].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      role="listitem"
                      className={cn("emoji-picker-option", (note.emoji ?? "🐶") === emoji && "is-selected")}
                      onClick={() => setNoteEmoji(emoji)}
                      aria-label={`Use ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="emoji-picker-custom">
                  <input
                    value={customEmoji}
                    onChange={(event) => setCustomEmoji(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyCustomEmoji();
                      }
                    }}
                    placeholder="Paste emoji"
                    aria-label="Custom emoji"
                  />
                  <button type="button" onClick={applyCustomEmoji} disabled={!customEmoji.trim()}>Use</button>
                </div>
              </div>
            </Popover>
          </span>
        </div>

        <div className="save-status" aria-live="polite">
          {note.syncState === "saving" ? (
            <span>SAVING</span>
          ) : note.syncState === "saved" ? (
            <span>SAVED</span>
          ) : note.syncState === "error" ? (
            <span className="save-error">SAVE FAILED</span>
          ) : null}
        </div>

        <div className="editor-actions">
          {!note.isDeleted && (
            <Tooltip label={readOnly ? "Exit read-only" : "Read-only mode"} side="bottom">
              <IconButton
                className={readOnly ? "is-accent read-only-toggle" : "read-only-toggle"}
                aria-label={readOnly ? "Exit read-only" : "Enable read-only"}
                aria-pressed={readOnly}
                onClick={() => updateSettings({ readOnly: !readOnly })}
              >
                {readOnly ? <Lock size={15} /> : <LockOpen size={15} />}
              </IconButton>
            </Tooltip>
          )}
          {note.isDeleted ? (
            <>
              <button type="button" className="editor-text-action restore-action" onClick={() => void restoreNote(note.id)}><RotateCcw size={15} /> Restore note</button>
              <button type="button" className="editor-text-action danger-text-action" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete forever</button>
            </>
          ) : note.isArchived ? (
            <button type="button" className="editor-text-action" onClick={() => void restoreNote(note.id)}><RotateCcw size={15} /> Restore note</button>
          ) : null}
          <Popover
            open={shareOpen}
            onOpenChange={setShareOpen}
            label="Share note"
            side="bottom"
            align="end"
            offset={7}
            arrowSize={0}
            triggerClassName="share-popover-trigger"
            className="share-popover"
            trigger={<>
              <Share2 size={16} aria-hidden="true" />
              <span className="sr-only">Share note</span>
            </>}
          >
            <div className="share-menu" role="menu" aria-label="Share note actions">
              <div className="share-menu-head">SHARE & EXPORT</div>
              <button type="button" role="menuitem" className="share-menu-item" onClick={shareCopyLink}>
                <span className="share-menu-icon"><Link2 size={15} /></span>
                <span><strong>Copy link</strong><small>Copy a link to this note</small></span>
              </button>
              <button type="button" role="menuitem" className="share-menu-item" onClick={shareMarkdown}>
                <span className="share-menu-icon"><FileText size={15} /></span>
                <span><strong>Markdown</strong><small>Export a .md file</small></span>
              </button>
              <button type="button" role="menuitem" className="share-menu-item" onClick={() => void sharePdf()}>
                <span className="share-menu-icon"><FileDown size={15} /></span>
                <span><strong>PDF</strong><small>Download a clean A4 file</small></span>
              </button>
            </div>
          </Popover>
          <Tooltip label="Note details" side="bottom">
            <IconButton aria-label="Note details" onClick={() => setDetailsOpen(true)}><MoreHorizontal size={17} /></IconButton>
          </Tooltip>
        </div>
      </header>

      <div className="editor-scroll">
        <article className="editor-page" style={{ "--editor-font-size": `${fontSize}px` } as React.CSSProperties}>
          <textarea
            ref={titleRef}
            className="editor-title"
            aria-label="Note title"
            aria-readonly={note.isDeleted || readOnly}
            placeholder="Untitled"
            value={note.title}
            onChange={onTitleChange}
            onBlur={() => void syncSnapshot(note.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                editor?.commands.focus("start");
              }
            }}
            readOnly={note.isDeleted || readOnly}
            rows={1}
          />
          <EditorContent editor={editor} />
          {editor && canEdit && (
            <DragHandle
              editor={editor}
              className="block-drag-handle"
              dragImageProperties={[
                "color",
                "background-color",
                "font-family",
                "font-size",
                "font-weight",
                "line-height",
                "width",
              ]}
              onElementDragStart={() => {
                const root = editor.view.dom;
                blockDidDragRef.current = true;
                if (blockMenuOpen) closeBlockMenu();
                if (blockInsertMenu) closeBlockInsertMenu();
                root.classList.add("is-block-dragging");
              }}
              onElementDragEnd={() => {
                const root = editor.view.dom;
                root.classList.remove("is-block-dragging");
                // Native dragend is followed by a click in Chromium. Keep the
                // drag flag alive through that click so the dots do not open
                // the actions menu after a completed drag.
                window.setTimeout(() => {
                  blockDidDragRef.current = false;
                }, 0);
              }}
              onNodeChange={({ node, pos }) => {
                if (blockMenuOpen) return;
                blockTargetRef.current = node
                  ? { pos, size: node.nodeSize, type: node.type.name, json: node.toJSON() as JSONContent }
                  : null;
              }}
            >
              <div className="block-handle-shell">
                <button
                  type="button"
                  className="block-insert-button"
                  aria-label="Add block"
                  aria-expanded={Boolean(blockInsertMenu)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => { event.preventDefault(); event.stopPropagation(); openBlockInsertMenu(event); }}
                >
                  <Plus size={13} />
                </button>
                <button
                  type="button"
                  className="block-handle-button"
                  aria-label="Block actions"
                  aria-expanded={blockMenuOpen}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (blockDidDragRef.current) return;
                    openBlockMenu();
                  }}
                >
                  <GripVertical size={15} />
                </button>
                {blockMenuOpen && blockTarget && (
                  <div className="block-action-menu menu-surface" role="menu" aria-label="Block actions" onClick={(event) => event.stopPropagation()}>
                    <button type="button" role="menuitem" onClick={duplicateCurrentBlock}><Copy size={14} /><span>Duplicate</span></button>
                    <span className="block-action-label">TURN INTO</span>
                    <button type="button" role="menuitem" onClick={() => turnCurrentBlockInto("text")}><Text size={14} /><span>Text</span></button>
                    <button type="button" role="menuitem" onClick={() => turnCurrentBlockInto("h1")}><Heading1 size={14} /><span>Heading 1</span></button>
                    <button type="button" role="menuitem" onClick={() => turnCurrentBlockInto("h2")}><Heading2 size={14} /><span>Heading 2</span></button>
                    <button type="button" role="menuitem" onClick={() => turnCurrentBlockInto("quote")}><Quote size={14} /><span>Quote</span></button>
                    <button type="button" role="menuitem" onClick={() => turnCurrentBlockInto("code")}><Code2 size={14} /><span>Code</span></button>
                    <span className="block-action-separator" />
                    <button type="button" role="menuitem" className="is-danger" onClick={deleteCurrentBlock}><Trash2 size={14} /><span>Delete</span></button>
                  </div>
                )}
              </div>
            </DragHandle>
          )}
          {backlinks.length > 0 && (
            <section className="backlinks-panel" aria-label="Linked from">
              <div className="backlinks-heading">
                <span>LINKED FROM</span>
                <small>{backlinks.length}</small>
              </div>
              <div className="backlinks-list">
                {backlinks.slice(0, 5).map((source) => (
                  <button key={source.id} type="button" className="backlink-row" onClick={() => openBacklink(source)}>
                    <span className="backlink-emoji" aria-hidden="true">{source.emoji ?? "🐶"}</span>
                    <span className="backlink-copy">
                      <strong>{getNoteDisplayTitle(source)}</strong>
                      <small>{source.plainTextContent.trim().slice(0, 72) || "Empty note"}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {editor && canEdit && (
            <>
              <BubbleToolbar editor={editor} />
              <ImageToolbar editor={editor} onRemove={handleImageRemoval} />
              <TableToolbar editor={editor} />
            </>
          )}
        </article>
      </div>

      <footer className="editor-status-bar" aria-label="Editor status">
        <span className={cn("editor-status-words", selectedWordCount > 0 && "is-selection")}>
          <strong>{selectedWordCount > 0 ? selectedWordCount : (editor?.storage.characterCount.words() ?? 0)}</strong>
          <span>{selectedWordCount > 0 ? "SELECTED WORDS" : "WORDS"}</span>
        </span>
        {!note.isDeleted && (
          readOnly ? (
            <span className="editor-status-hint is-read-only-status">
              <Lock size={11} />
              <span>READ ONLY</span>
            </span>
          ) : showHints ? (
            <span className="editor-status-hint">
              <span>TYPE</span>
              <kbd>/</kbd>
              <span>FOR BLOCKS</span>
            </span>
          ) : null
        )}
      </footer>

      <AnimatePresence>
        {canEdit && blockInsertMenu && (
          <EditorMenu
            label="ADD BLOCK"
            items={[
              { id: "insert-text", label: "Text", description: "Plain paragraph", icon: Text, group: "BASIC", onSelect: () => insertBlockFromMenu("text") },
              { id: "insert-h1", label: "Heading 1", description: "Large section title", icon: Heading1, group: "BASIC", onSelect: () => insertBlockFromMenu("h1") },
              { id: "insert-h2", label: "Heading 2", description: "Medium section title", icon: Heading2, group: "BASIC", onSelect: () => insertBlockFromMenu("h2") },
              { id: "insert-h3", label: "Heading 3", description: "Small section title", icon: Heading3, group: "BASIC", onSelect: () => insertBlockFromMenu("h3") },
              { id: "insert-bullet", label: "Bullet list", description: "Simple list", icon: List, group: "LISTS", onSelect: () => insertBlockFromMenu("bullet") },
              { id: "insert-ordered", label: "Numbered list", description: "Ordered sequence", icon: ListOrdered, group: "LISTS", onSelect: () => insertBlockFromMenu("ordered") },
              { id: "insert-task", label: "To-do", description: "Task with checkbox", icon: CheckSquare2, group: "LISTS", onSelect: () => insertBlockFromMenu("task") },
              { id: "insert-quote", label: "Quote", description: "Quoted passage", icon: Quote, group: "MORE", onSelect: () => insertBlockFromMenu("quote") },
              { id: "insert-code", label: "Code", description: "Code block", icon: Code2, group: "MORE", onSelect: () => insertBlockFromMenu("code") },
              { id: "insert-divider", label: "Divider", description: "Section separator", icon: Minus, group: "MORE", onSelect: () => insertBlockFromMenu("divider") },
            ]}
            position={blockInsertMenu.position}
            onClose={closeBlockInsertMenu}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {canEdit && trigger?.kind === "slash" && (
          <EditorMenu
            label={slashItems.length ? "BLOCKS" : "NO MATCHING BLOCKS"}
            items={slashItems}
            position={trigger.position}
            onClose={dismissTrigger}
          />
        )}
        {canEdit && trigger?.kind === "note-link" && (
          <EditorMenu
            label={noteLinkItems.length ? "LINK A NOTE" : "NO MATCHING NOTES"}
            items={noteLinkItems}
            position={trigger.position}
            onClose={dismissTrigger}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {uploads.length > 0 && (
          <motion.div className="upload-stack glass" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>
            {uploads.map((upload) => (
              <div key={upload.id}>
                <span><strong>{upload.filename}</strong><small>{upload.progress < 100 ? "UPLOADING" : "READY"}</small></span>
                <i style={{ transform: `scaleX(${upload.progress / 100})` }} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {canEdit && dragActive && <div className="drop-indicator"><span><FilePlus2 size={18} /> DROP TO INSERT</span></div>}

      <input
        ref={imageInputRef}
        className="visually-hidden"
        type="file"
        aria-label="Insert image"
        accept="image/jpeg,image/png,image/webp,image/gif"
        tabIndex={-1}
        onChange={(event) => {
          if (editor) void uploadFiles(Array.from(event.target.files ?? []), editor);
          event.target.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        aria-label="Attach files"
        multiple
        tabIndex={-1}
        onChange={(event) => {
          if (editor) void uploadFiles(Array.from(event.target.files ?? []), editor);
          event.target.value = "";
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this note forever?"
        description="The note and its attachments cannot be recovered."
        confirmLabel="Delete forever"
        onConfirm={() => void confirmPermanentDelete()}
        onClose={() => setConfirmDelete(false)}
      />
    </section>
  );
}
