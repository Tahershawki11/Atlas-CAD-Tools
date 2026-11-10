import { Scene, SEG_STRIDE, TRI_STRIDE } from "../cad/render/scene";
import { emptyBox, boxAddPts } from "../cad/geom/bbox";
import { textCorners } from "../cad/geom/tessellate";
import type { Transform } from "./projection";
/** Project display buffers only; immutable CAD world geometry remains in the document. */
export function projectScene(scene: Scene, forward: Transform) {
  scene.buildAllSync();
  const texts = [];
  for (const c of scene.chunks.values()) {
    const ox = c.ox,
      oy = c.oy;
    const o = forward(ox, oy);
    c.ox = o.x;
    c.oy = o.y;
    const b = emptyBox();
    const point = (x: number, y: number) => {
      const p = forward(x + ox, y + oy);
      boxAddPts(b, [p.x, p.y]);
      return { x: p.x - o.x, y: p.y - o.y };
    };
    const buffer = (
      buf: ArrayBuffer | null,
      stride: number,
      points: number,
    ) => {
      if (!buf) return;
      const f = new Float32Array(buf);
      for (let off = 0; off < buf.byteLength; off += stride)
        for (let j = 0; j < points; j++) {
          const i = off / 4 + j * 2;
          const p = point(f[i], f[i + 1]);
          f[i] = p.x;
          f[i + 1] = p.y;
        }
    };
    buffer(c.segData, SEG_STRIDE, 2);
    buffer(c.triData, TRI_STRIDE, 1);
    buffer(c.maskData, TRI_STRIDE, 1);
    for (const poly of c.polys)
      for (const loop of poly.loops)
        for (let i = 0; i < loop.length; i += 2) {
          const p = point(loop[i], loop[i + 1]);
          loop[i] = p.x;
          loop[i + 1] = p.y;
        }
    for (const rec of c.texts) {
      const t = rec.item;
      const p = forward(t.x, t.y);
      const step = Math.max(t.h, 0.01);
      const q = forward(
        t.x + Math.cos(t.rot) * step,
        t.y + Math.sin(t.rot) * step,
      );
      const s = Math.hypot(q.x - p.x, q.y - p.y) / step;
      t.x = p.x;
      t.y = p.y;
      t.h *= s;
      t.rot = Math.atan2(q.y - p.y, q.x - p.x);
      if (t.fitWidth) t.fitWidth *= s;
      const bounds = emptyBox();
      boxAddPts(bounds, textCorners(t));
      Object.assign(rec, bounds);
      boxAddPts(b, [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]);
      texts.push(rec);
    }
    c.bbox = b;
    c.version++;
  }
  scene.textTree.clear();
  scene.textTree.load(texts);
}
