import { describe, it, expect } from "vitest";
import { CadDoc } from "../src/cad/doc/CadDoc";
import { Scene } from "../src/cad/render/scene";
import { emptyDrawing } from "../src/cad/model/types";
import { project, unproject } from "../src/geo/crs";
import { projectScene } from "../src/map/projectScene";
describe("geographic display buffers", () => {
  for (const crs of ["EPSG:32636", "EPSG:22992"])
    it(`${crs}: projects actual buffers without modifying CAD geometry`, () => {
      const d = emptyDrawing();
      const p = project(crs, 31.2357, 30.0444);
      d.entities = [
        {
          id: 1,
          type: "line",
          layer: "0",
          p1: p,
          p2: { x: p.x + 1000, y: p.y + 1000 },
        },
        {
          id: 2,
          type: "text",
          layer: "0",
          p,
          h: 3,
          rot: 0.3,
          value: "اختبار عربي",
        },
      ];
      d.meta.extMin = p;
      d.meta.extMax = { x: p.x + 1000, y: p.y + 1000 };
      const snapshot = structuredClone(d);
      const scene = new Scene(new CadDoc(d));
      const forward = (x: number, y: number) => {
        const geo = unproject(crs, x, y);
        return project("EPSG:3857", geo.lon, geo.lat);
      };
      projectScene(scene, forward);
      expect(d).toEqual(snapshot);
      let found = false;
      for (const c of scene.chunks.values()) {
        if (!c.segCount) continue;
        const f = new Float32Array(c.segData!);
        const expected = forward(p.x, p.y);
        expect(
          Math.hypot(f[0] + c.ox - expected.x, f[1] + c.oy - expected.y),
        ).toBeLessThan(0.001);
        found = true;
      }
      expect(found).toBe(true);
      expect(scene.textTree.all()[0].item.lines).toEqual(["اختبار عربي"]);
    });
  it("UTM and Egyptian belt round trips retain millimeter precision", () => {
    for (const crs of ["EPSG:32636", "EPSG:22992"]) {
      const p = project(crs, 31.2357, 30.0444),
        g = unproject(crs, p.x, p.y),
        q = project(crs, g.lon, g.lat);
      expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeLessThan(0.001);
    }
  });
});
