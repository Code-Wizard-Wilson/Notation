<p align="center">
  <img src="src/app/icon.svg" alt="Notation" width="72" height="72" />
</p>

<h1 align="center">Notation</h1>

<p align="center">
  A fast, local-first notes app that keeps the interface out of the way.
</p>

<p align="center">
  <a href="https://notation.is-a.dev/">Website</a> ·
  <a href="#run-locally">Run locally</a> ·
  <a href="#license">License</a>
</p>

![Notation editor](public/landing/editor.png)

## Features

- Rich-text editing with headings, lists, highlights, links, code blocks, and tasks
- Markdown import and export
- Automatic Markdown mirror on disk when running locally
- Wiki-style links and backlinks
- Local folders with branched navigation
- Editable tables
- Image and file attachments
- Fast note and command search
- PDF export
- Keyboard-first navigation and note actions
- Responsive desktop, tablet, and mobile layouts

## Local-first by design

Notation is local-first. The browser keeps the live workspace in IndexedDB. When you run Notation locally with `npm run dev`, the app also mirrors the workspace to `~/Documents/Notation Data/`.

Each note is written as a real `.md` file under `~/Documents/Notation Data/Notes/`, preserving headings, lists, tasks, links, code blocks, tables, highlights, underline and font styling. Attachments and embedded local images are materialized under `~/Documents/Notation Data/Attachments/`. Workspace JSON and rolling backups are kept alongside the Markdown files for recovery.

There is no account, cloud database, analytics, telemetry, advertising, or remote note synchronization. The local disk mirror is served only on `127.0.0.1`; nothing is uploaded. UI preferences stay in localStorage.

When exporting a note to PDF, Notation may fetch an image URL that is already embedded in that note so it can be included in the generated document. Local images are stored as data URLs and require no network request.

## Run locally

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build and test

```bash
npm run typecheck
npm run build
npm run test:e2e
```

The production build uses Next.js static export.

## Stack

Next.js · React · TypeScript · Tiptap / ProseMirror · Zustand · IndexedDB · Playwright

## License

Released under the [MIT License](LICENSE).
