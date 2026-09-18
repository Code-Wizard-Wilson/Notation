import { expect, test } from "@playwright/test";

const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("notation-local");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(page.locator(".workspace-shell")).toBeVisible();
});

test("moves the current note to Trash with Cmd+Delete", async ({ page }) => {
  await page.keyboard.press("Meta+d");
  const title = page.locator(".editor-title");
  await title.fill("Delete shortcut note");

  // macOS Delete emits Backspace in Chromium.
  await page.keyboard.press("Meta+Backspace");

  await expect(page.locator(".sidebar-note-item", { hasText: "Delete shortcut note" })).toHaveCount(0);
  await expect(title).not.toHaveValue("Delete shortcut note");
});

test("creates, formats, links, uploads, searches, pins, and persists a note", async ({ page }) => {
  await page.keyboard.press("Meta+d");
  const title = page.locator(".editor-title");
  await expect(title).toBeFocused();
  await title.fill("Interaction audit");
  await title.press("Enter");

  const editor = page.locator(".note-prose");
  await editor.pressSequentially("# Ideas");
  await editor.press("Enter");
  await editor.pressSequentially("This is **important**.");
  await editor.press("Enter");
  await editor.pressSequentially("[ ] Test the flow");

  await expect(editor.locator("h1")).toHaveText("Ideas");
  await expect(editor.locator("strong")).toHaveText("important");
  await expect(editor).not.toContainText("**important**");
  await expect(editor.locator('ul[data-type="taskList"] input')).toHaveCount(1);

  const checkbox = editor.locator('ul[data-type="taskList"] input');
  await checkbox.click();
  await expect(checkbox).toBeChecked();

  await editor.press("End");
  await editor.press("Enter");
  await editor.pressSequentially("[[");
  await expect(page.getByRole("listbox", { name: "LINK A NOTE" })).toBeVisible();
  await page.getByRole("option", { name: /Product direction/ }).click();
  await expect(editor.locator('a[href^="note:"]')).toHaveText("Product direction");

  await page.getByLabel("Insert image").setInputFiles({
    name: "reference.png",
    mimeType: "image/png",
    buffer: pixel,
  });
  await expect(editor.locator("img.note-image")).toBeVisible();

  await page.getByLabel("Attach files").setInputFiles({
    name: "brief.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("A short project brief."),
  });
  await expect(editor.locator(".attachment-node")).toContainText("brief.txt");

  await expect(page.locator(".save-status")).toContainText(/SAVED|SAVING/);
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator(".editor-title")).toHaveValue("Interaction audit");
  await expect(page.locator(".note-prose p strong")).toHaveText("important");

  await page.keyboard.press("Meta+k");
  const search = page.getByRole("combobox", { name: "Search notes or run a command" });
  await expect(search).toBeFocused();
  await search.fill("Visual references");
  await page.keyboard.press("Enter");
  await expect(page.locator(".editor-title")).toHaveValue("Visual references");

  await page.keyboard.press("Meta+p");
  await expect(page.locator(".sidebar-note-pinned-indicator").first()).toBeVisible();
});


test("keeps an editable paragraph after a table at the end of a note", async ({ page }) => {
  await page.keyboard.press("Meta+d");
  const title = page.locator(".editor-title");
  await title.fill("Table tail");
  await title.press("Enter");

  const editor = page.locator(".note-prose");
  await editor.pressSequentially("/");
  await page.getByRole("option", { name: /^Table/ }).click();
  await expect(editor.locator("table")).toBeVisible();

  const trailingParagraph = editor.locator(":scope > p").last();
  await expect(trailingParagraph).toBeVisible();
  await trailingParagraph.click();
  await page.keyboard.type("after table");
  await expect(trailingParagraph).toHaveText("after table");
});

