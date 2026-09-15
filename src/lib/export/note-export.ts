import type { JSONContent } from "@tiptap/core";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Note } from "@/types/note";

function textContent(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(textContent).join("");
}

function escapeMarkdownLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function escapeMarkdownUrl(value: string) {
  return value.replace(/\)/g, "%29").replace(/\s/g, "%20");
}

function renderInline(node: JSONContent): string {
  if (node.type === "hardBreak") return "  \n";
  if (node.type === "image") {
    const alt = escapeMarkdownLabel(String(node.attrs?.alt ?? "image"));
    const src = escapeMarkdownUrl(String(node.attrs?.src ?? ""));
    return src ? `![${alt}](${src})` : "";
  }
  if (node.type !== "text") return (node.content ?? []).map(renderInline).join("");

  let value = node.text ?? "";
  const marks = node.marks ?? [];
  if (marks.some((mark) => mark.type === "code")) {
    const fence = value.includes("`") ? "``" : "`";
    value = `${fence}${value}${fence}`;
  }
  if (marks.some((mark) => mark.type === "bold")) value = `**${value}**`;
  if (marks.some((mark) => mark.type === "italic")) value = `*${value}*`;
  if (marks.some((mark) => mark.type === "strike")) value = `~~${value}~~`;
  if (marks.some((mark) => mark.type === "underline")) value = `<u>${value}</u>`;
  const highlight = marks.find((mark) => mark.type === "highlight");
  if (highlight) {
    const color = String(highlight.attrs?.color ?? "#FEF08A");
    value = `<mark style="background-color:${color}">${value}</mark>`;
  }
  const textStyle = marks.find((mark) => mark.type === "textStyle");
  const fontFamily = String(textStyle?.attrs?.fontFamily ?? "");
  if (fontFamily) value = `<span style="font-family:${fontFamily}">${value}</span>`;

  const link = marks.find((mark) => mark.type === "link");
  const href = String(link?.attrs?.href ?? "");
  if (href) value = `[${escapeMarkdownLabel(value)}](${escapeMarkdownUrl(href)})`;
  return value;
}

function tableCellMarkdown(node: JSONContent): string {
  const value = (node.content ?? [])
    .map((child) => child.type === "paragraph"
      ? (child.content ?? []).map(renderInline).join("")
      : textContent(child))
    .join("<br>")
    .replace(/\n/g, "<br>")
    .replace(/\|/g, "\\|");
  return value || " ";
}

function renderMarkdownTable(node: JSONContent): string {
  const rows = node.content ?? [];
  if (!rows.length) return "";
  const cols = Math.max(1, ...rows.map((row) => row.content?.length ?? 0));
  const first = rows[0];
  const hasHeader = Boolean(first?.content?.some((cell) => cell.type === "tableHeader"));
  const normalize = (row?: JSONContent) => Array.from({ length: cols }, (_, index) => tableCellMarkdown(row?.content?.[index] ?? { type: "tableCell" }));
  const header = hasHeader ? normalize(first) : Array.from({ length: cols }, () => " ");
  const body = hasHeader ? rows.slice(1) : rows;
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`,
    ...body.map((row) => `| ${normalize(row).join(" | ")} |`),
  ];
  return `${lines.join("\n")}\n\n`;
}

function renderList(node: JSONContent, indent = 0): string {
  const ordered = node.type === "orderedList";
  const task = node.type === "taskList";
  const start = Number(node.attrs?.start ?? 1);
  const pad = " ".repeat(indent);

  return (node.content ?? [])
    .map((item, index) => {
      const children = item.content ?? [];
      const first = children[0];
      const body = first?.type === "paragraph" ? (first.content ?? []).map(renderInline).join("") : first ? renderBlock(first).trim() : "";
      const marker = task
        ? `- [${item.attrs?.checked ? "x" : " "}] `
        : ordered
          ? `${start + index}. `
          : "- ";
      const nested = children
        .slice(1)
        .map((child) => renderBlock(child, indent + 2).trimEnd())
        .filter(Boolean)
        .join("\n");
      return `${pad}${marker}${body}${nested ? `\n${nested}` : ""}`;
    })
    .join("\n");
}

function renderBlock(node: JSONContent, indent = 0): string {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map((child) => renderBlock(child, indent)).join("");
    case "paragraph":
      return `${(node.content ?? []).map(renderInline).join("")}\n\n`;
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `${"#".repeat(level)} ${(node.content ?? []).map(renderInline).join("")}\n\n`;
    }
    case "bulletList":
    case "orderedList":
    case "taskList":
      return `${renderList(node, indent)}\n\n`;
    case "blockquote": {
      const inner = (node.content ?? []).map((child) => renderBlock(child, indent)).join("").trimEnd();
      return `${inner.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
    }
    case "codeBlock": {
      const language = String(node.attrs?.language ?? "");
      return `\`\`\`${language}\n${textContent(node)}\n\`\`\`\n\n`;
    }
    case "table":
      return renderMarkdownTable(node);
    case "horizontalRule":
      return "---\n\n";
    case "image":
      return `${renderInline(node)}\n\n`;
    case "attachment": {
      const filename = String(node.attrs?.filename ?? "Attachment");
      const url = String(node.attrs?.url ?? "");
      return url ? `[${escapeMarkdownLabel(filename)}](${escapeMarkdownUrl(url)})\n\n` : `${filename}\n\n`;
    }
    default: {
      const inline = (node.content ?? []).map(renderInline).join("");
      return inline ? `${inline}\n\n` : "";
    }
  }
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

