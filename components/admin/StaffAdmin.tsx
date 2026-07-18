"use client";

import { useMemo, useRef, useState } from "react";
import { Position, Staff, makeDirectory } from "@/lib/directory";

const inputCls =
  "w-full text-sm bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-3 py-2.5 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]";

type Draft = { id?: string; nick: string; fullName: string; positionId: string; unit: string };
const emptyDraft = (): Draft => ({ nick: "", fullName: "", positionId: "", unit: "" });

export function StaffAdmin({ positions, initialStaff }: { positions: Position[]; initialStaff: Staff[] }) {
  const [staff, setStaff] = useState<Staff[]>(initialStaff);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [modal, setModal] = useState<null | Draft>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<null | { text: string; undo: () => void }>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dir = useMemo(() => makeDirectory(positions, staff), [positions, staff]);
  const activePositions = positions.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  const q = query.trim().toLowerCase();
  const matches = (s: Staff) =>
    !q ||
    s.nick.toLowerCase().includes(q) ||
    (s.fullName ?? "").toLowerCase().includes(q) ||
    dir.positionName(s.positionId).toLowerCase().includes(q);

  const activeCount = staff.filter((s) => s.isActive).length;
  const inactiveCount = staff.filter((s) => !s.isActive).length;

  const activeRows = dir.staffOrderedAll.filter((s) => s.isActive && matches(s));
  const inactiveRows = dir.staffOrderedAll.filter((s) => !s.isActive && matches(s));

  const grouped = useMemo(() => {
    const out: { group: string; items: Staff[] }[] = [];
    for (const g of dir.groups) {
      const items = activeRows.filter((s) => dir.staffGroup(s.id) === g);
      if (items.length) out.push({ group: g, items });
    }
    // staff whose group is not among active groups (e.g. inactive position)
    const rest = activeRows.filter((s) => !dir.groups.includes(dir.staffGroup(s.id) ?? ""));
    if (rest.length) out.push({ group: "อื่นๆ", items: rest });
    return out;
  }, [dir, activeRows]);

  function showToast(text: string, undo: () => void) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }

  async function patch(id: string, patchBody: Record<string, unknown>) {
    const res = await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patchBody }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || "บันทึกไม่สำเร็จ");
    return body.staff as Staff;
  }

  async function toggleActive(s: Staff) {
    try {
      const updated = await patch(s.id, { isActive: !s.isActive });
      setStaff((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
      if (!updated.isActive) {
        showToast(`ปิด ${dir.staffLabel(s.id)} แล้ว`, async () => {
          const re = await patch(s.id, { isActive: true });
          setStaff((prev) => prev.map((x) => (x.id === s.id ? re : x)));
          setToast(null);
        });
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "ทำไม่สำเร็จ");
    }
  }

  function openAdd() {
    setError(null);
    setModal(emptyDraft());
  }
  function openEdit(s: Staff) {
    setError(null);
    setModal({ id: s.id, nick: s.nick, fullName: s.fullName ?? "", positionId: s.positionId, unit: s.unit ?? "" });
  }

  const dupWarning = useMemo(() => {
    if (!modal || !modal.nick.trim()) return null;
    const dup = staff.find(
      (s) => s.id !== modal.id && s.nick.trim().toLowerCase() === modal.nick.trim().toLowerCase()
    );
    return dup ? `มี "${dup.nick}" อยู่แล้วในตำแหน่ง ${dir.positionName(dup.positionId)} ตรวจสอบว่าไม่ใช่คนเดียวกัน` : null;
  }, [modal, staff, dir]);

  async function saveModal() {
    if (!modal) return;
    if (!modal.nick.trim()) return setError("กรุณาใส่ชื่อเล่น");
    if (!modal.positionId) return setError("กรุณาเลือกตำแหน่ง");

    // Warn when moving an existing person to a different position.
    if (modal.id) {
      const orig = staff.find((s) => s.id === modal.id);
      if (orig && orig.positionId !== modal.positionId) {
        const remaining = staff.filter((s) => s.positionId === orig.positionId && s.isActive && s.id !== orig.id).length;
        const ok = window.confirm(
          `${orig.nick}จะย้ายจาก ${dir.positionName(orig.positionId)} ไป ${dir.positionName(modal.positionId)}\n\n` +
            `ข้อมูลผังงานผูกกับตำแหน่ง ไม่ใช่ตัวบุคคล จึงไม่กระทบ แต่ตำแหน่ง ${dir.positionName(orig.positionId)} จะเหลือ ${remaining} คน`
        );
        if (!ok) return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: modal.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modal),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "บันทึกไม่สำเร็จ");
      const saved = body.staff as Staff;
      setStaff((prev) => (modal.id ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved]));
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function Row({ s }: { s: Staff }) {
    return (
      <div className={`bg-[var(--surface)] border border-[var(--line)] rounded-[12px] px-4 py-2.5 flex items-center gap-3 ${s.isActive ? "" : "opacity-55"}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[14px]">{s.nick}</span>
            {s.fullName && <span className="text-[12px] text-[var(--faint)]">{s.fullName}</span>}
            {!s.isActive && <span className="text-[10px] rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[var(--faint)]">ปิดใช้งาน</span>}
          </div>
          <div className="text-[12px] text-[var(--faint)] mt-0.5">
            {dir.positionName(s.positionId)}
            {s.unit && ` · ${s.unit}`}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => openEdit(s)} className="text-[12.5px] text-[var(--accent)] font-semibold">แก้ไข</button>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={s.isActive} onChange={() => toggleActive(s)} className="w-4 h-4 accent-[var(--accent)]" />
            <span className="text-[12px] text-[var(--muted)]">{s.isActive ? "เปิด" : "ปิด"}</span>
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-[#F0F4F2] border border-[var(--line)] rounded-[12px] px-4 py-3 text-[13px] text-[var(--muted)] leading-relaxed">
        ระบบไม่มีการลบพนักงาน ปิดแล้วชื่อจะหายจากหน้าเลือกคน แต่ข้อมูลเดิมยังอยู่ครบและเปิดกลับได้ตลอด · ใช้กับคนที่ลาออก ลายาว หรือยังไม่เริ่มงาน
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อเล่น / ชื่อเต็ม / ตำแหน่ง…" className={`${inputCls} flex-1 min-w-[200px]`} />
        <button onClick={openAdd} className="text-sm font-semibold px-4 py-2.5 rounded-[10px] bg-[var(--accent)] text-white whitespace-nowrap">
          + เพิ่มพนักงาน
        </button>
      </div>

      <div className="flex items-center justify-between text-[12.5px] text-[var(--muted)]">
        <span>พนักงานที่ใช้งานอยู่ <b>{activeCount}</b> คน · ปิดใช้งาน <b>{inactiveCount}</b> คน</span>
        {inactiveCount > 0 && (
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
            แสดงคนที่ปิดใช้งาน
          </label>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <div className="text-[11px] font-semibold text-[var(--faint)] uppercase tracking-wide mb-1.5">{group}</div>
            <div className="flex flex-col gap-1.5">
              {items.map((s) => (
                <Row key={s.id} s={s} />
              ))}
            </div>
          </div>
        ))}

        {showInactive && inactiveRows.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-[var(--faint)] uppercase tracking-wide mb-1.5">ปิดใช้งาน ({inactiveRows.length})</div>
            <div className="flex flex-col gap-1.5">
              {inactiveRows.map((s) => (
                <Row key={s.id} s={s} />
              ))}
            </div>
          </div>
        )}

        {activeRows.length === 0 && inactiveRows.length === 0 && (
          <div className="text-[13.5px] text-[var(--faint)] py-6 text-center border border-[var(--line)] rounded-[14px]">ไม่พบพนักงานที่ค้นหา</div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[var(--ink)] text-white text-[13px] rounded-[12px] px-4 py-2.5 flex items-center gap-3 shadow-lg">
          <span>{toast.text}</span>
          <button onClick={toast.undo} className="font-semibold text-[#8FE3C4]">เลิกทำ</button>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-[var(--surface)] rounded-[16px] p-5 w-full max-w-[440px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-[16px] mb-4">{modal.id ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}</div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">ชื่อเล่น *</label>
                <input value={modal.nick} onChange={(e) => setModal({ ...modal, nick: e.target.value })} className={inputCls} autoFocus />
                {dupWarning && <div className="text-[12px] text-[var(--warn,#B65418)] mt-1" style={{ color: "#B65418" }}>{dupWarning}</div>}
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">ชื่อ-นามสกุล</label>
                <input value={modal.fullName} onChange={(e) => setModal({ ...modal, fullName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">ตำแหน่ง *</label>
                <select value={modal.positionId} onChange={(e) => setModal({ ...modal, positionId: e.target.value })} className={inputCls}>
                  <option value="">— เลือกตำแหน่ง —</option>
                  {dir.groups.map((g) => (
                    <optgroup key={g} label={g}>
                      {activePositions.filter((p) => p.group === g).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <a href="/admin/positions" className="inline-block text-[12px] text-[var(--accent)] font-semibold mt-1">ตำแหน่งนี้ยังไม่มีในระบบ เพิ่มตำแหน่งใหม่ →</a>
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">
                  Unit <span className="text-[var(--faint)] font-normal">(ใส่เฉพาะ Producer)</span>
                </label>
                <input value={modal.unit} onChange={(e) => setModal({ ...modal, unit: e.target.value })} className={inputCls} placeholder="เช่น Unit 1" />
              </div>
              {error && <div className="text-[13px] text-[var(--danger)]">{error}</div>}
              <div className="flex items-center gap-2 mt-1">
                <button onClick={saveModal} disabled={busy} className="text-sm font-semibold px-5 py-2.5 rounded-[10px] bg-[var(--accent)] text-white disabled:opacity-60">
                  {busy ? "กำลังบันทึก…" : modal.id ? "บันทึก" : "เพิ่ม"}
                </button>
                <button onClick={() => setModal(null)} className="text-sm text-[var(--muted)] px-3 py-2.5">ยกเลิก</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