test("uses a grouped slash menu, block drag handle, and backlinks", async ({ page }) => {
  await page.keyboard.press("Meta+d");
  const title = page.locator(".editor-title");
  await title.fill("Backlink source");
  await title.press("Enter");

  const editor = page.locator(".note-prose");
  await editor.pressSequentially("/");
  const blockMenu = page.getByRole("listbox", { name: "BLOCKS" });
  await expect(blockMenu).toBeVisible();
  await expect(blockMenu.locator(".editor-menu-group")).toHaveText(["BASIC", "LISTS", "DATA", "MEDIA", "LINKS"]);
  await page.getByRole("option", { name: /Link to note/ }).click();
  await expect(page.getByRole("listbox", { name: "LINK A NOTE" })).toBeVisible();
  await page.getByRole("option", { name: /Product direction/ }).click();
  await page.waitForTimeout(800);

  await page.locator(".sidebar-note-item", { hasText: "Product direction" }).click();
  const backlinks = page.locator(".backlinks-panel");
  await expect(backlinks).toBeVisible();
  await expect(backlinks).toContainText("Backlink source");

  const firstBlock = page.locator(".note-prose > p").first();
  await firstBlock.hover();
  const handle = page.locator(".block-drag-handle");
  const handleButton = page.getByRole("button", { name: "Block actions" });
  await expect(handle).toBeVisible();
  await expect(handle).toHaveAttribute("draggable", "true");

  await firstBlock.hover();
  const blockBox = await firstBlock.boundingBox();
  const handleBox = await handleButton.boundingBox();
  expect(blockBox).not.toBeNull();
  expect(handleBox).not.toBeNull();
  expect((blockBox?.x ?? 0) - ((handleBox?.x ?? 0) + (handleBox?.width ?? 0))).toBeGreaterThanOrEqual(6);
  expect(Math.abs(((handleBox?.y ?? 0) + (handleBox?.height ?? 0) / 2) - ((blockBox?.y ?? 0) + (blockBox?.height ?? 0) / 2))).toBeLessThan(4);

  await handleButton.click();
  const actionMenu = page.getByRole("menu", { name: "Block actions" });
  await expect(actionMenu).toBeVisible();
  await page.waitForTimeout(140);
  const menuBefore = await actionMenu.boundingBox();
  expect((menuBefore?.x ?? 0) + (menuBefore?.width ?? 0)).toBeLessThan(blockBox?.x ?? 0);
  await page.locator(".note-prose > h2").last().hover();
  const menuAfter = await actionMenu.boundingBox();
  expect(Math.abs((menuAfter?.y ?? 0) - (menuBefore?.y ?? 0))).toBeLessThan(1);
  await page.keyboard.press("Escape");
  await expect(actionMenu).toBeHidden();

  await firstBlock.hover();
  await handle.dragTo(page.locator(".note-prose > h2").last());
  await expect(page.locator(".note-prose > *").first()).toHaveText("Priorities");
  await expect(actionMenu).toBeHidden();

  const blockCountBeforeInsert = await page.locator(".note-prose > *").count();
  const insertAnchor = page.locator(".note-prose > h2").first();
  await insertAnchor.hover();
  const addBlockButton = page.getByRole("button", { name: "Add block" });
  await expect(addBlockButton).toBeVisible();
  await addBlockButton.click();
  const addBlockMenu = page.getByRole("listbox", { name: "ADD BLOCK" });
  await expect(addBlockMenu).toBeVisible();
  await expect(page.locator(".note-prose > *")).toHaveCount(blockCountBeforeInsert);
  await addBlockMenu.getByRole("option", { name: /Heading 2/ }).click();
  await expect(page.locator(".note-prose > *")).toHaveCount(blockCountBeforeInsert + 1);
  await expect(page.locator(".note-prose > *").nth(1)).toHaveJSProperty("tagName", "H2");

  await backlinks.getByRole("button", { name: /Backlink source/ }).click();
  await expect(page.locator(".editor-title")).toHaveValue("Backlink source");
});


