import { useEffect, useRef, useState } from "react";
import {
  FolderOpen,
  ClipboardCheck,
  BookOpen,
  HardDrive,
  ChevronLeft,
  X,
  Loader2,
  FilePlus2,
  ArrowUpLeft,
} from "lucide-react";
import { FilesPage } from "./components/FilesPage";
import { NewProject } from "./components/NewProject";
import { Viewer } from "./components/Viewer";
import { getLatestRelease, isNewerRelease, apkAsset, releaseRepository } from "./lib/updater";
import {
  db,
  saveProject,
  createProject,
  deleteProject,
  loadProject,
  storageError,
  type Project,
} from "./lib/storage";
import { readCadFile } from "./cad/io/cadClient";
import type { Drawing } from "./cad/model/types";
type Page = "files" | "lab" | "guide";
export default function App() {
  const [page, setPage] = useState<Page>("files"),
    [projects, setProjects] = useState<Project[]>([]),
    [active, setActive] = useState<{
      project: Project;
      drawing: Drawing;
    } | null>(null),
    [modal, setModal] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const refresh = async () =>
    setProjects(await db.projects.orderBy("openedAt").reverse().toArray());
  useEffect(() => {
    refresh().catch((e) => setError(storageError(e)));
    navigator.storage?.persist?.().catch(() => {});
  }, []);
  const fail = (e: unknown) => setError(storageError(e));
  async function select(p: Project) {
    setBusy("جارٍ فتح المشروع…");
    try {
      const d = await loadProject(p.id);
      setActive({ project: p, drawing: d.drawing });
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  }
  async function open(file: File) {
    if (!/\.(dwg|dxf)$/i.test(file.name)) {
      setError("اختر ملف DWG أو DXF صالحًا.");
      return;
    }
    setBusy("جارٍ قراءة الرسم وحفظ نسخة محلية…");
    setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { drawing, ms } = await readCadFile(bytes, file.name);
      if (!drawing.entities.length)
        throw new Error(
          "لم يعثر المحرك على عناصر قابلة للعرض. قد يكون الملف فارغًا أو يحتوي أنواعًا غير مدعومة.",
        );
      const format = file.name.toLowerCase().endsWith(".dwg") ? "dwg" : "dxf";
      const p = await saveProject(drawing, bytes, file.name, format);
      p.importMs = ms;
      await db.projects.update(p.id, { importMs: ms });
      setActive({ project: p, drawing });
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  }
  async function demo() {
    setBusy("جارٍ تحميل الملف النموذجي…");
    try {
      const res = await fetch("/samples/FTTH-Demo-Area.dxf");
      if (!res.ok) throw new Error("تعذّر تحميل العينة");
      const file = new File([await res.arrayBuffer()], "FTTH-Demo-Area.dxf");
      await open(file);
    } catch (e) {
      fail(e);
      setBusy("");
    }
  }
  const navigate = (p: Page) => {
    setPage(p);
    setActive(null);
    setError("");
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("files");
          }}
          aria-label="Atlas Tools الرئيسية"
        >
          <svg viewBox="0 0 40 44" fill="none">
            <path
              d="M19 3 2 39l18-9 18 9L23 3h-4Zm1 10 6 15-6-4-6 4 6-15Z"
              fill="currentColor"
            />
          </svg>
          <span>
            Atlas Tools<small>مساحة الرسومات الهندسية</small>
          </span>
        </a>
        <div className="nav-label">مساحة العمل</div>
        <nav>
          {(
            [
              { id: "files", label: "الملفات", icon: FolderOpen },
              { id: "lab", label: "اختبار التوافق", icon: ClipboardCheck },
              { id: "guide", label: "دليل الاستخدام", icon: BookOpen },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              onClick={() => navigate(n.id)}
              className={page === n.id ? "active" : ""}
              aria-current={page === n.id ? "page" : undefined}
            >
              <n.icon size={21} />
              <span>{n.label}</span>
              {page === n.id && <ChevronLeft size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span />
            بيئة عمل محلية
          </div>
          <p>
            ملفاتك تبقى ملكك.
            <br />
            ومساحة عملك تبقى معك.
          </p>
          <span className="version">
            ATLAS TOOLS <b>V 0.1</b>
          </span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <FolderOpen size={17} />
            <span>مساحة العمل</span>
            <ChevronLeft size={14} />
            <strong>
              {page === "files"
                ? "الملفات"
                : page === "lab"
                  ? "اختبار التوافق"
                  : "دليل الاستخدام"}
            </strong>
          </div>
          <span className="local-chip">
            <span />
            التخزين المحلي
            <HardDrive size={17} />
          </span>
        </header>
        <main>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button aria-label="إغلاق التنبيه" onClick={() => setError("")}>
                <X size={17} />
              </button>
            </div>
          )}
          {active ? (
            <Viewer
              key={active.project.id + page}
              project={active.project}
              drawing={active.drawing}
              compare={page === "lab"}
              onBack={() => {
                setActive(null);
                void refresh();
              }}
              onError={fail}
            />
          ) : page === "files" ? (
            <FilesPage
              projects={projects}
              onOpen={() => input.current?.click()}
              onNew={() => setModal(true)}
              onSelect={(p) => void select(p)}
              onDelete={setDeleteTarget}
              onDemo={() => void demo()}
            />
          ) : page === "lab" ? (
            <div className="lab-page">
              <section className="page-heading">
                <h1>نختبر التوافق، قبل البناء.</h1>
                <p>عارض FiberLens وLeaflet جنبًا إلى جنب، على الملف نفسه.</p>
              </section>
              <section className="lab-intro">
                <ClipboardCheck size={42} />
                <h2>اختبار حقيقي لبيانات الرسم</h2>
                <p>
                  افتح ملفًا لمراجعة الخطوط والطبقات والنصوص، واختبار محاذاة
                  نقاط العرض أثناء التكبير والتحريك. تُحفظ النتائج بصيغة JSON
                  للمراجعة.
                </p>
                <div className="lab-actions">
                  <button
                    className="primary"
                    onClick={() => input.current?.click()}
                  >
                    <FolderOpen size={18} />
                    فتح ملف للاختبار
                  </button>
                  <button className="secondary" onClick={() => void demo()}>
                    استخدام الملف النموذجي
                    <ArrowUpLeft size={17} />
                  </button>
                </div>
                <div className="lab-facts">
                  <div>
                    <strong>01</strong>
                    <h3>نفس المحرك</h3>
                    <p>acad-ts 3.2.0 وبيانات عرض FiberLens</p>
                  </div>
                  <div>
                    <strong>02</strong>
                    <h3>إحداثيات واضحة</h3>
                    <p>محلية، UTM أو أحزمة مصر مع تأكيد النظام</p>
                  </div>
                  <div>
                    <strong>03</strong>
                    <h3>نتيجة قابلة للقياس</h3>
                    <p>محاذاة الرؤوس، زمن الإطار، وذاكرة GPU</p>
                  </div>
                </div>
              </section>
              {projects.length > 0 && (
                <section className="project-picker">
                  <h2>اختبار مشروع موجود</h2>
                  {projects.map((p) => (
                    <button
                      className="picker-row"
                      key={p.id}
                      onClick={() => void select(p)}
                    >
                      <FolderOpen size={19} />
                      <bdi>{p.name}</bdi>
                      <ArrowUpLeft size={18} />
                    </button>
                  ))}
                </section>
              )}
              <p className="lab-disclaimer">
                نجاح اختبار النقاط لا يعني اعتماد كل ملفات DWG. راجع تقرير
                الاختبارات وحدود الخطوط وOLE وملفات Xref قبل الاستخدام الإنتاجي.
              </p>
            </div>
          ) : (
            <Guide />
          )}
        </main>
      </div>
      <input
        ref={input}
        type="file"
        accept=".dwg,.dxf"
        aria-label="اختيار ملف CAD"
        className="file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void open(f);
        }}
      />
      {modal && (
        <NewProject
          onClose={() => setModal(false)}
          onCreate={async (name, units) => {
            try {
              const p = await createProject(name, units);
              const d = await loadProject(p.id);
              setModal(false);
              setPage("files");
              setActive({ project: p, drawing: d.drawing });
              await refresh();
            } catch (e) {
              fail(e);
            }
          }}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onDelete={async () => {
            try {
              await deleteProject(deleteTarget.id);
              setDeleteTarget(null);
              await refresh();
            } catch (e) {
              fail(e);
            }
          }}
        />
      )}
      {busy && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div>
            <Loader2 className="spin" size={30} />
            <strong>{busy}</strong>
            <p>قد تستغرق الرسومات الكبيرة بعض الوقت.</p>
          </div>
        </div>
      )}
    </div>
  );
}
function DeleteDialog({
  name,
  onClose,
  onDelete,
}: {
  name: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <h2>حذف المشروع؟</h2>
      <p>
        ستُحذف نسخة «<bdi>{name}</bdi>» وبياناتها من هذا المتصفح. لن يتغير الملف
        الأصلي على جهازك.
      </p>
      <div className="modal-actions">
        <button
          className="danger"
          disabled={deleting}
          onClick={async () => {
            setDeleting(true);
            try {
              await onDelete();
            } finally {
              setDeleting(false);
            }
          }}
        >
          حذف المشروع
        </button>
        <button className="secondary" disabled={deleting} onClick={onClose}>
          إلغاء
        </button>
      </div>
    </dialog>
  );
}
function Guide() {
  const [update, setUpdate] = useState<{ state: "idle" | "checking" | "available" | "current" | "missing" | "error"; tag?: string; url?: string }>({ state: "idle" });
  const checkForUpdate = async () => {
    setUpdate({ state: "checking" });
    try {
      const release = await getLatestRelease();
      if (!release) { setUpdate({ state: "missing" }); return; }
      const version = release.tag_name;
      const current = isNewerRelease(version, "0.1.0");
      const apk = apkAsset(release);
      setUpdate(current && apk ? { state: "available", tag: version, url: apk.browser_download_url } : { state: "current", tag: version });
    } catch { setUpdate({ state: "error" }); }
  };
  return (
    <div className="guide-page">
      <section className="page-heading">
        <h1>من الملف إلى الخريطة.</h1>
        <p>خطوات بسيطة لمساحة عمل دقيقة.</p>
      </section>
      <article className="guide-content">
        <h2>
          <FolderOpen />
          فتح ملفاتك
        </h2>
        <p>
          اختر «فتح ملف» لاستيراد DWG أو DXF. تُحفظ نسخة أصلية وبيانات المشروع
          في هذا المتصفح، ويمكن إعادة فتحه من سجل الملفات.
        </p>
        <h2>
          <FilePlus2 />
          إنشاء مشروع
        </h2>
        <p>
          اختر اسم المشروع ووحدة الرسم. يبدأ المشروع فارغًا بإحداثيات محلية؛
          أدوات الرسم والتحرير والتصدير خارج نطاق هذا الإصدار.
        </p>
        <h2>
          <MapIcon />
          اختيار الإحداثيات
        </h2>
        <p>
          يبدأ كل ملف جديد في الوضع المحلي. اختر CRS معروفًا للرسم، مثل WGS84 /
          UTM 36N أو Egypt 1907 / Red Belt، ليظهر فوق الخريطة. لا يمكن تحديد
          منطقة UTM بدقة من أرقام الرسم وحدها. أنظمة الإسقاط المترية تتطلب رسمًا
          بالمتر؛ ملفات الوحدات الأخرى تبقى في الوضع المحلي.
        </p>
        <h2>
          <ClipboardCheck />
          مراجعة التوافق
        </h2>
        <p>
          افتح «اختبار التوافق» ثم اختر ملفًا. قارن العارضين بصريًا وشغّل اختبار
          المحاذاة بعد التكبير والتحريك. التقرير يقيس رؤوس الخطوط الفعلية؛ راجع
          النصوص والتعبئات بشكل مستقل.
        </p>
        <h2>
          <HardDrive />
          الحفظ وحدود الدعم
        </h2>
        <p>
          مسح بيانات المتصفح يحذف المشاريع؛ احتفظ بملفاتك الأصلية. DWG R13 وما
          قبله غير مدعوم. تُستبدل خطوط SHX بخطوط متاحة في المتصفح. لا تُعرض OLE
          والصور المضمّنة فعليًا، ولا تُحمّل مراجع Xref تلقائيًا. الخريطة
          الأساسية تحتاج إنترنت، بينما CAD والتخزين يعملان محليًا ما دامت صفحة
          التطبيق محمّلة.
        </p>
      <section className="update-card">
        <div><h2><DownloadIcon />تحديث التطبيق</h2><p>يتحقق Atlas Tools من آخر APK منشور في GitHub Releases. عند توفر إصدار جديد، افتح الحزمة وثبّتها من الهاتف.</p></div>
        <button className="primary" onClick={() => void checkForUpdate()} disabled={update.state === "checking"}>{update.state === "checking" ? "جارٍ الفحص…" : "فحص التحديثات"}</button>
        {update.state === "available" && <a className="primary" href={update.url} target="_blank" rel="noreferrer">تنزيل {update.tag}</a>}
        {update.state === "current" && <span className="update-result">أنت على أحدث إصدار منشور {update.tag}</span>}
        {update.state === "missing" && <span className="update-result">لم يُنشر Release بعد في {releaseRepository}</span>}
        {update.state === "error" && <span className="update-result error-text">تعذّر الاتصال بـ GitHub. حاول لاحقًا.</span>}
      </section>
      <p className="hint">
          مبني باستخدام Leaflet وacad-ts وأجزاء من{" "}
          <a
            href="https://github.com/Ahshika/FiberLens"
            target="_blank"
            rel="noreferrer"
          >
            FiberLens
          </a>
          . تفاصيل الإصدارات والاختبارات في ملفات توثيق المشروع.
        </p>
      </article>
    </div>
  );
}
function DownloadIcon(){return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/></svg>}
function MapIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15" />
    </svg>
  );
}
