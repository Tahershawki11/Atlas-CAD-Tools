import L from "leaflet";
import { CadDoc } from "../cad/doc/CadDoc";
import { Scene } from "../cad/render/scene";
import { Camera } from "../cad/render/camera";
import { GlRenderer } from "../cad/render/glRenderer";
import { CanvasRenderer } from "../cad/render/canvasRenderer";
import { TextLayer } from "../cad/render/textLayer";
import { glSelfTest } from "../cad/render/selfTest";
import { projectScene } from "./projectScene";
import { drawingTransform, latLngWorld, worldLatLng } from "./projection";
import type { Vec2 } from "../cad/model/types";
export class AtlasCadLayer extends L.Layer {
  scene: Scene;
  cam = new Camera();
  renderer!: GlRenderer | CanvasRenderer;
  text!: TextLayer;
  host!: HTMLDivElement;
  mapRef!: L.Map;
  frame = 0;
  rendererKind = "";
  projectionMs = 0;
  lastFrameMs = 0;
  maxSegment = 0;
  constructor(
    public doc: CadDoc,
    public crs: string | null,
    public baseVisible = false,
  ) {
    super();
    const t = performance.now();
    this.scene = new Scene(doc);
    this.scene.buildAllSync();
    if (crs) projectScene(this.scene, drawingTransform(crs).forward);
    this.projectionMs = performance.now() - t;
    for (const c of this.scene.chunks.values()) {
      const f = c.segData ? new Float32Array(c.segData) : null;
      if (f)
        for (let i = 0; i < f.length; i += 9)
          this.maxSegment = Math.max(
            this.maxSegment,
            Math.hypot(f[i + 2] - f[i], f[i + 3] - f[i + 1]),
          );
    }
  }
  onAdd(map: L.Map) {
    this.mapRef = map;
    this.host = L.DomUtil.create("div", "atlas-cad-layer");
    this.host.style.pointerEvents = "none";
    map.getPanes().overlayPane.appendChild(this.host);
    let canvas = document.createElement("canvas");
    const txt = document.createElement("canvas");
    this.host.append(canvas, txt);
    try {
      const gl = new GlRenderer(canvas);
      if (!glSelfTest(gl).ok) throw new Error("GPU self-test");
      this.renderer = gl;
      this.rendererKind = "WebGL2";
    } catch {
      canvas.replaceWith((canvas = document.createElement("canvas")));
      this.renderer = new CanvasRenderer(canvas);
      this.rendererKind = "Canvas2D";
    }
    // Both renderers support a transparent display surface over the basemap.
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.text = new TextLayer(txt);
    map.on("move zoom resize viewreset", this.redraw, this);
    this.redraw();
    return this;
  }
  private onContextLost = (e: Event) => {
    e.preventDefault();
    if (this.renderer.kind !== "webgl") return;
    const old = this.renderer.canvas;
    old.removeEventListener("webglcontextlost", this.onContextLost);
    const fresh = document.createElement("canvas");
    old.replaceWith(fresh);
    this.renderer = new CanvasRenderer(fresh);
    this.rendererKind = "Canvas2D (context loss)";
    this.mapRef.fire("atlasrendererchange");
    this.redraw();
  };
  onRemove(map: L.Map) {
    this.renderer.canvas.removeEventListener(
      "webglcontextlost",
      this.onContextLost,
    );
    if (this.renderer.kind === "webgl") {
      const gl = this.renderer.gl;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    map.off("move zoom resize viewreset", this.redraw, this);
    cancelAnimationFrame(this.frame);
    this.renderer.dispose(this.scene);
    this.host.remove();
    return this;
  }
  redraw() {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.render());
  }
  render() {
    const start = performance.now();
    const map = this.mapRef;
    const size = map.getSize();
    L.DomUtil.setPosition(this.host, map.containerPointToLayerPoint([0, 0]));
    this.host.style.width = size.x + "px";
    this.host.style.height = size.y + "px";
    this.cam.setSize(size.x, size.y, Math.min(devicePixelRatio, 2));
    const center = latLngWorld(map.getCenter(), !!this.crs);
    this.cam.cx = center.x;
    this.cam.cy = center.y;
    this.cam.scale = this.crs
      ? (256 * Math.pow(2, map.getZoom())) / (2 * Math.PI * 6378137)
      : Math.pow(2, map.getZoom());
    this.cam.rotation = 0;
    this.scene.styles.sync(this.doc.drawing.layers, this.doc.drawing.lineTypes);
    this.renderer.render(this.scene, this.cam, {
      dark: false,
      background: 0xf9fbfc,
      lineweights: true,
      transparent: !!this.crs && this.baseVisible,
    });
    this.text.render(this.scene, this.cam, false);
    this.lastFrameMs = performance.now() - start;
  }
  fit() {
    const b = this.sceneBounds();
    this.mapRef.fitBounds(
      L.latLngBounds(
        worldLatLng({ x: b.minX, y: b.minY }, !!this.crs),
        worldLatLng({ x: b.maxX, y: b.maxY }, !!this.crs),
      ),
      { padding: [40, 40], maxZoom: this.crs ? 21 : 8, animate: false },
    );
  }
  sceneBounds() {
    const all = [...this.scene.chunks.values()]
      .map((c) => c.bbox)
      .filter((b) => Number.isFinite(b.minX));
    if (!all.length) {
      const f = drawingTransform(this.crs).forward;
      const a = f(
          this.doc.drawing.meta.extMin.x,
          this.doc.drawing.meta.extMin.y,
        ),
        b = f(this.doc.drawing.meta.extMax.x, this.doc.drawing.meta.extMax.y);
      return { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y };
    }
    return {
      minX: Math.min(...all.map((b) => b.minX)),
      minY: Math.min(...all.map((b) => b.minY)),
      maxX: Math.max(...all.map((b) => b.maxX)),
      maxY: Math.max(...all.map((b) => b.maxY)),
    };
  }
  alignment(points: Vec2[]) {
    const f = drawingTransform(this.crs).forward;
    return points.map((p) => {
      const w = f(p.x, p.y),
        a = this.cam.worldToScreen(w.x, w.y),
        b = this.mapRef.latLngToContainerPoint(worldLatLng(w, !!this.crs));
      return Math.hypot(a.x - b.x, a.y - b.y);
    });
  }
}
