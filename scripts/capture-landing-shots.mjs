import { chromium } from "@playwright/test";
import path from "node:path";

const BASE = process.env.CAPTURE_BASE ?? "http://127.0.0.1:3000";
const OUT = path.resolve("public/landing");

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function fresh() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const page = await context.newPage();
  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("notation-local");
      request.onsuccess = resolve;
      request.onerror = resolve;
      request.onblocked = resolve;
    });
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".workspace-shell").waitFor({ state: "visible", timeout: 45000 });
  await page.waitForTimeout(1200);
  return { context, page };
}

const editor = await fresh();
const product = editor.page
  .locator(".sidebar-note-item")
  .filter({ hasText: "Product direction" })
  .first();
await product.waitFor({ state: "visible", timeout: 20000 });
await product.click();
await editor.page.waitForTimeout(900);
await editor.page.screenshot({ path: path.join(OUT, "editor.png") });
await editor.context.close();

const search = await fresh();
await search.page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
const palette = search.page.getByRole("combobox", {
  name: "Search notes or run a command",
});
await palette.waitFor({ state: "visible", timeout: 20000 });
await palette.fill("product");
await search.page.waitForTimeout(800);
await search.page.screenshot({ path: path.join(OUT, "search-custom.png") });
await search.context.close();

await browser.close();
console.log("captured", OUT);
