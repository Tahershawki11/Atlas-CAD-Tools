import { useState } from "react";
import {
  FolderOpen,
  FilePlus2,
  Search,
  HardDrive,
  ArrowUpLeft,
  Trash2,
  File,
  FlaskConical,
} from "lucide-react";
import type { Project } from "../lib/storage";
import { Blueprint } from "./Blueprint";
export function FilesPage({
  projects,
  onOpen,
  onNew,
  onSelect,
  onDelete,
  onDemo,
}: {
  projects: Project[];
  onOpen: () => void;
  onNew: () => void;
  onSelect: (p: Project) => void;
  onDelete: (p: Project) => void;
  onDemo: () => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const rows = projects.filter(
    (p) =>
      (filter === "all" || p.format === filter) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="files-page">
      <section className="page-heading">
        <h1>ملفاتك، في مساحة واحدة.</h1>
        <p>افتح رسوماتك الهندسية وابدأ العمل بدقة.</p>
      </section>
      <div className="actions-grid">
        <button className="action-card open-card" onClick={onOpen}>
          <FolderOpen size={40} />
          <div>
            <h2>فتح ملف</h2>
            <p>
              افتح ملفًا بصيغة <bdi>DWG / DXF</bdi>
            </p>
          </div>
          <Blueprint small />
          <ArrowUpLeft className="action-arrow" size={21} />
        </button>
        <button className="action-card" onClick={onNew}>
          <FilePlus2 size={38} />
          <div>
            <h2>ملف جديد</h2>
            <p>مساحة فارغة لمشروعك القادم</p>
          </div>
          <ArrowUpLeft className="action-arrow" size={21} />
        </button>
      </div>
      <section className="files-panel">
        <div className="section-title">
          <h2>
            الملفات الأخيرة <span>{projects.length.toLocaleString("ar")}</span>
          </h2>
          <button className="text-button demo-link" onClick={onDemo}>
            <FlaskConical size={16} /> تجربة ملف نموذجي
          </button>
        </div>
        <div className="table-controls">
          <label className="search-box">
            <Search size={19} />
            <input
              aria-label="البحث في الملفات"
              placeholder="البحث في الملفات..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="segments" aria-label="تصفية الملفات">
            {[
              ["all", "الكل"],
              ["dwg", "DWG"],
              ["dxf", "DXF"],
            ].map(([v, t]) => (
              <button
                key={v}
                className={filter === v ? "active" : ""}
                onClick={() => setFilter(v)}
                aria-pressed={filter === v}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>اسم الملف</th>
                <th>الصيغة</th>
                <th>الحجم</th>
                <th>آخر فتح</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button className="filename" onClick={() => onSelect(p)}>
                      <span className={"file-icon " + p.format}>
                        <File size={21} />
                      </span>
                      <span>
                        <bdi>{p.name}</bdi>
                        {p.format === "new" && <small>مشروع فارغ</small>}
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className="format">
                      {p.format === "new" ? "مشروع" : p.format.toUpperCase()}
                    </span>
                  </td>
                  <td className="numeric">
                    {p.bytes ? formatBytes(p.bytes) : "—"}
                  </td>
                  <td>
                    {new Date(p.openedAt).toLocaleDateString("ar-EG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        title="فتح المشروع"
                        aria-label={"فتح " + p.name}
                        onClick={() => onSelect(p)}
                      >
                        <ArrowUpLeft size={19} />
                      </button>
                      <button
                        title="حذف المشروع"
                        aria-label={"حذف " + p.name}
                        onClick={() => onDelete(p)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty-state">
            <Blueprint />
            <h3>
              {projects.length ? "لا توجد نتائج مطابقة" : "لا توجد ملفات بعد."}
            </h3>
            <p>
              {projects.length
                ? "جرّب اسمًا آخر أو غيّر تصفية الملفات."
                : "افتح أول ملف لعرضه هنا والبدء في العمل."}
            </p>
            {!projects.length && (
              <button className="primary" onClick={onOpen}>
                <FolderOpen size={18} /> افتح أول ملف
              </button>
            )}
          </div>
        )}
      </section>
      <div className="storage-note">
        <HardDrive size={29} />
        <div>
          <strong>ملفاتك محفوظة على جهازك.</strong>
          <p>
            تعمل Atlas Tools محليًا في متصفحك. احتفظ بنسخة خارجية؛ مسح بيانات
            المتصفح يحذف المشاريع.
          </p>
        </div>
        <span className="note-line" />
      </div>
      <footer className="page-footer">
        <span>
          Atlas Tools <bdi> / </bdi> مساحة للرسومات الهندسية
        </span>
        <span>DWG · DXF</span>
      </footer>
    </div>
  );
}
function formatBytes(n: number) {
  return n >= 1048576
    ? (n / 1048576).toFixed(1) + " MB"
    : (n / 1024).toFixed(1) + " KB";
}
