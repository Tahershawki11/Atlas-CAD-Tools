import Dexie, { type Table } from "dexie";
import { emptyDrawing, type Drawing } from "../cad/model/types";
export interface Project {
  id: string;
  name: string;
  format: "dwg" | "dxf" | "new";
  bytes: number;
  openedAt: number;
  createdAt: number;
  crs: string | null;
  units: number;
  importMs?: number;
}
export interface ProjectData {
  id: string;
  drawing: Drawing;
  original: Uint8Array | null;
}
export class AtlasDatabase extends Dexie {
  projects!: Table<Project, string>;
  data!: Table<ProjectData, string>;
  constructor(name = "atlas-tools") {
    super(name);
    this.version(1).stores({ projects: "id,openedAt,name,format", data: "id" });
  }
}
export const db = new AtlasDatabase();
export async function saveProject(
  drawing: Drawing,
  original: Uint8Array | null,
  name: string,
  format: Project["format"],
): Promise<Project> {
  const now = Date.now();
  const p: Project = {
    id: crypto.randomUUID(),
    name,
    format,
    bytes: original?.byteLength ?? 0,
    openedAt: now,
    createdAt: now,
    crs: null,
    units: drawing.meta.units,
  };
  await db.transaction("rw", db.projects, db.data, async () => {
    await db.projects.add(p);
    await db.data.add({ id: p.id, drawing, original });
  });
  return p;
}
export async function createProject(name: string, units: number) {
  const d = emptyDrawing(name);
  d.meta.units = units;
  return saveProject(d, null, name, "new");
}
export async function deleteProject(id: string) {
  await db.transaction("rw", db.projects, db.data, async () => {
    await db.projects.delete(id);
    await db.data.delete(id);
  });
}
export async function loadProject(id: string) {
  const data = await db.data.get(id);
  if (!data)
    throw new Error("تعذّر العثور على بيانات المشروع. أعد فتح الملف الأصلي.");
  await db.projects.update(id, { openedAt: Date.now() });
  return data;
}
export const storageError = (e: unknown) =>
  e instanceof Error &&
  (e.name === "QuotaExceededError" || /quota/i.test(e.message))
    ? "مساحة التخزين ممتلئة. احذف مشروعًا أو حرّر مساحة ثم أعد المحاولة."
    : e instanceof Error
      ? e.message
      : "حدث خطأ غير متوقع.";
