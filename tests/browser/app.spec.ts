import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
const reports: any[] = [];
async function openFile(page: Page, file: string) {
  await expect(page.locator("h1")).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles("public/samples/" + file);
  await expect(page.locator(".viewport").first()).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator(".loading-overlay")).toHaveCount(0, {
    timeout: 45000,
  });
  await page.waitForFunction(
    () => !!(window as any).__atlasViewport?.layer?.renderer,
  );
  await page.waitForTimeout(350);
}
test("file manager, create, persist, delete, filter and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "ملفاتك، في مساحة واحدة." }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/home-desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "ملف جديد", exact: false })
    .first()
    .click();
  await page.getByPlaceholder("مثال: مخطط الموقع").fill("مخطط اختبار");
  await page
    .getByRole("button", { name: "إنشاء المشروع", exact: true })
    .click();
  await expect(page.getByText("مساحة مشروعك جاهزة")).toBeVisible();
  await page.getByTitle("العودة إلى الملفات").click();
  await expect(page.locator(".filename")).toContainText("مخطط اختبار");
  await page.reload();
  await expect(page.locator(".filename")).toContainText("مخطط اختبار");
  await page.getByRole("button", { name: "DXF", exact: true }).click();
  await expect(page.getByText("لا توجد نتائج مطابقة")).toBeVisible();
  await page.getByRole("button", { name: "الكل", exact: true }).click();
  await page.getByLabel("حذف مخطط اختبار", { exact: true }).click();
  await page.getByRole("button", { name: "حذف المشروع", exact: true }).click();
  await expect(page.getByText("لا توجد ملفات بعد.")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/home-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("public DXF: read worker, layer persistence, measurement and reopen", async ({
  page,
}) => {
  await page.goto("/");
  await openFile(page, "FTTH-Demo-Area.dxf");
  const layers = page.locator(".layer-list button");
  await expect(layers.first()).toBeVisible();
  await layers.first().click();
  await expect(layers.first()).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "قياس", exact: true }).click();
  const bounds = await page.locator(".canvas-host").boundingBox();
  await page.mouse.click(bounds!.x + 100, bounds!.y + 100);
  await page.mouse.click(bounds!.x + 200, bounds!.y + 180);
  await expect(page.locator(".canvas-status")).toContainText("المسافة:");
  await page.reload();
  await expect(page.locator(".filename")).toContainText("FTTH-Demo-Area.dxf");
  await page.locator(".filename").click();
  await expect(page.locator(".viewport")).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".layer-list button").first()).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.screenshot({ path: "docs/viewer-dxf.png", fullPage: true });
});
for (const item of [
  { file: "Synthetic-Local.dxf", crs: "" },
  { file: "Synthetic-UTM36.dxf", crs: "EPSG:32636" },
  { file: "Synthetic-RedBelt.dxf", crs: "EPSG:22992" },
  { file: "Synthetic-FTTH.dwg", crs: "" },
  { file: "Synthetic-Stress-10000.dxf", crs: "EPSG:32636" },
])
  test("alignment " + item.file, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
    await page.goto("/");
    await page
      .getByRole("button", { name: "اختبار التوافق", exact: true })
      .click();
    await openFile(page, item.file);
    await page.getByLabel("نظام الإحداثيات").selectOption(item.crs);
    if (item.crs) {
      await page.locator(".check input").uncheck();
      await page.waitForTimeout(400);
    }
    await page.waitForFunction(
      (crs) => (window as any).__atlasViewport?.layer?.crs === (crs || null),
      item.crs,
    );
    const result = await page.evaluate(async () => {
      const h = (window as any).__atlasViewport;
      const results = [];
      for (const zoom of [0, 1, 2, -1]) {
        if (zoom) h.map.setZoom(h.map.getZoom() + zoom, { animate: false });
        h.map.panBy([37, -19], { animate: false });
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        results.push(h.diagnose());
      }
      return results;
    });
    for (const r of result) {
      expect(r.points).toBeGreaterThan(0);
      expect(r.maxErrorPx).toBeLessThanOrEqual(1);
    }
    reports.push({ file: item.file, states: result });
    await page
      .getByRole("button", { name: "تشغيل الاختبار", exact: true })
      .click();
    await expect(page.getByText("نجح اختبار المحاذاة")).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(350);
    const resized = await page.evaluate(() =>
      (window as any).__atlasViewport.diagnose(),
    );
    expect(resized.maxErrorPx).toBeLessThanOrEqual(1);
    reports[reports.length - 1].resize = resized;
    await page.screenshot({
      path: "docs/compat-" + item.file.replace(/\./g, "-") + ".png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
test("malformed input has a useful failure and no project is saved", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "broken.dxf",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not a CAD document"),
    });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".loading-overlay")).toHaveCount(0);
  await expect(page.locator(".filename")).toHaveCount(0);
});
test.afterAll(() => {
  if (reports.length)
    writeFileSync(
      "docs/compatibility-results.json",
      JSON.stringify(reports, null, 2),
    );
});
test("basemap overlay, download and GPU context-loss fallback", async ({
  page,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "اختبار التوافق", exact: true })
    .click();
  await openFile(page, "Synthetic-UTM36.dxf");
  await page.getByLabel("نظام الإحداثيات").selectOption("EPSG:32636");
  await page.waitForFunction(
    () => (window as any).__atlasViewport?.layer?.crs === "EPSG:32636",
  );
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({
    timeout: 10000,
  });
  const alpha = await page.evaluate(() => {
    const r = (window as any).__atlasViewport.layer.renderer;
    r.render;
    return r.kind === "webgl" ? r.gl.getContextAttributes().alpha : true;
  });
  expect(alpha).toBe(true);
  await page
    .getByRole("button", { name: "تشغيل الاختبار", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "تنزيل النتيجة", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("atlas-compatibility.json");
  await page.evaluate(() => {
    const h = (window as any).__atlasViewport;
    h.layer.renderer.gl.getExtension("WEBGL_lose_context").loseContext();
  });
  await expect(
    page
      .locator(".renderer-label")
      .filter({ hasText: "Canvas2D (context loss)" }),
  ).toBeVisible();
  await page.getByTitle("تكبير", { exact: true }).click();
  const report = await page.evaluate(() =>
    (window as any).__atlasViewport.diagnose(),
  );
  expect(report.passed).toBe(true);
  await page.screenshot({ path: "docs/canvas-fallback.png", fullPage: true });
});
