import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.NOTATION_BACKUP_PORT || 4317);
const HOST = "127.0.0.1";
const DATA_DIR =
  process.env.NOTATION_DATA_DIR || path.join(os.homedir(), "Documents", "Notation Data");

const WORKSPACE_FILE = path.join(DATA_DIR, "workspace.json");
const NOTES_JSON_FILE = path.join(DATA_DIR, "notes.json");
const FOLDERS_FILE = path.join(DATA_DIR, "folders.json");
const NOTES_DIR = path.join(DATA_DIR, "Notes");
const ATTACHMENTS_DIR = path.join(DATA_DIR, "Attachments");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const MANIFEST_FILE = path.join(DATA_DIR, ".notation-files.json");

fs.mkdirSync(BACKUPS_DIR, { recursive: true });
fs.mkdirSync(NOTES_DIR, { recursive: true });
fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

let workspace = readJson(WORKSPACE_FILE, {
  version: 1,
  savedAt: new Date(0).toISOString(),
  notes: [],
  folders: [],
});
if (!Array.isArray(workspace.notes)) workspace.notes = [];
if (!Array.isArray(workspace.folders)) workspace.folders = [];

let fileManifest = readJson(MANIFEST_FILE, {});
if (!fileManifest || typeof fileManifest !== "object" || Array.isArray(fileManifest)) {
  fileManifest = {};
}

let lastSnapshotAt = 0;

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, text, "utf8");
  fs.renameSync(tmp, file);
}

function writeJson(file, value) {
  writeAtomic(file, JSON.stringify(value, null, 2) + "\n");
}

function pruneBackups() {
  const files = fs
    .readdirSync(BACKUPS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse();

  for (const file of files.slice(100)) {
    try {
      fs.unlinkSync(path.join(BACKUPS_DIR, file));
    } catch {}
  }
}

function safeName(value, fallback = "Untitled") {
  const normalized = String(value || "")
    .normalize("NFC")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 120);
  return normalized || fallback;
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

function escapeMarkdownLabel(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function escapeMarkdownUrl(value) {
  return String(value).replace(/\)/g, "%29").replace(/\s/g, "%20");
}

function dataUrlInfo(url) {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/s.exec(String(url || ""));
  if (!match) return null;
  return { mime: match[1] || "application/octet-stream", bytes: Buffer.from(match[2], "base64") };
}

function extensionForMime(mime) {
  const known = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/markdown": ".md",
  };
  return known[mime] || "";
}

function makeMediaResolver(note) {
  const noteDir = path.join(ATTACHMENTS_DIR, safeName(note.id, "note"));
  fs.mkdirSync(noteDir, { recursive: true });
  let imageIndex = 0;
  const cache = new Map();

  return (rawUrl, suggestedName = "") => {
    const url = String(rawUrl || "");
    if (!url.startsWith("data:")) return url;
    if (cache.has(url)) return cache.get(url);

    const decoded = dataUrlInfo(url);
    if (!decoded) return url;

    imageIndex += 1;
    const original = safeName(suggestedName, "");
    const hasExtension = /\.[a-z0-9]{1,10}$/i.test(original);
    const filename = original
      ? hasExtension
        ? original
        : original + extensionForMime(decoded.mime)
      : "image-" + imageIndex + extensionForMime(decoded.mime);

    let target = path.join(noteDir, filename || "asset-" + imageIndex);
    let suffix = 2;
    while (fs.existsSync(target) && !fs.readFileSync(target).equals(decoded.bytes)) {
      const parsed = path.parse(filename || "asset-" + imageIndex);
      target = path.join(noteDir, parsed.name + "-" + suffix + parsed.ext);
      suffix += 1;
    }

    fs.writeFileSync(target, decoded.bytes);
    const relative = path.relative(path.dirname(currentMarkdownPath), target).split(path.sep).join("/");
    const markdownUrl = relative.startsWith(".") ? relative : "./" + relative;
    cache.set(url, markdownUrl);
    return markdownUrl;
  };
}

let currentMarkdownPath = "";

function textContent(node) {
  if (!node || typeof node !== "object") return "";
  if (node.type === "text") return node.text || "";
  return (node.content || []).map(textContent).join("");
}

function renderInline(node, mediaResolver) {
  if (!node || typeof node !== "object") return "";
  if (node.type === "hardBreak") return "  \n";

  if (node.type === "image") {
    const alt = escapeMarkdownLabel(node.attrs?.alt || "image");
    const source = mediaResolver(node.attrs?.src || "", node.attrs?.title || "");
    return source ? "![" + alt + "](" + escapeMarkdownUrl(source) + ")" : "";
  }

  if (node.type !== "text") {
    return (node.content || []).map((child) => renderInline(child, mediaResolver)).join("");
  }

  let value = node.text || "";
  const marks = node.marks || [];

  if (marks.some((mark) => mark.type === "code")) {
    const fence = value.includes("`") ? "``" : "`";
    value = fence + value + fence;
  }
  if (marks.some((mark) => mark.type === "bold")) value = "**" + value + "**";
  if (marks.some((mark) => mark.type === "italic")) value = "*" + value + "*";
  if (marks.some((mark) => mark.type === "strike")) value = "~~" + value + "~~";
  if (marks.some((mark) => mark.type === "underline")) value = "<u>" + value + "</u>";

  const highlight = marks.find((mark) => mark.type === "highlight");
  if (highlight) {
    const color = String(highlight.attrs?.color || "#FEF08A");
    value = '<mark style="background-color:' + color + '">' + value + "</mark>";
  }

  const textStyle = marks.find((mark) => mark.type === "textStyle");
  const fontFamily = String(textStyle?.attrs?.fontFamily || "");
  if (fontFamily) {
    value = '<span style="font-family:' + fontFamily + '">' + value + "</span>";
  }

  const link = marks.find((mark) => mark.type === "link");
  const href = String(link?.attrs?.href || "");
  if (href) value = "[" + escapeMarkdownLabel(value) + "](" + escapeMarkdownUrl(href) + ")";

  return value;
}