test("resizes an image with size presets and persists the size", async ({ page }) => {
  await page.getByLabel("Insert image").setInputFiles({
    name: "resize.png",
    mimeType: "image/png",
    buffer: pixel,
  });

  const image = page.locator("img.note-image").last();
  await image.click({ force: true });
  await expect(page.locator(".image-toolbar")).toBeVisible();

  const editorWidth = await page.locator(".note-prose").evaluate((element) => element.getBoundingClientRect().width);

  await page.getByRole("button", { name: "Set image size to 50%" }).click();
  await expect.poll(() => image.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(Math.round(editorWidth * 0.5));

  await page.getByRole("button", { name: "Set image size to 75%" }).click();
  await expect.poll(() => image.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(Math.round(editorWidth * 0.75));

  await page.getByRole("button", { name: "Set image size to 50%" }).click();
  await page.waitForTimeout(800);
  await page.reload();

  await expect.poll(() => page.locator("img.note-image").last().evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(Math.round(editorWidth * 0.5));
});


test("styles selected text with a local typeface and marker color", async ({ page }) => {
  const editor = page.locator(".note-prose");
  await editor.click();

  await page.evaluate(() => {
    const root = document.querySelector(".note-prose");
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent ?? "";
      if (!text.includes("editor")) continue;
      const start = text.indexOf("editor");
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + "editor".length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      break;
    }
  });

  await expect(page.locator(".bubble-toolbar")).toBeVisible();
  await page.getByRole("button", { name: "Font" }).click();
  await page.locator(".font-menu-option.is-handwritten").click();
  await page.getByRole("button", { name: "Highlight" }).click();
  await page.getByRole("button", { name: "Blue highlight" }).click();

  const styled = editor.locator('span[style*="Neucha"]');
  await expect(styled).toContainText("editor");
  const marked = styled.locator("mark");
  await expect(marked).toHaveText("editor");
  await expect(marked).toHaveCSS("background-color", "rgb(191, 219, 254)");

  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator('.note-prose span[style*="Neucha"] mark')).toHaveText("editor");
  await expect(page.locator('.note-prose span[style*="Neucha"] mark')).toHaveCSS("background-color", "rgb(191, 219, 254)");
});


test("imports Obsidian-style Markdown notes", async ({ page }) => {
  await page.locator(".account-control").click();
  const importer = page.getByLabel("Import Markdown notes");

  await importer.setInputFiles([
    {
      name: "Project Alpha.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        '---\nemoji: "🚀"\n---\n# Project Alpha\n\n## Goals\n\n- ship fast\n- **stay clear**\n\n- [x] prototype\n- [ ] launch\n\n> [!NOTE] Important\n> Keep this text\n\n==highlight me== ^block-123\n\nVisible text[^1] and $x + y$.\n\n[^1]: Footnote body\n\n%%hidden comment%%\n\nSee [[Second Note|the second note]].',
      ),
    },
    {
      name: "Second Note.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Second Note\n\n> Linked from Alpha\n\n`code` and [OpenAI](https://openai.com)."),
    },
  ]);

  await expect(page.locator(".editor-title")).toHaveValue("Project Alpha");
  await expect(page.locator(".editor-context-dog")).toHaveText("🚀");
  await expect(page.locator(".note-prose h2")).toHaveText("Goals");
  await expect(page.locator(".note-prose strong")).toHaveText("stay clear");
  await expect(page.locator('.note-prose ul[data-type="taskList"] input')).toHaveCount(2);
  await expect(page.locator('.note-prose a[href^="note:"]')).toHaveText("the second note");
  await expect(page.locator(".note-prose mark")).toHaveText("highlight me");
  await expect(page.locator(".note-prose mark")).toHaveCSS("background-color", "rgb(254, 240, 138)");
  await expect(page.locator(".note-prose")).toContainText("Important");
  await expect(page.locator(".note-prose")).toContainText("x + y");
  await expect(page.locator(".note-prose")).not.toContainText("[!NOTE]");
  await expect(page.locator(".note-prose")).not.toContainText("==");
  await expect(page.locator(".note-prose")).not.toContainText("^block-123");
  await expect(page.locator(".note-prose")).not.toContainText("%%hidden comment%%");
  await expect(page.locator(".note-prose")).not.toContainText("[^1]");
  await expect(page.locator(".sidebar-note-item", { hasText: "Second Note" })).toBeVisible();
  await expect(page.locator(".sidebar-note-item", { hasText: "Project Alpha" })).toBeVisible();
});


