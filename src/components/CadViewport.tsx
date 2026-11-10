import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { CadDoc } from "../cad/doc/CadDoc";
import { CadView } from "../cad/render/CadView";
import { AtlasCadLayer } from "../map/AtlasCadLayer";
import { latLngWorld, drawingTransform } from "../map/projection";
import { diagnose, type AlignmentReport } from "../map/diagnostics";
import type { Drawing, Vec2 } from "../cad/model/types";
export interface ViewHandle {
  fit: () => void;
  zoom: (n: number) => void;
  refresh: () => void;
  diagnose: () => AlignmentReport | null;
  map?: L.Map;
  layer?: AtlasCadLayer;
  view?: CadView;
}
export function CadViewport({
  drawing,
  crs,
  original = false,
  basemap = false,
  measure = false,
  onReady,
  onPointer,
  onMeasured,
  onError,
}: {
  drawing: Drawing;
  crs: string | null;
  original?: boolean;
  basemap?: boolean;
  measure?: boolean;
  onReady: (h: ViewHandle) => void;
  onPointer?: (p: Vec2) => void;
  onMeasured?: (n: number) => void;
  onError: (e: unknown) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    measureRef = useRef(measure),
    callbacks = useRef({ onReady, onPointer, onMeasured, onError });
  callbacks.current = { onReady, onPointer, onMeasured, onError };
  measureRef.current = measure;
  const [renderer, setRenderer] = useState("");
  useEffect(() => {
    const el = host.current!;
    const doc = new CadDoc(drawing);
    let cleanup = () => {};
    try {
      if (original) {
        const canvases = [0, 1, 2].map(() => document.createElement("canvas"));
        el.append(...canvases);
        const view = new CadView(el, canvases[0], canvases[1], canvases[2]);
        view.opts.dark = false;
        view.opts.lineweights = true;
        view.setDoc(doc);
        view.onRendererChange = (info) =>
          setRenderer(info.kind === "webgl" ? "WebGL2" : "Canvas2D");
        (window as any).__atlasOriginal = view;
        setRenderer(view.rendererInfo.kind === "webgl" ? "WebGL2" : "Canvas2D");
        let last: { x: number; y: number } | null = null;
        const down = (e: PointerEvent) => {
          last = { x: e.clientX, y: e.clientY };
          el.setPointerCapture(e.pointerId);
        };
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          callbacks.current.onPointer?.(
            view.cam.screenToWorld(e.clientX - r.left, e.clientY - r.top),
          );
          if (last && e.buttons) {
            view.cam.panPixels(e.clientX - last.x, e.clientY - last.y);
            view.viewChanged();
            last = { x: e.clientX, y: e.clientY };
          }
        };
        const wheel = (e: WheelEvent) => {
          e.preventDefault();
          const r = el.getBoundingClientRect();
          view.cam.zoomAt(
            e.clientX - r.left,
            e.clientY - r.top,
            Math.exp(-e.deltaY * 0.001),
          );
          view.viewChanged();
        };
        el.addEventListener("pointerdown", down);
        el.addEventListener("pointermove", move);
        el.addEventListener("wheel", wheel, { passive: false });
        callbacks.current.onReady({
          view,
          fit: () => view.fitExtents(),
          zoom: (n) => {
            view.cam.zoomAt(view.cam.width / 2, view.cam.height / 2, n);
            view.viewChanged();
          },
          refresh: () => {
            doc.touchLayers();
            view.invalidateStyles();
          },
          diagnose: () => null,
        });
        cleanup = () => {
          view.dispose();
          if (view.gl.kind === "webgl")
            view.gl.gl.getExtension("WEBGL_lose_context")?.loseContext();
          delete (window as any).__atlasOriginal;
          el.removeEventListener("pointerdown", down);
          el.removeEventListener("pointermove", move);
          el.removeEventListener("wheel", wheel);
          el.replaceChildren();
        };
      } else {
        const map = L.map(el, {
          crs: crs ? L.CRS.EPSG3857 : L.CRS.Simple,
          zoomControl: false,
          attributionControl: true,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
          zoomSnap: 0,
          minZoom: crs ? 1 : -20,
          maxZoom: crs ? 24 : 20,
          preferCanvas: true,
        });
        map.setView([0, 0], crs ? 2 : 0);
        let tile: L.TileLayer | undefined;
        if (crs && basemap) {
          tile = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxNativeZoom: 19,
            maxZoom: 24,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          });
          let notified = false;
          tile.on("tileerror", () => {
            if (!notified) {
              notified = true;
              callbacks.current.onError(
                new Error("تعذّر تحميل بعض مربعات الخريطة. يظل الرسم متاحًا."),
              );
            }
          });
          tile.addTo(map);
        }
        const layer = new AtlasCadLayer(doc, crs, basemap);
        try {
          layer.addTo(map);
          layer.fit();
        } catch (e) {
          map.remove();
          throw e;
        }
        setRenderer(layer.rendererKind);
        map.on("atlasrendererchange", () => setRenderer(layer.rendererKind));
        let first: Vec2 | null = null,
          points: L.CircleMarker[] = [];
        let line: L.Polyline | null = null;
        const click = (e: L.LeafletMouseEvent) => {
          if (!measureRef.current) return;
          const world = latLngWorld(e.latlng, !!crs);
          const cad = drawingTransform(crs).inverse(world.x, world.y);
          if (!first) {
            points.forEach((p) => p.remove());
            line?.remove();
            points = [];
            first = cad;
            points.push(
              L.circleMarker(e.latlng, {
                radius: 4,
                color: "#087f72",
                fillOpacity: 1,
              }).addTo(map),
            );
          } else {
            callbacks.current.onMeasured?.(
              Math.hypot(first.x - cad.x, first.y - cad.y),
            );
            const p = points[0].getLatLng();
            points.push(
              L.circleMarker(e.latlng, {
                radius: 4,
                color: "#087f72",
                fillOpacity: 1,
              }).addTo(map),
            );
            line = L.polyline([p, e.latlng], {
              color: "#087f72",
              dashArray: "5 5",
            }).addTo(map);
            first = null;
          }
        };
        map.on("click", click);
        map.on("mousemove", (e) => {
          try {
            const w = latLngWorld(e.latlng, !!crs);
            callbacks.current.onPointer?.(
              drawingTransform(crs).inverse(w.x, w.y),
            );
          } catch {}
        });
        const observer = new ResizeObserver(() => {
          map.invalidateSize({ animate: false });
          layer.redraw();
        });
        observer.observe(el);
        callbacks.current.onReady({
          map,
          layer,
          fit: () => layer.fit(),
          zoom: (n) =>
            map.setZoom(map.getZoom() + Math.log2(n), { animate: false }),
          refresh: () => layer.redraw(),
          diagnose: () => {
            layer.render();
            return diagnose(layer, map);
          },
        });
        cleanup = () => {
          observer.disconnect();
          map.remove();
          delete (window as any).__atlasViewport;
        };
      }
    } catch (e) {
      callbacks.current.onError(e);
    }
    return cleanup;
  }, [drawing, crs, original, basemap]);
  return (
    <div className={"viewport " + (measure ? "measuring" : "")}>
      <div ref={host} className="canvas-host" dir="ltr" />
      <span className="renderer-label">
        {original ? "العارض الأصلي" : "Leaflet"} · {renderer}
      </span>
      {!drawing.entities.length && (
        <div className="blank-drawing">
          مساحة مشروعك جاهزة<small>أدوات الرسم والتحرير في إصدار لاحق</small>
        </div>
      )}
    </div>
  );
}
