import { useEffect, useRef, useState } from "react";
import { X, FilePlus2 } from "lucide-react";
export function NewProject({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, units: number) => Promise<void>;
}) {
  const [name, setName] = useState(""),
    [units, setUnits] = useState(6),
    [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} className="modal">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onCreate(name.trim(), units);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-heading">
          <span className="modal-icon">
            <FilePlus2 />
          </span>
          <button
            type="button"
            aria-label="إغلاق"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </div>
        <h2>بداية مشروع جديد</h2>
        <p>أنشئ مساحة فارغة محفوظة على جهازك.</p>
        <label>
          اسم المشروع
          <input
            autoFocus
            required
            maxLength={120}
            placeholder="مثال: مخطط الموقع"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          وحدة الرسم
          <select
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
          >
            <option value={6}>متر</option>
            <option value={4}>ملليمتر</option>
            <option value={5}>سنتيمتر</option>
            <option value={2}>قدم</option>
            <option value={0}>بلا وحدة</option>
          </select>
        </label>
        <p className="hint">
          يفتح المشروع بإحداثيات محلية. أدوات الرسم والتصدير في إصدار لاحق.
        </p>
        <div className="modal-actions">
          <button className="primary" disabled={!name.trim() || busy}>
            {busy ? "جارٍ الإنشاء…" : "إنشاء المشروع"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            إلغاء
          </button>
        </div>
      </form>
    </dialog>
  );
}