export function noteToMarkdown(note: Note) {
  const title = note.title.trim() || "Untitled";
  const emoji = note.emoji ?? "🐶";
  const body = renderBlock(note.content).trimEnd();
  return [
    "---",
    `title: ${yamlString(title)}`,
    `emoji: ${yamlString(emoji)}`,
    "---",
    "",
    `# ${title}`,
    "",
    body,
    "",
  ].join("\n");
}

export function safeExportFilename(value: string) {
  const normalized = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 96);
  return normalized || "Untitled";
}

export function downloadNoteMarkdown(note: Note) {
  const blob = new Blob([noteToMarkdown(note)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeExportFilename(note.title)}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}


type PdfInline = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  decoration?: "underline" | "lineThrough" | Array<"underline" | "lineThrough">;
  link?: string;
  color?: string;
  background?: string;
};

function inlinePdf(node: JSONContent): PdfInline[] {
  if (node.type === "hardBreak") return [{ text: "\n" }];
  if (node.type !== "text") return (node.content ?? []).flatMap(inlinePdf);

  const marks = node.marks ?? [];
  const decorations: Array<"underline" | "lineThrough"> = [];
  if (marks.some((mark) => mark.type === "underline")) decorations.push("underline");
  if (marks.some((mark) => mark.type === "strike")) decorations.push("lineThrough");
  const link = marks.find((mark) => mark.type === "link");
  const href = String(link?.attrs?.href ?? "");

  const run: PdfInline = {
    text: node.text ?? "",
    bold: marks.some((mark) => mark.type === "bold"),
    italics: marks.some((mark) => mark.type === "italic"),
  };
  if (decorations.length === 1) run.decoration = decorations[0];
  else if (decorations.length > 1) run.decoration = decorations;
  const highlight = marks.find((mark) => mark.type === "highlight");
  if (highlight) run.background = String(highlight.attrs?.color ?? "#FEF08A");
  if (href && !href.startsWith("note:")) {
    run.link = href;
    run.color = "#44403c";
    run.decoration = "underline";
  }
  return [run];
}

function paragraphText(node: JSONContent) {
  return (node.content ?? []).flatMap(inlinePdf);
}

