"use client";

import { generateJSON } from "@tiptap/html";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { FontFamily, TextStyle } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import { marked } from "marked";
import { NoteImage } from "@/components/editor/extensions/note-image";
import { plainTextFromDocument } from "@/lib/utils";
import type { JSONContent } from "@tiptap/core";

export type MarkdownFrontmatter = {
  title?: string;
  emoji?: string;
};

export type ParsedMarkdownFile = {
  body: string;
  frontmatter: MarkdownFrontmatter;
};

const MARKDOWN_EXTENSIONS = [
  StarterKit.configure({
    link: {
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      protocols: ["note"],
    },
    heading: { levels: [1, 2, 3] },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({
    table: { resizable: false },
    tableCell: {},
    tableHeader: {},
    tableRow: {},
  }),
  TextStyle,
  FontFamily,
  Highlight.configure({ multicolor: true }),
  NoteImage,
];

function unquote(value: string) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function splitMarkdownFrontmatter(source: string): ParsedMarkdownFile {
  const normalized = source.replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return { body: normalized, frontmatter: {} };

  const frontmatter: MarkdownFrontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/);
    if (!field) continue;
    const key = field[1].toLowerCase();
    const value = unquote(field[2]);
    if (key === "title" && value) frontmatter.title = value;
    if ((key === "emoji" || key === "icon") && value) frontmatter.emoji = value;
  }

  return {
    body: normalized.slice(match[0].length),
    frontmatter,
  };
}

export function markdownFileTitle(filename: string) {
  return filename.replace(/\.(?:md|markdown)$/i, "").trim() || "Untitled";
}

function normalizeLookupKey(value: string) {
  return value
    .replace(/\\/g, "/")
    .replace(/^.*\//, "")
    .replace(/\.(?:md|markdown)$/i, "")
    .trim()
    .toLocaleLowerCase();
}

export function createWikiLinkLookup(entries: Array<{ title: string; id: string; filename?: string }>) {
  const lookup = new Map<string, string>();
  for (const entry of entries) {
    lookup.set(normalizeLookupKey(entry.title), entry.id);
    if (entry.filename) lookup.set(normalizeLookupKey(entry.filename), entry.id);
  }
  return lookup;
}

function escapeMarkdownLabel(value: string) {
  return value.replace(/([\\\[\]])/g, "\\$1");
}

function stripObsidianSyntax(markdown: string) {
  let value = markdown.replace(/\r\n?/g, "\n");

  // Obsidian/HTML comments are metadata, never note content.
  value = value.replace(/<!--[\s\S]*?-->/g, "");
  value = value.replace(/%%[\s\S]*?%%/g, "");

  // Obsidian callout markers: keep an optional human title, drop [!TYPE]+/-.
  value = value.replace(
    /^(\s*>\s*)\[![^\]\n]+\][+-]?\s*(.*)$/gim,
    (_full, quotePrefix: string, title: string) =>
      title.trim() ? `${quotePrefix}${title.trim()}` : "",
  );

  // Block IDs are internal Obsidian anchors and should not be visible.
  value = value.replace(/[ \t]+\^[A-Za-z0-9_-]+[ \t]*$/gm, "");

  // Preserve Obsidian highlights as the Notation yellow marker.
  value = value.replace(/==([^=\n]+)==/g, '<mark data-color="#FEF08A" style="background-color:#FEF08A">$1</mark>');

  // Footnote plumbing should not leak bracket syntax into rich text.
  value = value.replace(/^\s*\[\^[^\]\n]+\]:\s*/gm, "");
  value = value.replace(/\[\^[^\]\n]+\]/g, "");

  // Keep math contents readable until a dedicated math node is added.
  value = value.replace(/\$\$([\s\S]*?)\$\$/g, "$1");
  value = value.replace(/(^|[^\\])\$([^$\n]+)\$/g, "$1$2");

  return value.replace(/\n{3,}/g, "\n\n").trim();
}

function resolveObsidianWikiLinks(markdown: string, lookup: Map<string, string>) {
  return markdown.replace(/(!?)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_full, embed: string, rawTarget: string, rawAlias?: string) => {
    const target = rawTarget.trim();
    const alias = (rawAlias?.trim() || target).trim();
    const id = lookup.get(normalizeLookupKey(target));

    if (embed) {
      // A vault attachment is not present when importing standalone .md files,
      // so preserve a readable label instead of creating a broken image.
      return escapeMarkdownLabel(alias);
    }

    return id ? `[${escapeMarkdownLabel(alias)}](note:${id})` : escapeMarkdownLabel(alias);
  });
}

function normalizeTaskLists(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");

  for (const list of Array.from(document.querySelectorAll<HTMLUListElement>("ul"))) {
    const directItems = Array.from(list.children).filter(
      (child): child is HTMLLIElement => child instanceof HTMLLIElement,
    );
    if (!directItems.some((item) => item.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]:first-child'))) continue;

    const parent = list.parentNode;
    if (!parent) continue;
    const fragment = document.createDocumentFragment();
    let currentList: HTMLUListElement | null = null;
    let currentTaskState: boolean | null = null;

    for (const item of directItems) {
      const checkbox = item.querySelector<HTMLInputElement>(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]:first-child');
      const isTask = Boolean(checkbox);
      if (!currentList || currentTaskState !== isTask) {
        currentList = document.createElement("ul");
        if (isTask) currentList.setAttribute("data-type", "taskList");
        fragment.appendChild(currentList);
        currentTaskState = isTask;
      }

      if (checkbox) {
        item.setAttribute("data-type", "taskItem");
        item.setAttribute("data-checked", checkbox.checked ? "true" : "false");
        checkbox.remove();
      }
      currentList.appendChild(item);
    }

    parent.replaceChild(fragment, list);
  }

  return document.body.innerHTML;
}

export function markdownToNoteDocument(markdown: string, wikiLookup: Map<string, string>) {
  const cleanedMarkdown = stripObsidianSyntax(markdown);
  const withResolvedLinks = resolveObsidianWikiLinks(cleanedMarkdown, wikiLookup);
  const html = marked.parse(withResolvedLinks, {
    async: false,
    gfm: true,
    breaks: false,
  }) as string;
  const normalizedHtml = normalizeTaskLists(html);
  const content = generateJSON(normalizedHtml, MARKDOWN_EXTENSIONS) as JSONContent;
  return {
    content,
    plainTextContent: plainTextFromDocument(content),
  };
}
