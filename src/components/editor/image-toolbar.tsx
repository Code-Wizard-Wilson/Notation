"use client";

import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { Trash2 } from "lucide-react";

function applyLiveImageSize(editor: Editor, position: number, width: number, height: number) {
  const nodeDom = editor.view.nodeDOM(position);
  const container = nodeDom instanceof HTMLElement ? nodeDom : null;
  const wrapper = container?.matches("[data-resize-wrapper]")
    ? container
    : container?.querySelector<HTMLElement>("[data-resize-wrapper]") ?? null;
  const image = container instanceof HTMLImageElement
    ? container
    : container?.querySelector<HTMLImageElement>("img") ?? null;

  if (wrapper) {
    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;
  }
  if (image) {
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
  }
}

function setImageSize(editor: Editor, percent: number) {
  const { selection } = editor.state;
  const position = selection.from;
  const nodeDom = editor.view.nodeDOM(position);
  const container = nodeDom instanceof HTMLElement ? nodeDom : null;
  const image = container instanceof HTMLImageElement
    ? container
    : container?.querySelector<HTMLImageElement>("img") ?? null;

  const editorWidth = editor.view.dom.getBoundingClientRect().width;
  if (!Number.isFinite(editorWidth) || editorWidth <= 0) return;

  const targetWidth = Math.max(160, Math.round(editorWidth * (percent / 100)));

  let ratio = 9 / 16;
  if (image) {
    const rect = image.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) ratio = rect.height / rect.width;
    else if (image.naturalWidth > 0 && image.naturalHeight > 0) ratio = image.naturalHeight / image.naturalWidth;
  }

  const targetHeight = Math.max(1, Math.round(targetWidth * ratio));

  editor
    .chain()
    .focus()
    .setNodeSelection(position)
    .updateAttributes("image", { width: targetWidth, height: targetHeight })
    .run();

  // Tiptap's resizable Image NodeView persists numeric width/height correctly,
  // but it doesn't repaint programmatic attribute changes until the node view
  // remounts. Keep the current wrapper in sync so preset buttons resize live.
  applyLiveImageSize(editor, position, targetWidth, targetHeight);
  window.requestAnimationFrame(() => applyLiveImageSize(editor, position, targetWidth, targetHeight));
}

export function ImageToolbar({
  editor,
  onRemove,
}: {
  editor: Editor;
  onRemove: (attachmentId?: string) => void;
}) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="image-formatting-menu"
      updateDelay={60}
      options={{ placement: "top", offset: 9, flip: true, shift: { padding: 10 } }}
      shouldShow={({ editor: instance }) => instance.isEditable && instance.isActive("image")}
      className="image-toolbar menu-surface"
    >
      <span>SIZE</span>
      {[50, 75, 100].map((width) => (
        <button
          key={width}
          type="button"
          aria-label={`Set image size to ${width}%`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setImageSize(editor, width)}
        >
          {width}
        </button>
      ))}
      <span className="toolbar-separator" />
      <button
        type="button"
        className="image-delete"
        aria-label="Delete image"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          const attachmentId = editor.getAttributes("image").attachmentId as string | undefined;
          editor.chain().focus().deleteSelection().run();
          onRemove(attachmentId);
        }}
      >
        <Trash2 size={14} />
      </button>
    </BubbleMenu>
  );
}
