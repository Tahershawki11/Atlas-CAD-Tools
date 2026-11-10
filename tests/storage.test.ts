import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  db,
  saveProject,
  loadProject,
  deleteProject,
  createProject,
} from "../src/lib/storage";
import { emptyDrawing } from "../src/cad/model/types";
afterEach(async () => {
  await db.projects.clear();
  await db.data.clear();
});
describe("local project integrity", () => {
  it("retains original bytes and layer state on reopening", async () => {
    const d = emptyDrawing("Original");
    const bytes = new Uint8Array([1, 2, 3]);
    const p = await saveProject(d, bytes, "file.dwg", "dwg");
    bytes[0] = 99;
    const loaded = await loadProject(p.id);
    expect(loaded.original).toEqual(new Uint8Array([1, 2, 3]));
    loaded.drawing.layers[0].on = false;
    await db.data.update(p.id, { drawing: loaded.drawing });
    expect((await loadProject(p.id)).drawing.layers[0].on).toBe(false);
    expect((await loadProject(p.id)).original).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
  it("creates an empty project with chosen units", async () => {
    const p = await createProject("مخطط جديد", 4);
    const d = await loadProject(p.id);
    expect(p.crs).toBe(null);
    expect(d.drawing.meta.units).toBe(4);
    expect(d.drawing.entities).toHaveLength(0);
  });
  it("deletes metadata and payload together", async () => {
    const p = await createProject("Delete", 6);
    await deleteProject(p.id);
    expect(await db.projects.get(p.id)).toBeUndefined();
    await expect(loadProject(p.id)).rejects.toThrow();
  });
  it("rolls back both records if the data write fails", async () => {
    const bad = emptyDrawing();
    (bad as any).invalid = () => {};
    await expect(saveProject(bad, null, "bad", "new")).rejects.toThrow();
    expect(await db.projects.count()).toBe(0);
  });
});
