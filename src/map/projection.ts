import L from "leaflet";
import { project, unproject, getCrs } from "../geo/crs";
import type { Vec2 } from "../cad/model/types";
export type Transform = (x: number, y: number) => Vec2;
export function drawingTransform(crs: string | null): {
  forward: Transform;
  inverse: Transform;
} {
  if (!crs)
    return { forward: (x, y) => ({ x, y }), inverse: (x, y) => ({ x, y }) };
  if (!getCrs(crs)) throw new Error("نظام الإحداثيات غير معروف");
  const forward: Transform = (x, y) => {
    const p = unproject(crs, x, y);
    if (
      !Number.isFinite(p.lon) ||
      !Number.isFinite(p.lat) ||
      Math.abs(p.lat) > 85.05112878
    )
      throw new Error(
        "الإحداثيات خارج نطاق خريطة Mercator. تحقق من نظام الإحداثيات والوحدة.",
      );
    return project("EPSG:3857", p.lon, p.lat);
  };
  const inverse: Transform = (x, y) => {
    const p = unproject("EPSG:3857", x, y);
    return project(crs, p.lon, p.lat);
  };
  return { forward, inverse };
}
export function worldLatLng(p: Vec2, geographic: boolean) {
  if (!geographic) return L.latLng(p.y, p.x);
  return L.CRS.EPSG3857.unproject(L.point(p.x, p.y));
}
export function latLngWorld(p: L.LatLng, geographic: boolean): Vec2 {
  if (!geographic) return { x: p.lng, y: p.lat };
  const v = L.CRS.EPSG3857.project(p);
  return { x: v.x, y: v.y };
}