function taskCheckboxSvg(checked: boolean) {
  return checked
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><rect x="0.75" y="0.75" width="12.5" height="12.5" rx="3" fill="#171717"/><path d="M3.6 7.1 5.8 9.25 10.35 4.65" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="3" fill="#fff" stroke="#a8a29e" stroke-width="1.2"/></svg>`;
}

function emojiToPngDataUrl(emoji: string) {
  if (!emoji || typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.clearRect(0, 0, 128, 128);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = '88px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    context.fillText(emoji, 64, 68);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function listItemStack(node: JSONContent): Content[] {
  const children = node.content ?? [];
  const out: Content[] = [];
  for (const child of children) {
    if (child.type === "paragraph") {
      out.push({ text: paragraphText(child), margin: [0, 0, 0, 1] });
    } else {
      out.push(...blockPdf(child));
    }
  }
  return out.length ? out : [{ text: "" }];
}

function pdfTableCell(node: JSONContent, header: boolean): Content {
  return {
    text: textContent(node),
    bold: header,
    fillColor: header ? "#fafaf9" : "#ffffff",
    color: header ? "#44403c" : "#202124",
    margin: [4, 4, 4, 4],
  };
}

function blockPdf(node: JSONContent): Content[] {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).flatMap(blockPdf);
    case "paragraph":
      return [{ text: paragraphText(node), style: "body", margin: [0, 0, 0, 5] }];
    case "heading": {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
      return [{
        text: paragraphText(node),
        style: level === 1 ? "h1" : level === 2 ? "h2" : "h3",
        margin: [0, level === 1 ? 12 : 10, 0, 5],
      }];
    }
    case "bulletList":
      return [{
        ul: (node.content ?? []).map((item) => ({ stack: listItemStack(item) })),
        margin: [8, 2, 0, 7],
      }];
    case "orderedList":
      return [{
        ol: (node.content ?? []).map((item) => ({ stack: listItemStack(item) })),
        start: Number(node.attrs?.start ?? 1),
        margin: [8, 2, 0, 7],
      }];
    case "taskList":
      return (node.content ?? []).map((item) => {
        const checked = Boolean(item.attrs?.checked);
        const first = item.content?.[0];
        const inline = first?.type === "paragraph" ? paragraphText(first) : [{ text: textContent(item) }];
        return {
          columns: [
            { svg: taskCheckboxSvg(checked), width: 14, margin: [0, 1.5, 0, 0] },
            { text: inline, width: "*", color: checked ? "#78716c" : "#202124", decoration: checked ? "lineThrough" : undefined },
          ],
          columnGap: 7,
          margin: [0, 0, 0, 4],
        } as Content;
      });
    case "blockquote":
      return [{
        table: {
          widths: [2, "*"],
          body: [[
            { text: "", fillColor: "#d6d3d1", border: [false, false, false, false] },
            { stack: (node.content ?? []).flatMap(blockPdf), color: "#57534e", margin: [8, 0, 0, 0], border: [false, false, false, false] },
          ]],
        },
        layout: "noBorders",
        margin: [0, 5, 0, 9],
      }];
    case "codeBlock":
      return [{
        text: textContent(node),
        fontSize: 9.5,
        lineHeight: 1.25,
        color: "#292524",
        background: "#f5f5f4",
        margin: [0, 5, 0, 9],
      }];
    case "table": {
      const rows = node.content ?? [];
      if (!rows.length) return [];
      const cols = Math.max(1, ...rows.map((row) => row.content?.length ?? 0));
      const hasHeader = Boolean(rows[0]?.content?.some((cell) => cell.type === "tableHeader"));
      const body = rows.map((row, rowIndex) =>
        Array.from({ length: cols }, (_, index) =>
          pdfTableCell(row.content?.[index] ?? { type: "tableCell" }, hasHeader && rowIndex === 0),
        ),
      );
      return [{
        table: { headerRows: hasHeader ? 1 : 0, widths: Array.from({ length: cols }, () => "*"), body },
        layout: {
          hLineWidth: () => 0.6,
          vLineWidth: () => 0.6,
          hLineColor: () => "#e7e5e4",
          vLineColor: () => "#e7e5e4",
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
        margin: [0, 6, 0, 10],
      }];
    }
    case "horizontalRule":
      return [{
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 470, y2: 0, lineWidth: 0.6, lineColor: "#e7e5e4" }],
        margin: [0, 9, 0, 10],
      }];
    case "attachment": {
      const filename = String(node.attrs?.filename ?? "Attachment");
      return [{
        text: `Attachment: ${filename}`,
        color: "#57534e",
        background: "#fafaf9",
        margin: [0, 4, 0, 7],
      }];
    }
    default: {
      const value = textContent(node).trim();
      return value ? [{ text: value, style: "body", margin: [0, 0, 0, 5] }] : [];
    }
  }
}

function collectImages(node: JSONContent, out: string[] = []) {
  if (node.type === "image") {
    const src = String(node.attrs?.src ?? "");
    if (src) out.push(src);
  }
  for (const child of node.content ?? []) collectImages(child, out);
  return out;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

async function resolvePdfImages(note: Note) {
  const sources = [...new Set(collectImages(note.content))];
  const images: Record<string, string> = {};
  await Promise.all(sources.map(async (src, index) => {
    try {
      if (src.startsWith("data:image/")) {
        images[`image_${index}`] = src;
        return;
      }
      const absolute = new URL(src, window.location.href).toString();
      const response = await fetch(absolute);
      if (!response.ok) return;
      images[`image_${index}`] = await blobToDataUrl(await response.blob());
    } catch {
      // If an image cannot be fetched (for example because of CORS), export the rest of the note.
    }
  }));
  return { images, sources };
}

function blockPdfWithImages(node: JSONContent, sourceKeys: Map<string, string>): Content[] {
  if (node.type === "image") {
    const src = String(node.attrs?.src ?? "");
    const key = sourceKeys.get(src);
    if (!key) return [{ text: "[Image unavailable]", color: "#a8a29e", margin: [0, 4, 0, 8] }];
    return [{ image: key, fit: [470, 360], alignment: "center", margin: [0, 7, 0, 10] }];
  }
  if (node.type === "doc") return (node.content ?? []).flatMap((child) => blockPdfWithImages(child, sourceKeys));
  if (node.type === "blockquote") {
    return [{
      table: {
        widths: [2, "*"],
        body: [[
          { text: "", fillColor: "#d6d3d1", border: [false, false, false, false] },
          { stack: (node.content ?? []).flatMap((child) => blockPdfWithImages(child, sourceKeys)), color: "#57534e", margin: [8, 0, 0, 0], border: [false, false, false, false] },
        ]],
      },
      layout: "noBorders",
      margin: [0, 5, 0, 9],
    }];
  }
  return blockPdf(node);
}

export async function exportNoteAsPdf(note: Note) {
  const { images, sources } = await resolvePdfImages(note);
  const sourceKeys = new Map<string, string>();
  sources.forEach((src, index) => {
    const key = `image_${index}`;
    if (images[key]) sourceKeys.set(src, key);
  });

  pdfMake.addVirtualFileSystem(pdfFonts);

  const title = note.title.trim() || "Untitled";
  const emojiImage = emojiToPngDataUrl(note.emoji ?? "");
  if (emojiImage) images.note_emoji = emojiImage;

  const content: Content[] = [
    ...(emojiImage ? [{ image: "note_emoji", width: 18, height: 18, margin: [0, 0, 0, 10] } as Content] : []),
    { text: title, style: "title", margin: [0, 0, 0, 18] },
    ...blockPdfWithImages(note.content, sourceKeys),
  ];

  const definition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [56, 54, 56, 58],
    info: { title, creator: "Notation" },
    defaultStyle: {
      font: "Roboto",
      fontSize: 11.5,
      lineHeight: 1.32,
      color: "#202124",
    },
    styles: {
      title: { fontSize: 26, bold: true, lineHeight: 1.06, color: "#171717" },
      body: { fontSize: 11.5, lineHeight: 1.32 },
      h1: { fontSize: 20, bold: true, lineHeight: 1.12, color: "#171717" },
      h2: { fontSize: 15.5, bold: true, lineHeight: 1.16, color: "#202124" },
      h3: { fontSize: 13, bold: true, lineHeight: 1.18, color: "#292524" },
    },
    images,
    content,
    footer: (currentPage, pageCount) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: "right",
      margin: [0, 8, 56, 0],
      color: "#a8a29e",
      fontSize: 8.5,
    }),
  };

  await pdfMake.createPdf(definition).download(`${safeExportFilename(title)}.pdf`);
}
