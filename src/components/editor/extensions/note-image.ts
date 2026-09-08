import Image from "@tiptap/extension-image";

export const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      attachmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes) =>
          attributes.attachmentId
            ? { "data-attachment-id": attributes.attachmentId }
            : {},
      },
    };
  },
}).configure({
  allowBase64: true,
  HTMLAttributes: { class: "note-image" },
  resize: {
    enabled: true,
    directions: ["top-left", "top-right", "bottom-left", "bottom-right"],
    minWidth: 160,
    minHeight: 90,
    alwaysPreserveAspectRatio: true,
  },
});