test("opening a note does not touch its updated time or re-sort it", async ({ page }) => {
  const readTimestamp = async (title: string) =>
    page.evaluate(async (targetTitle) => {
      const notes = await new Promise<Array<{ title: string; updatedAt: string }>>((resolve) => {
        const open = indexedDB.open("notation-local", 1);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction("workspace", "readonly").objectStore("workspace").get("notes");
          request.onsuccess = () => { resolve(request.result ?? []); db.close(); };
          request.onerror = () => { resolve([]); db.close(); };
        };
        open.onerror = () => resolve([]);
      });
      return notes.find((note) => note.title === targetTitle)?.updatedAt ?? null;
    }, title);

  const before = await readTimestamp("Visual references");
  expect(before).not.toBeNull();

  await page.locator(".sidebar-note-item", { hasText: "Visual references" }).click();
  await page.waitForTimeout(750);

  const afterOpen = await readTimestamp("Visual references");
  expect(afterOpen).toBe(before);

  const editor = page.locator(".note-prose");
  await editor.click();
  await editor.press("End");
  await editor.pressSequentially(" x");

  await expect.poll(() => readTimestamp("Visual references")).not.toBe(before);
});

test("uses a single-pane mobile notes flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();

  await expect(page.locator(".mobile-navigation")).toBeVisible();
  await page.getByRole("button", { name: /Visual references/ }).click();
  await expect(page.locator(".editor-pane")).toBeVisible();
  await expect(page.locator(".editor-title")).toHaveValue("Visual references");
  await expect(page.locator(".mobile-navigation")).not.toBeVisible();

  await page.getByRole("button", { name: "Back to notes" }).click();
  await expect(page.locator(".mobile-navigation")).toBeVisible();
  await expect(page.locator(".editor-pane")).not.toBeVisible();

  await page.getByRole("button", { name: "New note" }).click();
  await expect(page.locator(".editor-title")).toBeFocused();
});

test("uses one Enter with invisible line tails and keeps collapsed links quiet", async ({ page }) => {
  await page.keyboard.press("Meta+d");
  const title = page.locator(".editor-title");
  await title.fill("Clean enter");
  await title.press("Enter");

  const editor = page.locator(".note-prose");
  await editor.pressSequentially("clean");
  await page.keyboard.insertText("\u00a0\u200b");

  const firstParagraph = editor.locator("p").first();
  await firstParagraph.evaluate((element) => {
    const text = element.firstChild;
    if (!text) return;
    const value = text.textContent ?? "";
    const invisibleStart = value.indexOf("\u00a0");
    const range = document.createRange();
    range.setStart(text, invisibleStart);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });

  await page.keyboard.press("Enter");
  await expect(editor.locator("p").first()).toHaveText("clean");
  await expect(editor.locator("p").nth(1)).toHaveText("");

  await page.keyboard.type("https://example.com");
  await page.keyboard.press("Space");
  await expect(editor.locator('a[href="https://example.com"]')).toHaveText("https://example.com");

  // A collapsed caret at/inside a link is not a text selection and should not
  // summon the formatting toolbar.
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bubble-toolbar")).toHaveAttribute("data-visible", "false");
});


