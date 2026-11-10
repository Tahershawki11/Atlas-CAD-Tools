import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { ArrowRight, LocateFixed, Map as MapIcon, Maximize2, Minus, Plus, Ruler, Layers, Eye, EyeOff } from "lucide-react";
import { CadDoc } from "../cad/doc/CadDoc";
import { CadView } from "../cad/render/CadView";
import { AtlasCadLayer } from "../map/AtlasCadLayer";
import type { Drawing, Vec2 } from "../cad/model/types";
import type { Project } from "../lib/storage";

export function MobileWorkspace({ project, drawing, onBack }: { project: Project; drawing: Drawing; onBack: () => void }) {
  const [mode, setMode] = useState<"cad" | "map">("cad");
  const [layerOpen, setLayerOpen] = useState(false);
  const [measure, setMeasure] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [point, setPoint] = useState<Vec2 | null>(null);
  const [renderer, setRenderer] = useState("WebGL2");
  const [layerTick, setLayerTick] = useState(0);
  const sceneHost = useRef<HTMLDivElement>(null);
  const mapHost = useRef<HTMLDivElement>(null);
  const cadRef = useRef<CadView | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<AtlasCadLayer | null>(null);
  const docRef = useRef<CadDoc | null>(null);
  const measureRef = useRef(false);
  const measurePointRef = useRef<Vec2 | null>(null);
  measureRef.current = measure;
  measurePointRef.current = point;

  useEffect(() => {
    if (mode !== "cad" || !sceneHost.current) return;
    const host = sceneHost.current;
    host.replaceChildren();
    const canvases = [0, 1, 2].map(() => document.createElement("canvas"));
    canvases.forEach((canvas) => canvas.classList.add("mobile-cad-canvas"));
    host.append(...canvases);
    const doc = new CadDoc(drawing);
    const view = new CadView(host, canvases[0], canvases[1], canvases[2]);
    view.opts.dark = true;
    view.setDoc(doc);
    cadRef.current = view;
    docRef.current = doc;
    setRenderer(view.rendererInfo.kind === "webgl" ? "WebGL2" : "Canvas2D");
    let last: { x: number; y: number } | null = null;
    const down = (event: PointerEvent) => {
      last = { x: event.clientX, y: event.clientY };
      host.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      setPoint(view.cam.screenToWorld(event.clientX - rect.left, event.clientY - rect.top));
      if (last && event.buttons) {
        view.cam.panPixels(event.clientX - last.x, event.clientY - last.y);
        view.viewChanged();
        last = { x: event.clientX, y: event.clientY };
      }
    };
    const up = () => { last = null; };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = host.getBoundingClientRect();
      view.cam.zoomAt(event.clientX - rect.left, event.clientY - rect.top, Math.exp(-event.deltaY * 0.001));
      view.viewChanged();
    };
    host.addEventListener("pointerdown", down);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);
    host.addEventListener("wheel", wheel, { passive: false });
    const click = (event: PointerEvent) => {
      if (!measureRef.current) return;
      const rect = host.getBoundingClientRect();
      const next = view.cam.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
      if (!measurePointRef.current) { measurePointRef.current = next; setPoint(next); }
      else {
        setDistance(Math.hypot(next.x - measurePointRef.current.x, next.y - measurePointRef.current.y));
        measurePointRef.current = null;
        setPoint(null);
      }
    };
    host.addEventListener("click", click);
    return () => {
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", up);
      host.removeEventListener("wheel", wheel);
      host.removeEventListener("click", click);
      view.dispose();
      if (view.gl.kind === "webgl") view.gl.gl.getExtension("WEBGL_lose_context")?.loseContext();
      cadRef.current = null;
      docRef.current = null;
      host.replaceChildren();
    };
  }, [drawing, mode]);

  useEffect(() => {
    if (mode !== "map" || !mapHost.current) return;
    const host = mapHost.current;
    host.replaceChildren();
    const map = L.map(host, {
      crs: project.crs ? L.CRS.EPSG3857 : L.CRS.Simple,
      zoomControl: false,
      attributionControl: false,
      zoomAnimation: false,
      fadeAnimation: false,
      minZoom: project.crs ? 1 : -20,
      maxZoom: project.crs ? 24 : 20,
    });
    const doc = new CadDoc(drawing);
    const layer = new AtlasCadLayer(doc, project.crs, false);
    layer.addTo(map);
    if (project.crs) {
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxNativeZoom: 19, maxZoom: 24, attribution: "© OpenStreetMap" }).addTo(map);
    }
    try { layer.fit(); } catch { map.setView([0, 0], 0); }
    mapRef.current = map;
    layerRef.current = layer;
    setRenderer(layer.rendererKind);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      host.replaceChildren();
    };
  }, [drawing, mode, project.crs]);

  function zoom(factor: number) {
    if (mode === "cad" && cadRef.current) {
      const view = cadRef.current;
      view.cam.zoomAt(view.cam.width / 2, view.cam.height / 2, factor);
      view.viewChanged();
    } else if (mapRef.current) mapRef.current.setZoom(mapRef.current.getZoom() + Math.log2(factor), { animate: false });
  }
  function fit() {
    if (mode === "cad") cadRef.current?.fitExtents();
    else layerRef.current?.fit();
  }
  function toggleLayer(name: string) {
    const layer = drawing.layers.find((item) => item.name === name);
    if (!layer) return;
    layer.on = !layer.on;
    docRef.current?.touchLayers();
    cadRef.current?.invalidateStyles();
    layerRef.current?.redraw();
    setLayerTick((v) => v + 1);
  }

  return (
    <section className="workspace-screen" dir="rtl">
      <header className="workspace-header">
        <button className="round-icon" onClick={onBack} aria-label="العودة"><ArrowRight size={20} /></button>
        <div className="workspace-file">
          <span className={"file-badge " + project.format}>{project.format === "new" ? "NEW" : project.format.toUpperCase()}</span>
          <div><strong>{project.name}</strong><small>{drawing.entities.length.toLocaleString("ar-EG")} عنصر</small></div>
        </div>
        <button className="round-icon" onClick={() => setLayerOpen((v) => !v)} aria-label="الطبقات"><Layers size={19} /></button>
      </header>
      <div className="workspace-tabs" role="tablist">
        <button className={mode === "cad" ? "active" : ""} onClick={() => setMode("cad")} role="tab" aria-selected={mode === "cad"}>مساحة الرسم</button>
        <button className={mode === "map" ? "active" : ""} onClick={() => setMode("map")} role="tab" aria-selected={mode === "map"}><MapIcon size={16} /> الخريطة</button>
      </div>
      <div className="workspace-canvas-wrap">
        <div ref={sceneHost} className={mode === "cad" ? "workspace-surface visible" : "workspace-surface"} dir="ltr" />
        <div ref={mapHost} className={mode === "map" ? "workspace-surface visible" : "workspace-surface"} dir="ltr" />
        {!drawing.entities.length && <div className="empty-canvas"><strong>مساحة رسم جديدة</strong><span>ابدأ بإضافة عناصر إلى مشروعك</span></div>}
        <span className="renderer-chip"><span /> {renderer}</span>
        {distance !== null && <span className="measure-chip">المسافة: {distance.toFixed(2)} وحدة</span>}
      </div>
      <div className="workspace-tools">
        <button onClick={() => zoom(0.7)} aria-label="تصغير"><Minus size={19} /></button>
        <button onClick={fit} aria-label="ملاءمة الرسم"><Maximize2 size={18} /></button>
        <button onClick={() => zoom(1.4)} aria-label="تكبير"><Plus size={19} /></button>
        <button className={measure ? "selected" : ""} onClick={() => { setMeasure((v) => !v); setDistance(null); setPoint(null); }}><Ruler size={18} /><span>قياس</span></button>
        {mode === "map" && <button><LocateFixed size={18} /><span>موقعي</span></button>}
      </div>
      {layerOpen && <aside className="mobile-layers">
        <div className="panel-title"><strong>الطبقات</strong><button onClick={() => setLayerOpen(false)}>إغلاق</button></div>
        {drawing.layers.map((layer) => <button key={layer.name + layerTick} className={!layer.on ? "off" : ""} onClick={() => toggleLayer(layer.name)}><i style={{ background: layer.rgb === undefined ? "#5ed0bf" : "#" + layer.rgb.toString(16).padStart(6, "0") }} />{layer.on ? <Eye size={16} /> : <EyeOff size={16} />}<bdi>{layer.name}</bdi></button>)}
      </aside>}
    </section>
  );
}
