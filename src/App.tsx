import { useEffect, useRef, useState } from "react";
import { ArrowUpLeft, FilePlus2, FolderOpen, HardDrive, Loader2, Trash2, X } from "lucide-react";
import { createProject, db, deleteProject, loadProject, saveProject, storageError, type Project } from "./lib/storage";
import { readCadFile } from "./cad/io/cadClient";
import type { Drawing } from "./cad/model/types";
import { MobileWorkspace } from "./components/MobileWorkspace";

type OpenProject = { project: Project; drawing: Drawing };

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<OpenProject | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setProjects(await db.projects.orderBy("openedAt").reverse().toArray());
  }
  useEffect(() => {
    void refresh().catch((e) => setError(storageError(e)));
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);
  function fail(e: unknown) { setError(storageError(e)); }
  async function openFile(file: File) {
    if (!/\.(dwg|dxf)$/i.test(file.name)) { setError("اختر ملف DWG أو DXF."); return; }
    setBusy("جارٍ استيراد الرسم…");
    setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await readCadFile(bytes, file.name);
      const format = file.name.toLowerCase().endsWith(".dwg") ? "dwg" : "dxf";
      const project = await saveProject(result.drawing, bytes, file.name, format);
      await db.projects.update(project.id, { importMs: result.ms });
      setActive({ project: { ...project, importMs: result.ms }, drawing: result.drawing });
      await refresh();
    } catch (e) { fail(e); }
    finally { setBusy(""); }
  }
  async function openExisting(project: Project) {
    setBusy("جارٍ فتح المشروع…");
    try { const data = await loadProject(project.id); setActive({ project, drawing: data.drawing }); await refresh(); }
    catch (e) { fail(e); }
    finally { setBusy(""); }
  }
  async function createBlank(name: string, units: number) {
    setBusy("جارٍ إنشاء المشروع…");
    try { const project = await createProject(name, units); const data = await loadProject(project.id); setNewProjectOpen(false); setActive({ project, drawing: data.drawing }); await refresh(); }
    catch (e) { fail(e); }
    finally { setBusy(""); }
  }
  return (
    <div className="atlas-app" dir="rtl">
      {active ? <MobileWorkspace project={active.project} drawing={active.drawing} onBack={() => { setActive(null); void refresh(); }} /> : <HomeScreen projects={projects} onImport={() => inputRef.current?.click()} onNew={() => setNewProjectOpen(true)} onOpen={openExisting} onDelete={async (project) => { try { await deleteProject(project.id); await refresh(); } catch (e) { fail(e); } }} />}
      <input ref={inputRef} className="hidden-input" type="file" accept=".dwg,.dxf" aria-label="استيراد ملف DWG أو DXF" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void openFile(file); }} />
      {error && <div className="mobile-error" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="إغلاق"><X size={17} /></button></div>}
      {busy && <div className="mobile-loading" role="status"><Loader2 className="spin" size={25} /><span>{busy}</span></div>}
      {newProjectOpen && <NewProjectSheet onClose={() => setNewProjectOpen(false)} onCreate={createBlank} />}
    </div>
  );
}

function HomeScreen({ projects, onImport, onNew, onOpen, onDelete }: { projects: Project[]; onImport: () => void; onNew: () => void; onOpen: (project: Project) => void; onDelete: (project: Project) => void | Promise<void> }) {
  return <main className="home-screen">
    <header className="home-header">
      <div className="atlas-mark"><span>A</span></div>
      <div><strong>Atlas Tools</strong><small>أدوات الرسومات الهندسية</small></div>
      <span className="offline-pill"><i /> محلي</span>
    </header>
    <section className="welcome-block">
      <span className="eyebrow">مساحة عملك الهندسية</span>
      <h1>ابدأ من الرسم.</h1>
      <p>استورد ملف CAD أو ابدأ مشروعًا فارغًا من هاتفك.</p>
    </section>
    <section className="entry-actions" aria-label="بدء مشروع">
      <button className="entry-card import" onClick={onImport}>
        <span className="entry-icon"><FolderOpen size={24} /></span>
        <span><strong>استيراد ملف</strong><small>DWG أو DXF من الهاتف</small></span>
        <ArrowUpLeft size={19} />
      </button>
      <button className="entry-card blank" onClick={onNew}>
        <span className="entry-icon"><FilePlus2 size={24} /></span>
        <span><strong>ملف جديد فارغ</strong><small>ابدأ مخططًا من الصفر</small></span>
        <ArrowUpLeft size={19} />
      </button>
    </section>
    <section className="recent-section">
      <div className="section-heading"><div><span className="eyebrow">محفوظ على الهاتف</span><h2>المشاريع الأخيرة</h2></div><span className="count-badge">{projects.length.toLocaleString("ar-EG")}</span></div>
      {projects.length ? <div className="recent-list">{projects.slice(0, 6).map((project) => <div className="recent-row" key={project.id}><button onClick={() => onOpen(project)} className="recent-open"><span className={"recent-format " + project.format}>{project.format === "new" ? "NEW" : project.format.toUpperCase()}</span><span><bdi>{project.name}</bdi><small>{new Date(project.openedAt).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</small></span></button><button className="row-delete" aria-label={`حذف ${project.name}`} onClick={() => void onDelete(project)}><Trash2 size={17} /></button></div>)}</div> : <div className="recent-empty"><HardDrive size={22} /><p>لا توجد مشاريع بعد.<small>ستظهر ملفاتك هنا بعد أول استيراد.</small></p></div>}
    </section>
    <footer className="home-footer"><span>Atlas Tools · Mobile CAD</span><span>بياناتك تبقى على جهازك</span></footer>
  </main>;
}

function NewProjectSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, units: number) => Promise<void> }) {
  const [name, setName] = useState("");
  const [units, setUnits] = useState(6);
  return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="new-sheet" role="dialog" aria-modal="true" aria-labelledby="new-project-title"><div className="sheet-handle" /><div className="sheet-heading"><div><span className="eyebrow">مشروع محلي</span><h2 id="new-project-title">ملف جديد فارغ</h2></div><button className="round-icon" onClick={onClose} aria-label="إغلاق"><X size={19} /></button></div><label>اسم المشروع<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: مخطط الموقع" maxLength={80} /></label><label>وحدة الرسم<select value={units} onChange={(event) => setUnits(Number(event.target.value))}><option value={6}>متر</option><option value={4}>ملليمتر</option><option value={5}>سنتيمتر</option><option value={2}>قدم</option><option value={0}>بلا وحدة</option></select></label><button className="sheet-primary" disabled={!name.trim()} onClick={() => void onCreate(name.trim(), units)}>إنشاء وفتح المشروع</button></section></div>;
}
