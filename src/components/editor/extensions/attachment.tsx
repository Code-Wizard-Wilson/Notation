"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Download, FileArchive, FileAudio, FileCode2, FileText, FileVideo, Trash2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    attachment: {
      insertAttachment: (attributes: {
        attachmentId: string;
        filename: string;
        mimeType: string;
        size: number;
        url: string;
      }) => ReturnType;
    };
  }
}

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("audio/")) return <FileAudio size={18} />;
  if (mimeType.startsWith("video/")) return <FileVideo size={18} />;
  if (mimeType.includes("zip") || mimeType.includes("archive")) return <FileArchive size={18} />;
  if (mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("html")) return <FileCode2 size={18} />;
  return <FileText size={18} />;
}

function AttachmentView({ node, selected, deleteNode, editor }: ReactNodeViewProps) {
  const { attachmentId, filename, mimeType, size, url } = node.attrs as {
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
    url: string;
  };
  const href = url.startsWith("data:") ? url : `${url}?download=1`;

  function remove() {
    deleteNode();
    window.dispatchEvent(
      new CustomEvent("notation:remove-attachment", { detail: { attachmentId } }),
    );
  }

  return (
    <NodeViewWrapper
      className={`attachment-node${selected ? " is-selected" : ""}`}
      data-attachment-id={attachmentId}
      data-drag-handle
    >
      <span className="attachment-icon" aria-hidden="true"><AttachmentIcon mimeType={mimeType} /></span>
      <span className="attachment-copy">
        <strong title={filename}>{filename}</strong>
        <small>{formatBytes(Number(size))}</small>
      </span>
      <span className="attachment-actions" contentEditable={false}>
        <a href={href} download={url.startsWith("data:") ? filename : undefined} target="_blank" rel="noreferrer" aria-label={`Download ${filename}`}>
          <Download size={15} />
        </a>
        {editor.isEditable && (
          <button type="button" onClick={remove} aria-label={`Remove ${filename}`}>
            <Trash2 size={15} />
          </button>
        )}
      </span>
    </NodeViewWrapper>
  );
}

export const AttachmentExtension = Node.create({
  name: "attachment",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      attachmentId: { default: null },
      filename: { default: "Attachment" },
      mimeType: { default: "application/octet-stream" },
      size: { default: 0 },
      url: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-notation-attachment]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-notation-attachment": "",
      }),
    ];
  },

  addCommands() {
    return {
      insertAttachment:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentView);
  },
});