function tableCellMarkdown(node, mediaResolver) {
  return (node?.content || [])
    .map((child) =>
      child.type === "paragraph"
        ? (child.content || []).map((inline) => renderInline(inline, mediaResolver)).join("")
        : textContent(child),
    )
    .join("<br>")
    .replace(/\n/g, "<br>")
    .replace(/\|/g, "\\|") || " ";
}

function renderTable(node, mediaResolver) {
  const rows = node.content || [];
  if (!rows.length) return "";

  const cols = Math.max(1, ...rows.map((row) => row.content?.length || 0));
  const first = rows[0];
  const hasHeader = Boolean(first?.content?.some((cell) => cell.type === "tableHeader"));
  const normalize = (row) =>
    Array.from({ length: cols }, (_, index) =>
      tableCellMarkdown(row?.content?.[index] || { type: "tableCell" }, mediaResolver),
    );
  const header = hasHeader ? normalize(first) : Array.from({ length: cols }, () => " ");
  const body = hasHeader ? rows.slice(1) : rows;

  return [
    "| " + header.join(" | ") + " |",
    "| " + Array.from({ length: cols }, () => "---").join(" | ") + " |",
    ...body.map((row) => "| " + normalize(row).join(" | ") + " |"),
    "",
    "",
  ].join("\n");
}

function renderList(node, mediaResolver, indent = 0) {
  const ordered = node.type === "orderedList";
  const task = node.type === "taskList";
  const start = Number(node.attrs?.start || 1);
  const pad = " ".repeat(indent);

  return (node.content || [])
    .map((item, index) => {
      const children = item.content || [];
      const first = children[0];
      const body =
        first?.type === "paragraph"
          ? (first.content || []).map((inline) => renderInline(inline, mediaResolver)).join("")
          : first
            ? renderBlock(first, mediaResolver).trim()
            : "";

      const marker = task
        ? "- [" + (item.attrs?.checked ? "x" : " ") + "] "
        : ordered
          ? start + index + ". "
          : "- ";

      const nested = children
        .slice(1)
        .map((child) => renderBlock(child, mediaResolver, indent + 2).trimEnd())
        .filter(Boolean)
        .join("\n");

      return pad + marker + body + (nested ? "\n" + nested : "");
    })
    .join("\n");
}

function renderBlock(node, mediaResolver, indent = 0) {
  if (!node || typeof node !== "object") return "";

  switch (node.type) {
    case "doc":
      return (node.content || []).map((child) => renderBlock(child, mediaResolver, indent)).join("");
    case "paragraph":
      return (node.content || []).map((child) => renderInline(child, mediaResolver)).join("") + "\n\n";
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level || 1)));
      return "#".repeat(level) + " " + (node.content || []).map((child) => renderInline(child, mediaResolver)).join("") + "\n\n";
    }
    case "bulletList":
    case "orderedList":
    case "taskList":
      return renderList(node, mediaResolver, indent) + "\n\n";
    case "blockquote": {
      const inner = (node.content || [])
        .map((child) => renderBlock(child, mediaResolver, indent))
        .join("")
        .trimEnd();
      return inner.split("\n").map((line) => "> " + line).join("\n") + "\n\n";
    }
    case "codeBlock": {
      const language = String(node.attrs?.language || "");
      return "```" + language + "\n" + textContent(node) + "\n```\n\n";
    }
    case "table":
      return renderTable(node, mediaResolver);
    case "horizontalRule":
      return "---\n\n";
    case "image":
      return renderInline(node, mediaResolver) + "\n\n";
    case "attachment": {
      const filename = String(node.attrs?.filename || "Attachment");
      const source = mediaResolver(node.attrs?.url || "", filename);
      return source
        ? "[" + escapeMarkdownLabel(filename) + "](" + escapeMarkdownUrl(source) + ")\n\n"
        : filename + "\n\n";
    }
    default: {
      const inline = (node.content || []).map((child) => renderInline(child, mediaResolver)).join("");
      return inline ? inline + "\n\n" : "";
    }
  }
}

