import { useRef, useState } from "react";
import {
  ArrowRight,
  Layers,
  Maximize,
  Plus,
  Minus,
  Ruler,
  Map,
  Eye,
  EyeOff,
  Download,
  CheckCircle2,
  AlertTriangle,
  ScanLine,
} from "lucide-react";
import type { Drawing, Vec2 } from "../cad/model/types";
import { INSUNITS } from "../cad/model/types";
import { CadViewport, type ViewHandle } from "./CadViewport";
import type { Project } from "../lib/storage";
import { db } from "../lib/storage";
import { crsFromDefinition, listCrs } from "../geo/crs";
import type { AlignmentReport } from "../map/diagnostics";
export function Viewer({
  project,
  drawing,
  compare,
  onBack,
  onError,
}: {
  project: Project;
  drawing: Drawing;
  compare: boolean;
  onBack: () => void;
  onError: (e: unknown) => void;
}) {
  const [crs, setCrs] = useState<string | null>(project.crs),
    [base, setBase] = useState(true),
    [measuring, setMeasuring] = useState(false),
    [distance, setDistance] = useState<number | null>(null),
    [position, setPosition] = useState<Vec2>({ x: 0, y: 0 }),
    [revision, setRevision] = useState(0),
    [report, setReport] = useState<AlignmentReport | null>(null);
  const handles = useRef<{ leaf?: ViewHandle; original?: ViewHandle }>({});
  const [layersOpen, setLayersOpen] = useState(true);
  const [layerSearch, setLayerSearch] = useState("");
  const suggested = crsFromDefinition(drawing.geo?.csDefinition);
  const chooseCrs = async (value: string) => {
    const next = value || null;
    if (next && ![0, 6].includes(project.units)) {
      onError(
        new Error(
          "الرسم ليس بوحدة المتر. حوّل وحداته قبل ربطه بنظام إحداثيات متري؛ يبقى العرض المحلي متاحًا.",
        ),
      );
      return;
    }
    try {
      await db.projects.update(project.id, { crs: next });
      setReport(null);
      setCrs(next);
    } catch (e) {
      onError(e);
    }
  };
  async function toggleLayer(name: string) {
    const layer = drawing.layers.find((l) => l.name === name)!;
    const previous = layer.on;
    layer.on = !layer.on;
    handles.current.leaf?.refresh();
    handles.current.original?.refresh();
    setRevision(revision + 1);
    try {
      await db.data.update(project.id, { drawing });
    } catch (e) {
      layer.on = previous;
      handles.current.leaf?.refresh();
      handles.current.original?.refresh();
      setRevision((v) => v + 1);
      onError(e);
    }
  }
  function download() {
    if (!report) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...report,
            file: project.name,
            importMs: project.importMs,
            limitations: [
              "Vertex alignment is tested, not full pixel equivalence.",
              "Long segments are projected at endpoints; curved geographic paths and text deformation require further validation.",
              "Synthetic DWG fixtures do not establish real-world DWG compatibility.",
            ],
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const u = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = u;
    a.download = "atlas-compatibility.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  return (
    <div className="viewer-page">
      <div className="viewer-title">
        <button
          className="icon-button"
          onClick={onBack}
          title="العودة إلى الملفات"
        >
          <ArrowRight />
        </button>
        <div>
          <h1>
            <bdi>{project.name}</bdi>
          </h1>
          <p>
            {compare ? "مختبر توافق Leaflet مع محرك FiberLens" : "مساحة الرسم"}{" "}
            · {drawing.entities.length.toLocaleString("ar")} عنصر
          </p>
        </div>
        <span className="format">
          {project.format === "new"
            ? "مشروع محلي"
            : project.format.toUpperCase()}
        </span>
      </div>
      <div className="viewer-toolbar">
        <div className="tool-group">
          <button
            onClick={() => {
              handles.current.leaf?.fit();
              handles.current.original?.fit();
            }}
            title="ملاءمة الرسم"
          >
            <Maximize size={18} />
            <span>ملاءمة</span>
          </button>
          <button
            title="تكبير"
            onClick={() => {
              handles.current.leaf?.zoom(2);
              handles.current.original?.zoom(2);
            }}
          >
            <Plus size={18} />
          </button>
          <button
            title="تصغير"
            onClick={() => {
              handles.current.leaf?.zoom(0.5);
              handles.current.original?.zoom(0.5);
            }}
          >
            <Minus size={18} />
          </button>
          <button
            className={measuring ? "selected" : ""}
            onClick={() => {
              setMeasuring(!measuring);
              setDistance(null);
            }}
          >
            <Ruler size={18} />
            <span>قياس</span>
          </button>
          <button
            className={layersOpen ? "selected" : ""}
            onClick={() => setLayersOpen(!layersOpen)}
          >
            <Layers size={18} />
            <span>الطبقات</span>
          </button>
        </div>
        <div className="crs-control">
          <Map size={17} />
          <select
            aria-label="نظام الإحداثيات"
            value={crs ?? ""}
            onChange={(e) => void chooseCrs(e.target.value)}
          >
            <option value="">إحداثيات محلية</option>
            {listCrs().map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.id}
              </option>
            ))}
          </select>
          {crs && (
            <label className="check">
              <input
                type="checkbox"
                checked={base}
                onChange={(e) => setBase(e.target.checked)}
              />
              الخريطة
            </label>
          )}
        </div>
      </div>
      {!crs && (
        <div className="viewer-notice">
          <ScanLine size={17} />
          <span>
            وضع محلي. اختر نظام الإحداثيات الصحيح لعرض الرسم فوق الخريطة.
            {suggested && ` يحتوي الملف على تعريف ${suggested}؛ اختره للتأكيد.`}
          </span>
        </div>
      )}
      <div className="workspace-area">
        {layersOpen && (
          <aside className="layers-panel">
            <h3>
              <Layers size={17} />
              الطبقات <span>{drawing.layers.length}</span>
            </h3>
            <input
              aria-label="البحث في الطبقات"
              placeholder="ابحث عن طبقة..."
              value={layerSearch}
              onChange={(e) => setLayerSearch(e.target.value)}
            />
            <div className="layer-list">
              {drawing.layers
                .filter((l) =>
                  l.name.toLowerCase().includes(layerSearch.toLowerCase()),
                )
                .map((l) => (
                  <button
                    key={l.name}
                    onClick={() => void toggleLayer(l.name)}
                    aria-pressed={l.on}
                    className={!l.on ? "hidden-layer" : ""}
                  >
                    {l.on ? <Eye size={16} /> : <EyeOff size={16} />}
                    <i
                      style={{
                        background:
                          l.rgb !== undefined
                            ? "#" + l.rgb.toString(16).padStart(6, "0")
                            : "#087f72",
                      }}
                    />
                    <bdi>{l.name}</bdi>
                  </button>
                ))}
            </div>
            <small>تُحفظ حالة الطبقات تلقائيًا</small>
          </aside>
        )}
        <div className={"canvases " + (compare ? "comparison" : "")}>
          {compare && (
            <div className="canvas-column">
              <div className="canvas-heading">
                FiberLens <span>الإحداثيات الأصلية</span>
              </div>
              <CadViewport
                drawing={drawing}
                crs={null}
                original
                onReady={(h) => {
                  handles.current.original = h;
                }}
                onError={onError}
              />
            </div>
          )}
          <div className="canvas-column">
            {compare && (
              <div className="canvas-heading">
                Leaflet <span>{crs ?? "LOCAL XY"}</span>
              </div>
            )}
            <CadViewport
              drawing={drawing}
              crs={crs}
              basemap={base}
              measure={measuring}
              onPointer={setPosition}
              onMeasured={setDistance}
              onReady={(h) => {
                handles.current.leaf = h;
                (window as any).__atlasViewport = h;
              }}
              onError={onError}
            />
          </div>
        </div>
      </div>
      <div className="canvas-status">
        <span>
          {measuring
            ? distance === null
              ? "انقر نقطتين داخل عارض Leaflet للقياس"
              : `المسافة: ${distance.toFixed(3)} ${INSUNITS[drawing.meta.units]?.name ?? "وحدة"}`
            : "اسحب للتحريك · عجلة الفأرة للتكبير"}
        </span>
        <bdi>
          X {position.x.toFixed(3)} &nbsp; Y {position.y.toFixed(3)}
        </bdi>
        <span>{crs ?? "إحداثيات محلية"}</span>
      </div>
      {compare && (
        <section className="diagnostic-panel">
          <div>
            <h3>اختبار محاذاة بيانات العرض</h3>
            <p>
              مقارنة رؤوس خطوط العرض الفعلية بنقاط CAD بعد التحويل. الحد
              المقبول: بكسل واحد.
            </p>
          </div>
          <button
            className="primary"
            onClick={() => {
              try {
                setReport(handles.current.leaf?.diagnose() ?? null);
              } catch (e) {
                onError(e);
              }
            }}
          >
            <ScanLine size={17} />
            تشغيل الاختبار
          </button>
          {report && (
            <>
              <div
                className={
                  "diagnostic-result " + (report.passed ? "pass" : "warn")
                }
              >
                {report.passed ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <AlertTriangle size={22} />
                )}
                <strong>
                  {report.points
                    ? report.passed
                      ? "نجح اختبار المحاذاة"
                      : "تجاوز الخطأ الحد المقبول"
                    : "لا توجد خطوط كافية للاختبار"}
                </strong>
                <span>
                  {report.points} نقطة · قراءة{" "}
                  {project.importMs?.toFixed(0) ?? "—"} ms · أقصى خطأ{" "}
                  {report.maxErrorPx.toFixed(3)} px · {report.renderer} ·{" "}
                  {report.frameMs.toFixed(1)} ms/frame ·{" "}
                  {report.gpuMB.toFixed(1)} MB GPU
                </span>
                <button className="text-button" onClick={download}>
                  <Download size={16} />
                  تنزيل النتيجة
                </button>
              </div>
            </>
          )}
          <p className="diagnostic-limit">
            الاختبار لا يثبت تطابق جميع النصوص والتعبئات. المقاطع الطويلة وتشوه
            الإسقاط والخطوط البديلة تحتاج مراجعة؛ ملفات DWG الحقيقية مطلوبة
            لاعتماد الاستخدام الإنتاجي.
          </p>
        </section>
      )}
      {!!drawing.meta.notes.length && (
        <details className="import-notes">
          <summary>
            {drawing.meta.notes.length} ملاحظات من محرك قراءة الملف
          </summary>
          <ul>
            {drawing.meta.notes.map((n, i) => (
              <li key={i} dir="auto">
                {n}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
