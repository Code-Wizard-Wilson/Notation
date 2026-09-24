import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 390, height: 844 },
]) {
  test(`visual audit ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/app");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator(".workspace-shell").waitFor();
    await page.screenshot({ path: testInfo.outputPath(`notation-${viewport.width}.png`) });
  });
}

test("visual audit command palette", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app");
  await page.keyboard.press("Meta+k");
  await page.getByRole("combobox", { name: "Search notes or run a command" }).fill("product");
  await page.screenshot({ path: testInfo.outputPath("notation-command.png") });
});


test("desktop sidebar keeps one icon grid while collapsing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const nav = page.locator(".desktop-navigation");
  const toggle = page.locator(".sidebar-toggle");
  if ((await nav.getAttribute("class"))?.includes("is-collapsed")) {
    await toggle.click();
    await page.waitForTimeout(360);
  }

  const expandedIcon = page.locator(".new-note-control svg");
  const expandedIconBox = await expandedIcon.boundingBox();
  expect(expandedIconBox).not.toBeNull();

  for (const button of await page.locator(".sidebar-view-button").all()) {
    const box = await button.boundingBox();
    expect(box?.width).toBe(40);
    expect(box?.height).toBe(40);
  }

  await toggle.click();
  await page.waitForTimeout(360);

  const collapsedControls = page.locator(
    ".sidebar-toggle, .new-note-control, .nav-entry, .collapsed-view-button, .collapsed-settings-button",
  );
  const centers: number[] = [];
  for (const control of await collapsedControls.all()) {
    if (!(await control.isVisible())) continue;
    const box = await control.boundingBox();
    expect(box?.width).toBe(40);
    expect(box?.height).toBe(40);
    if (box) centers.push(box.x + box.width / 2);

    const svg = control.locator("svg").first();
    const svgBox = await svg.boundingBox();
    expect(svgBox?.width).toBe(18);
    expect(svgBox?.height).toBe(18);
  }

  expect(new Set(centers.map((value) => Math.round(value * 10) / 10)).size).toBe(1);

  const collapsedIconBox = await page.locator(".new-note-control svg").boundingBox();
  expect(collapsedIconBox).not.toBeNull();
  expect(collapsedIconBox?.x).toBe(expandedIconBox?.x);

  await page.locator(".sidebar-toggle").hover();
  const tooltip = page.getByRole("tooltip", { name: "Expand sidebar" });
  await expect(tooltip).toBeVisible();
  const tooltipBox = await tooltip.boundingBox();
  const navBox = await page.locator(".desktop-navigation").boundingBox();
  expect(tooltipBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  if (tooltipBox && navBox) {
    expect(tooltipBox.x + tooltipBox.width).toBeGreaterThan(navBox.x + navBox.width);
  }

  const layers = await page.evaluate(() => ({
    sidebar: Number(getComputedStyle(document.querySelector(".desktop-navigation")!).zIndex),
    editorHeader: Number(getComputedStyle(document.querySelector(".editor-header")!).zIndex),
  }));
  expect(layers.sidebar).toBeGreaterThan(layers.editorHeader);
});

test("loading skeleton mirrors the responsive workspace layout", async ({ browser }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL ?? "http://localhost:3000");

  const desktop = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  const desktopPage = await desktop.newPage();
  await desktopPage.goto("/app");
  await expect(desktopPage.locator(".skeleton-navigation")).toBeVisible();
  await expect(desktopPage.locator(".skeleton-list-pane")).toBeHidden();
  await expect(desktopPage.locator(".skeleton-editor-pane")).toBeVisible();

  const desktopNav = await desktopPage.locator(".skeleton-navigation").boundingBox();
  const desktopContent = await desktopPage.locator(".skeleton-workspace-content").boundingBox();
  expect(desktopNav?.width).toBe(224);
  expect(desktopContent?.x).toBe((desktopNav?.x ?? 0) + (desktopNav?.width ?? 0) + 8);
  await desktop.close();

  const tablet = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 1024, height: 768 },
  });
  const tabletPage = await tablet.newPage();
  await tabletPage.goto("/app");
  await expect(tabletPage.locator(".skeleton-navigation")).toBeHidden();
  await expect(tabletPage.locator(".skeleton-tablet-rail")).toBeVisible();
  await expect(tabletPage.locator(".skeleton-list-pane")).toBeVisible();
  await expect(tabletPage.locator(".skeleton-editor-pane")).toBeVisible();
  await expect(tabletPage.locator(".skeleton-mobile-nav")).toBeHidden();
  await tablet.close();

  const mobile = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 430, height: 932 },
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto("/app");
  await expect(mobilePage.locator(".skeleton-navigation")).toBeHidden();
  await expect(mobilePage.locator(".skeleton-tablet-rail")).toBeHidden();
  await expect(mobilePage.locator(".skeleton-list-pane")).toBeVisible();
  await expect(mobilePage.locator(".skeleton-editor-pane")).toBeHidden();
  await expect(mobilePage.locator(".skeleton-mobile-nav")).toBeVisible();
  await mobile.close();
});
