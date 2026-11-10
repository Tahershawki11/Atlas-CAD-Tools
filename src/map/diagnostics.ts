import type L from "leaflet";
import { Scene } from "../cad/render/scene";
import type { AtlasCadLayer } from "./AtlasCadLayer";
import { drawingTransform, worldLatLng } from "./projection";
export interface AlignmentReport {
  at: string;
  crs: string;
  renderer: string;
  points: number;
  maxErrorPx: number;
  meanErrorPx: number;
  projectionMs: number;
  frameMs: number;
  gpuMB: number;
  segments: number;
  entities: number;
  passed: boolean;
  browser: string;
  viewport: string;
}
/** Compare actual Float32 display-buffer vertices against independently projected CAD vertices. */
export function diagnose(layer: AtlasCadLayer, map: L.Map): AlignmentReport {
  const original = new Scene(layer.doc);
  original.buildAllSync();
  const forward = drawingTransform(layer.crs).forward;
  const errors: number[] = [];
  for (const [key, c] of original.chunks) {
    const target = layer.scene.chunks.get(key);
    if (!c.segData || !target?.segData) continue;
    const a = new Float32Array(c.segData),
      b = new Float32Array(target.segData);
    const step = Math.max(1, Math.floor(c.segCount / 50));
    for (let seg = 0; seg < c.segCount; seg += step)
      for (const off of [0, 2]) {
        const i = seg * 9 + off;
        const expected = forward(a[i] + c.ox, a[i + 1] + c.oy);
        const actual = { x: b[i] + target.ox, y: b[i + 1] + target.oy };
        const screen = layer.cam.worldToScreen(actual.x, actual.y);
        const reference = map.latLngToContainerPoint(
          worldLatLng(expected, !!layer.crs),
        );
        errors.push(Math.hypot(screen.x - reference.x, screen.y - reference.y));
      }
  }
  const max = errors.length ? Math.max(...errors) : 0;
  return {
    at: new Date().toISOString(),
    crs: layer.crs ?? "LOCAL",
    renderer: layer.rendererKind,
    points: errors.length,
    maxErrorPx: max,
    meanErrorPx: errors.reduce((s, v) => s + v, 0) / (errors.length || 1),
    projectionMs: layer.projectionMs,
    frameMs: layer.lastFrameMs,
    gpuMB: layer.renderer.gpuBytes / 1048576,
    segments: layer.renderer.lastDrawStats.segments,
    entities: layer.doc.size,
    passed: errors.length > 0 && max <= 1,
    browser: navigator.userAgent,
    viewport: `${map.getSize().x} × ${map.getSize().y} @ ${devicePixelRatio}`,
  };
}