function noteMarkdown(note, folderName) {
  const title = String(note.title || "").trim() || "Untitled";
  const mediaResolver = makeMediaResolver(note);
  const body = renderBlock(note.content || { type: "doc", content: [] }, mediaResolver).trimEnd();

  return [
    "---",
    "notation_id: " + yamlString(note.id || ""),
    "title: " + yamlString(title),
    "emoji: " + yamlString(note.emoji || ""),
    "folder: " + yamlString(folderName || ""),
    "pinned: " + Boolean(note.isPinned),
    "archived: " + Boolean(note.isArchived),
    "deleted: " + Boolean(note.isDeleted),
    "created_at: " + yamlString(note.createdAt || ""),
    "updated_at: " + yamlString(note.updatedAt || ""),
    "---",
    "",
    "# " + title,
    "",
    body,
    "",
  ].join("\n");
}

function noteDirectory(note, folderById) {
  if (note.isDeleted) return path.join(NOTES_DIR, "_Trash");
  if (note.isArchived) return path.join(NOTES_DIR, "_Archive");
  const folderName = note.folderId ? folderById.get(note.folderId) : "";
  return folderName ? path.join(NOTES_DIR, safeName(folderName, "Folder")) : NOTES_DIR;
}

function syncMarkdownFiles() {
  const folderById = new Map(workspace.folders.map((folder) => [folder.id, folder.name]));
  const desired = {};
  const occupied = new Set();

  for (const note of workspace.notes) {
    const folderName = note.folderId ? folderById.get(note.folderId) || "" : "";
    const baseDir = noteDirectory(note, folderById);
    const baseName = safeName(note.title, "Untitled");

    let filename = baseName + ".md";
    let candidate = path.join(baseDir, filename);
    const key = candidate.toLocaleLowerCase();

    if (occupied.has(key)) {
      const suffix = String(note.id || crypto.randomUUID()).replace(/[^a-z0-9]/gi, "").slice(0, 8);
      filename = baseName + " -- " + (suffix || "note") + ".md";
      candidate = path.join(baseDir, filename);
    }
    occupied.add(candidate.toLocaleLowerCase());

    desired[note.id] = candidate;
    currentMarkdownPath = candidate;
    writeAtomic(candidate, noteMarkdown(note, folderName));
  }

  for (const [noteId, oldFile] of Object.entries(fileManifest)) {
    if (desired[noteId] === oldFile) continue;
    try {
      const resolved = path.resolve(String(oldFile));
      if (resolved.startsWith(path.resolve(NOTES_DIR) + path.sep) && fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
      }
    } catch {}
  }

  fileManifest = desired;
  writeJson(MANIFEST_FILE, fileManifest);
}

function persist() {
  const now = Date.now();
  const previous = fs.existsSync(WORKSPACE_FILE)
    ? fs.readFileSync(WORKSPACE_FILE, "utf8")
    : "";

  workspace.version = 1;
  workspace.savedAt = new Date().toISOString();
  const nextText = JSON.stringify(workspace, null, 2) + "\n";
  const changed = previous !== nextText;

  if (previous && changed && now - lastSnapshotAt > 60_000) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(WORKSPACE_FILE, path.join(BACKUPS_DIR, stamp + ".json"));
    lastSnapshotAt = now;
    pruneBackups();
  }

  writeAtomic(WORKSPACE_FILE, nextText);
  writeJson(NOTES_JSON_FILE, workspace.notes);
  writeJson(FOLDERS_FILE, workspace.folders);
  syncMarkdownFiles();
}

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "Origin");
  }
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

function originAllowed(req) {
  const origin = req.headers.origin;
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function json(req, res, status, payload) {
  cors(req, res);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (!originAllowed(req)) {
    json(req, res, 403, { ok: false, error: "Origin not allowed" });
    return;
  }

  if (req.method === "OPTIONS") {
    cors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    json(req, res, 200, {
      ok: true,
      dataDir: DATA_DIR,
      markdownDir: NOTES_DIR,
      notes: workspace.notes.length,
    });
    return;
  }

  if (req.method === "GET" && req.url === "/workspace") {
    json(req, res, 200, workspace);
    return;
  }

  if (req.method === "POST" && req.url === "/workspace") {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 512 * 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        const update = JSON.parse(body || "{}");
        if (update.notes !== undefined) {
          if (!Array.isArray(update.notes)) throw new Error("notes must be an array");
          workspace.notes = update.notes;
        }
        if (update.folders !== undefined) {
          if (!Array.isArray(update.folders)) throw new Error("folders must be an array");
          workspace.folders = update.folders;
        }

        persist();
        json(req, res, 200, {
          ok: true,
          savedAt: workspace.savedAt,
          notes: workspace.notes.length,
          folders: workspace.folders.length,
          markdownDir: NOTES_DIR,
        });
      } catch (error) {
        json(req, res, 400, {
          ok: false,
          error: error instanceof Error ? error.message : "Invalid payload",
        });
      }
    });
    return;
  }

  json(req, res, 404, { ok: false });
});

persist();

server.listen(PORT, HOST, () => {
  console.log("[notation-backup] " + DATA_DIR);
  console.log("[notation-backup] markdown: " + NOTES_DIR);
  console.log("[notation-backup] http://" + HOST + ":" + PORT);
});
