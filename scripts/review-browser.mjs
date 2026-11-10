import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1487, height: 1058 } });
await page.goto("http://localhost:5181");
await page.waitForSelector("h1");
console.log("home");
await page.screenshot({ path: "docs/home-native.png", fullPage: true });
await page.getByRole("button", { name: "اختبار التوافق", exact: true }).click();
await page
  .getByRole("heading", { name: "نختبر التوافق، قبل البناء." })
  .waitFor();
console.log("lab");
await page
  .locator("input[type=file]")
  .setInputFiles("public/samples/Synthetic-Stress-10000.dxf");
await page.waitForFunction(
  () =>
    window.__atlasViewport?.layer?.renderer && window.__atlasOriginal?.scene,
  null,
  { timeout: 120000 },
);
console.log("loaded");
await page.waitForTimeout(500);
await page.getByLabel("نظام الإحداثيات").selectOption("EPSG:32636");
await page.waitForFunction(
  () => window.__atlasViewport?.layer?.crs === "EPSG:32636",
  null,
  { timeout: 120000 },
);
console.log("projected");
await page.waitForTimeout(1000);
const results = await page.evaluate(async () => {
  const original = window.__atlasOriginal,
    leaf = window.__atlasViewport;
  original.scene.buildAllSync();
  const times = { original: [], leaflet: [] };
  for (let i = 0; i < 20; i++) {
    let t = performance.now();
    original.gl.render(original.scene, original.cam, {
      dark: false,
      background: 0xffffff,
      lineweights: true,
    });
    original.text.render(original.scene, original.cam, false);
    times.original.push(performance.now() - t);
    t = performance.now();
    leaf.layer.render();
    times.leaflet.push(performance.now() - t);
  }
  const projects = await new Promise((resolve, reject) => {
    const req = indexedDB.open("atlas-tools");
    req.onsuccess = () => {
      const db = req.result;
      const r = db.transaction("projects").objectStore("projects").getAll();
      r.onsuccess = () => {
        resolve(r.result);
        db.close();
      };
      r.onerror = reject;
    };
    req.onerror = reject;
  });
  return {
    at: new Date().toISOString(),
    browser: navigator.userAgent,
    viewport: [innerWidth, innerHeight],
    file: "Synthetic-Stress-10000.dxf",
    projects,
    times,
    original: {
      segments: original.gl.lastDrawStats.segments,
      gpuMB: original.gl.gpuBytes / 1048576,
    },
    leaflet: leaf.diagnose(),
    tileCount: document.querySelectorAll(".leaflet-tile-loaded").length,
    errors: [...document.querySelectorAll("[role=alert]")].map(
      (e) => e.textContent,
    ),
  };
});
writeFileSync(
  "docs/performance-results.json",
  JSON.stringify(results, null, 2),
);
await page.getByRole("button", { name: "تشغيل الاختبار", exact: true }).click();
await page.screenshot({
  path: "docs/compatibility-live-map.png",
  fullPage: true,
});
console.log(
  JSON.stringify({
    loadedTiles: results.tileCount,
    errors: results.errors,
    parseMs: results.projects[0].importMs,
    leaf: results.leaflet,
  }),
);
await browser.close();
