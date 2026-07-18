"use client";

import { useMemo, useState } from "react";
import { Position, KNOWN_GROUPS } from "@/lib/directory";

const inputCls =
  "w-full text-sm bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-3 py-2.5 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]";

export function PositionsAdmin({
  initial,
  counts,
}: {
  initial: Position[];
  counts: Record<string, number>; // active staff per position
}) {
  const [positions, setPositions] = useState<Position[]>(
    [...initial].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const groupOptions = useMemo(() => {
    const set = new Set<string>(KNOWN_GROUPS);
    for (const p of positions) set.add(p.group);
    return [...set];
  }, [positions]);

  async function add() {
    if (!name.trim()) return setError("กรุณาใส่ชื่อตำแหน่ง");
    if (!group.trim()) return setError("กรุณาเลือกหรือใส่กลุ่ม");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, group }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "เพิ่มไม่สำเร็จ");
      setPositions((prev) => [...prev, body.position as Position].sort((a, b) => a.sortOrder - b.sortOrder));
      setName("");
      setGroup("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(id: string) {
    if (!editName.trim()) return;
    const res = await fetch("/api/admin/positions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName }),
    });
    const body = await res.json();
    if (res.ok) {
      setPositions((prev) => prev.map((p) => (p.id === id ? (body.position as Position) : p)));
    }
    setEditId(null);
  }

  async function toggleActive(p: Position) {
    const res = await fetch("/api/admin/positions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, isActive: !p.isActive }),
    });
    const body = await res.json();
    if (!res.ok) {
      window.alert(body?.error || "ทำไม่สำเร็จ");
      return;
    }
    setPositions((prev) => prev.map((x) => (x.id === p.id ? (body.position as Position) : x)));
  }

  async function persistOrder(next: Position[]) {
    setPositions(next);
    await fetch("/api/admin/positions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((p) => p.id) }),
    });
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return setDragId(null);
    const from = positions.findIndex((p) => p.id === dragId);
    const to = positions.findIndex((p) => p.id === targetId);
    if (from === -1 || to === -1) return setDragId(null);
    const next = [...positions];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null);
    persistOrder(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[16px] p-5 shadow-sm">
        <div className="font-semibold text-[15px] mb-3">เพิ่มตำแหน่งใหม่</div>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] items-end">
          <div>
            <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">ชื่อตำแหน่ง *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="เช่น Sound Designer" />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">กลุ่ม *</label>
            <input list="pos-groups" value={group} onChange={(e) => setGroup(e.target.value)} className={inputCls} placeholder="เลือกหรือพิมพ์ใหม่" />
            <datalist id="pos-groups">
              {groupOptions.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <button onClick={add} disabled={busy} className="text-sm font-semibold px-5 py-2.5 rounded-[10px] bg-[var(--accent)] text-white disabled:opacity-60">
            {busy ? "กำลังเพิ่ม…" : "เพิ่ม"}
          </button>
        </div>
        {error && <div className="text-[13px] text-[var(--danger)] mt-2">{error}</div>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12.5px] font-semibold text-[var(--muted)]">ตำแหน่งทั้งหมด ({positions.length})</div>
          <div className="text-[12px] text-[var(--faint)]">ลากเพื่อจัดลำดับ (มีผลกับลำดับช่องในผัง)</div>
        </div>
        <div className="flex flex-col gap-1.5">
          {positions.map((p) => {
            const n = counts[p.id] ?? 0;
            return (
              <div
                key={p.id}
                draggable
                onDragStart={() => setDragId(p.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(p.id)}
                className={`bg-[var(--surface)] border rounded-[12px] px-3 py-2.5 flex items-center gap-3 ${
                  dragId === p.id ? "border-[var(--accent)] opacity-70" : "border-[var(--line)]"
                } ${p.isActive ? "" : "opacity-55"}`}
              >
                <span className="cursor-grab text-[var(--faint)] select-none" title="ลากเพื่อจัดลำดับ">⠿</span>
                <div className="min-w-0 flex-1">
                  {editId === p.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveRename(p.id)}
                        autoFocus
                        className="flex-1 text-sm bg-[var(--field)] border border-[var(--field-bd)] rounded-[8px] px-2 py-1 outline-none focus:border-[var(--accent)]"
                      />
                      <button onClick={() => saveRename(p.id)} className="text-[12.5px] font-semibold text-[var(--accent)]">บันทึก</button>
                      <button onClick={() => setEditId(null)} className="text-[12.5px] text-[var(--faint)]">ยกเลิก</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[14px] truncate">{p.name}</span>
                      <span className="text-[11px] rounded-full bg-[var(--bg)] border border-[var(--line)] px-2 py-0.5 text-[var(--faint)]">{p.group}</span>
                      <span className="text-[11.5px] text-[var(--faint)]">· {n} คน</span>
                      {!p.isActive && <span className="text-[10px] rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[var(--faint)]">ปิดใช้งาน</span>}
                    </div>
                  )}
                </div>
                {editId !== p.id && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditId(p.id);
                        setEditName(p.name);
                      }}
                      className="text-[12.5px] text-[var(--accent)] font-semibold"
                    >
                      แก้ชื่อ
                    </button>
                    <button onClick={() => toggleActive(p)} className="text-[12.5px] text-[var(--faint)] hover:text-[var(--ink)]">
                      {p.isActive ? "ปิด" : "เปิด"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[12px] text-[var(--faint)] mt-3">ระบบไม่มีการลบตำแหน่ง มีแค่เปิด/ปิด · ปิดตำแหน่งที่ยังมีพนักงานเปิดใช้งานอยู่ไม่ได้ ต้องย้ายหรือปิดคนก่อน</p>
      </div>
    </div>
  );
}
