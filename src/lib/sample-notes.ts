import type { JSONContent } from "@tiptap/core";
import { LOCAL_USER_ID } from "@/lib/constants";
import type { Note } from "@/types/note";

const productContent: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "The editor should feel almost invisible while writing." }],
    },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Priorities" }] },
    {
      type: "bulletList",
      content: ["Instant search", "Better mobile navigation", "Faster attachments", "Keyboard-first workflows"].map(
        (text) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }),
      ),
    },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Prototype" }] },
    {
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Build editor prototype" }] }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Add file uploads" }] }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Test mobile navigation" }] }] },
      ],
    },
  ],
};

const referencesContent: JSONContent = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Ideas for a quieter, more editorial interface." }] },
    {
      type: "blockquote",
      content: [{ type: "paragraph", content: [{ type: "text", text: "The interface should disappear when writing and become expressive while navigating." }] }],
    },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Reading list" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Review " },
        { type: "text", marks: [{ type: "link", attrs: { href: "https://tiptap.dev", target: "_blank", rel: "noopener noreferrer nofollow", class: null } }], text: "TipTap documentation" },
        { type: "text", text: " before refining custom extensions." },
      ],
    },
  ],
};

export function createSampleNotes(userId = LOCAL_USER_ID): Note[] {
  const now = Date.now();
  return [
    {
      id: crypto.randomUUID(),
      userId,
      title: "Product direction",
      content: productContent,
      plainTextContent: "The editor should feel almost invisible while writing. Priorities Instant search Better mobile navigation Faster attachments Keyboard-first workflows Prototype Build editor prototype Add file uploads Test mobile navigation",
      isPinned: true,
      isArchived: false,
      isDeleted: false,
      createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 4).toISOString(),
      deletedAt: null,
      attachments: [],
      syncState: "idle",
    },
    {
      id: crypto.randomUUID(),
      userId,
      title: "Visual references",
      content: referencesContent,
      plainTextContent: "Ideas for a quieter, more editorial interface. The interface should disappear when writing and become expressive while navigating. Reading list Review TipTap documentation before refining custom extensions.",
      isPinned: false,
      isArchived: false,
      isDeleted: false,
      createdAt: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 48).toISOString(),
      deletedAt: null,
      attachments: [],
      syncState: "idle",
    },
  ];
}