test("inserts and edits a native table", async ({ page }) => {
  await page.keyboard.press("Meta+d");
  const title = page.locator(".editor-title");
  await title.fill("Table note");
  await title.press("Enter");

  const editor = page.locator(".note-prose");
  await editor.pressSequentially("/table");
  const menu = page.getByRole("listbox", { name: "BLOCKS" });
  await expect(menu).toBeVisible();
  await menu.getByRole("option", { name: /Table/ }).click();

  const table = editor.locator("table");
  await expect(table).toHaveCount(1);
  await expect(table.locator("tr")).toHaveCount(3);
  await expect(table.locator("tr").first().locator("th,td")).toHaveCount(3);

  await table.locator("th,td").first().click();
  const toolbar = page.locator(".table-toolbar");
  await expect(toolbar).toHaveAttribute("data-visible", "true");

  await page.getByRole("button", { name: "Add row" }).click();
  await expect(table.locator("tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Add column" }).click();
  await expect(table.locator("tr").first().locator("th,td")).toHaveCount(4);
  await page.getByRole("button", { name: "Delete row" }).click();
  await expect(table.locator("tr")).toHaveCount(3);
});

test("turns dense soft-break rows into independent draggable blocks", async ({ page }) => {
  const originalUpdatedAt = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("notation-local", 1);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const notes = await new Promise<any[]>((resolve) => {
      const request = db.transaction("workspace", "readonly").objectStore("workspace").get("notes");
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => resolve([]);
    });
    const target = notes[0];
    target.title = "Dense rows";
    target.plainTextContent = "nuisance\nintersection\nidentical\nideology";
    target.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "nuisance - неприятность" },
            { type: "hardBreak" },
            { type: "text", text: "intersection - пересечение" },
            { type: "hardBreak" },
            { type: "text", text: "identical - одинаковый" },
            { type: "hardBreak" },
            { type: "text", text: "ideology - идеология" },
          ],
        },
      ],
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("workspace", "readwrite");
      transaction.objectStore("workspace").put(notes, "notes");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    return target.updatedAt;
  });

  await page.reload();
  await expect(page.locator(".editor-title")).toHaveValue("Dense rows");

  const rows = page.locator(".note-prose > p");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toHaveText("nuisance - неприятность");
  await expect(rows.nth(1)).toHaveText("intersection - пересечение");
  await expect(page.locator(".note-prose br")).toHaveCount(0);

  const handle = page.locator(".block-drag-handle");
  await rows.nth(0).hover();
  await expect(handle).toBeVisible();
  const firstHandleBox = await handle.boundingBox();

  await rows.nth(1).hover();
  const rowBox = await rows.nth(1).boundingBox();
  const handleBox = await handle.boundingBox();
  expect(firstHandleBox).not.toBeNull();
  expect(handleBox).not.toBeNull();
  expect((handleBox!.y - firstHandleBox!.y)).toBeGreaterThan(10);
  expect(rowBox).not.toBeNull();
  expect(handleBox).not.toBeNull();
  expect(Math.abs((handleBox!.y + handleBox!.height / 2) - (rowBox!.y + rowBox!.height / 2))).toBeLessThan(10);

  const persistedUpdatedAt = await page.evaluate(async () => {
    const notes = await new Promise<Array<{ title?: string; updatedAt?: string }>>((resolve) => {
      const open = indexedDB.open("notation-local", 1);
      open.onsuccess = () => {
        const db = open.result;
        const request = db.transaction("workspace", "readonly").objectStore("workspace").get("notes");
        request.onsuccess = () => { resolve(request.result ?? []); db.close(); };
        request.onerror = () => { resolve([]); db.close(); };
      };
      open.onerror = () => resolve([]);
    });
    return notes.find((note) => note.title === "Dense rows")?.updatedAt;
  });
  expect(persistedUpdatedAt).toBe(originalUpdatedAt);
});

