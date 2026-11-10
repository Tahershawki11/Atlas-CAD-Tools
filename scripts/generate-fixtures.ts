import { writeFileSync, readFileSync } from "node:fs";
import {
  emptyDrawing,
  type Drawing,
  type Entity,
} from "../src/cad/model/types";
import { exportDrawing } from "../src/cad/io/acadExport";
import { AcadTsEngine } from "../src/cad/io/engine";
import { project } from "../src/geo/crs";
const engine = new AcadTsEngine();
const d = engine.read(
  new Uint8Array(readFileSync("public/samples/FTTH-Demo-Area.dxf")),
  "FTTH-Demo-Area.dxf",
).drawing;
writeFileSync(
  "public/samples/Synthetic-FTTH.dwg",
  exportDrawing(d, null, "dwg").bytes,
);
function fixture(crs: string | null, count = 20): Drawing {
  const d = emptyDrawing("Synthetic compatibility fixture");
  const origin = crs ? project(crs, 31.2357, 30.0444) : { x: 0, y: 0 };
  d.layers.push(
    { ...d.layers[0], name: "ROADS", rgb: 0x087f72 },
    { ...d.layers[0], name: "LABELS", rgb: 0x265c96 },
  );
  const p = (x: number, y: number) => ({ x: origin.x + x, y: origin.y + y });
  const ents: Entity[] = [];
  for (let y = 0; y < count; y++)
    for (let x = 0; x < count; x++) {
      const a = p(x * 15, y * 15);
      ents.push({
        id: ents.length + 1,
        type: "line",
        layer: "ROADS",
        p1: a,
        p2: p(x * 15 + 10, y * 15 + 10),
      });
    }
  ents.push(
    {
      id: ents.length + 1,
      type: "circle",
      layer: "ROADS",
      c: p(50, 50),
      r: 20,
    },
    {
      id: ents.length + 2,
      type: "arc",
      layer: "0",
      c: p(90, 50),
      r: 20,
      a0: 0,
      a1: Math.PI,
    },
    {
      id: ents.length + 3,
      type: "text",
      layer: "LABELS",
      p: p(5, 60),
      h: 3,
      rot: 0.2,
      value: "Atlas اختبار عربي",
      font: "Arial",
    },
    {
      id: ents.length + 4,
      type: "hatch",
      layer: "ROADS",
      loops: [
        {
          pts: [
            origin.x,
            origin.y,
            origin.x + 20,
            origin.y,
            origin.x + 20,
            origin.y + 20,
            origin.x,
            origin.y + 20,
          ],
        },
      ],
      solid: true,
      fillAlpha: 0.3,
    },
  );
  d.entities = ents;
  d.nextId = ents.length + 1;
  d.meta.extMin = origin;
  d.meta.extMax = p(count * 15, count * 15);
  return d;
}
for (const [name, crs] of [
  ["Local", null],
  ["UTM36", "EPSG:32636"],
  ["RedBelt", "EPSG:22992"],
] as const) {
  const d = fixture(crs);
  writeFileSync(
    `public/samples/Synthetic-${name}.dxf`,
    exportDrawing(d, null, "dxf").bytes,
  );
}
writeFileSync(
  "public/samples/Synthetic-Stress-10000.dxf",
  exportDrawing(fixture("EPSG:32636", 100), null, "dxf").bytes,
);
console.log(
  "Generated synthetic fixtures. DWG is a round trip of the public demo, not independent real-world evidence.",
);
