import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 430, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`landing stays clean at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/landing");

    await expect(page.getByRole("heading", { level: 1, name: /Write before the thought disappears/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /View source on GitHub/i }).first()).toBeVisible();

    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

    const landingScroller = page.locator("main");
    await landingScroller.hover();
    await page.mouse.wheel(0, 560);
    await expect.poll(() => landingScroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await landingScroller.evaluate((node) => { node.scrollTop = 0; });

    const heroImage = page.getByAltText("Notation editor showing a product direction note");
    await expect(heroImage).toBeVisible();
    await expect.poll(() => heroImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

    const seal = page.locator('[class*="verifiedSeal"]');
    const sourceCard = page.locator('[class*="openSourceCard"]');
    const centered = await Promise.all([seal.boundingBox(), sourceCard.boundingBox()]);
    expect(centered[0]).not.toBeNull();
    expect(centered[1]).not.toBeNull();
    if (centered[0] && centered[1]) {
      const sealCenter = centered[0].y + centered[0].height / 2;
      const cardCenter = centered[1].y + centered[1].height / 2;
      expect(Math.abs(sealCenter - cardCenter)).toBeLessThanOrEqual(2);
    }

    const strands = page.locator(".strands-container canvas");
    await strands.scrollIntoViewIfNeeded();
    await expect(strands).toBeVisible();

    const searchImage = page.getByAltText("Notation command palette");
    await searchImage.scrollIntoViewIfNeeded();
    await expect.poll(() => searchImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

  });
}