test("creates branched folders, moves notes, persists them, and preserves notes when a folder is deleted", async ({ page }) => {
  const folders = page.locator(".folder-library--sidebar");
  await page.locator(".desktop-navigation").getByRole("button", { name: "New folder" }).click();

  const createInput = folders.getByRole("textbox", { name: "Folder name" });
  await createInput.fill("Projects");
  await createInput.press("Enter");

  const folderHead = folders.getByRole("button", { name: /Projects/ }).first();
  await expect(folderHead).toBeVisible();
  await expect(folderHead).toHaveAttribute("aria-expanded", "true");

  const sourceNote = page.locator(".sidebar-note-item", { hasText: "Visual references" });
  await sourceNote.click({ button: "right" });
  const noteMenu = page.getByRole("menu", { name: /Actions for Visual references/ });
  await expect(noteMenu).toBeVisible();
  await noteMenu.getByRole("menuitem", { name: "Move to · Projects" }).click();

  await expect(page.locator(".sidebar-note-item", { hasText: "Visual references" })).toHaveCount(0);
  const movedNote = folders.locator(".folder-note-item", { hasText: "Visual references" });
  await expect(movedNote).toBeVisible();
  await movedNote.click();
  await expect(folders.locator(".folder-branch-line-active")).toBeVisible();

  await movedNote.dblclick();
  const folderNoteRename = folders.getByRole("textbox", { name: "Rename Visual references" });
  await expect(folderNoteRename).toBeFocused();
  await folderNoteRename.fill("Folder reference");
  await folderNoteRename.press("Enter");
  const renamedFolderNote = folders.locator(".folder-note-item", { hasText: "Folder reference" });
  await expect(renamedFolderNote).toBeVisible();
  await renamedFolderNote.hover();
  const folderRow = renamedFolderNote.locator("xpath=ancestor::*[contains(@class, 'folder-note-row')]");
  await expect(folderRow.getByRole("button", { name: "Pin note" })).toBeVisible();
  await expect(folderRow.getByRole("button", { name: "More actions" })).toBeVisible();

  await folderHead.click({ button: "right" });
  await page.getByRole("menu", { name: "Actions for Projects" }).getByRole("menuitem", { name: "New note in folder" }).click();
  const folderCreatedTitle = page.locator(".editor-title");
  await expect(folderCreatedTitle).toBeFocused();
  await folderCreatedTitle.fill("Folder-created note");
  await expect(folders.locator(".folder-note-item", { hasText: "Folder-created note" })).toBeVisible();

  await page.keyboard.press("Meta+k");
  const folderSearch = page.getByRole("combobox", { name: "Search notes or run a command" });
  await folderSearch.fill("Projects");
  await expect(page.getByRole("option", { name: /Folder reference/ })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.reload();
  await expect(page.locator(".workspace-shell")).toBeVisible();
  const reloadedFolders = page.locator(".folder-library--sidebar");
  await expect(reloadedFolders.getByRole("button", { name: /Projects/ }).first()).toBeVisible();
  await expect(reloadedFolders.locator(".folder-note-item", { hasText: "Folder reference" })).toBeVisible();
  await expect(reloadedFolders.locator(".folder-note-item", { hasText: "Folder-created note" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileFolders = page.locator(".folder-library--list");
  await expect(mobileFolders.getByRole("button", { name: /Projects/ }).first()).toBeVisible();
  await expect(mobileFolders.locator(".folder-note-item", { hasText: "Folder reference" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });

  const reloadedHead = reloadedFolders.getByRole("button", { name: /Projects/ }).first();
  await reloadedHead.click({ button: "right" });
  const folderMenu = page.getByRole("menu", { name: "Actions for Projects" });
  await folderMenu.getByRole("menuitem", { name: "Rename folder" }).click();

  const renameInput = reloadedFolders.getByRole("textbox", { name: "Rename Projects" });
  await renameInput.fill("Work");
  await renameInput.press("Enter");
  await expect(reloadedFolders.getByRole("button", { name: /Work/ }).first()).toBeVisible();

  await reloadedFolders.getByRole("button", { name: /Work/ }).first().click({ button: "right" });
  await page.getByRole("menu", { name: "Actions for Work" }).getByRole("menuitem", { name: "Delete folder" }).click();

  await expect(reloadedFolders.getByRole("button", { name: /Work/ })).toHaveCount(0);
  await expect(page.locator(".sidebar-note-item", { hasText: "Folder reference" })).toBeVisible();
  await expect(page.locator(".sidebar-note-item", { hasText: "Folder-created note" })).toBeVisible();
});
