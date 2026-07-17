"use client";

import { useEffect, useState } from "react";
import { PositionCombobox } from "./PositionSelect";
import { getPosition } from "@/lib/positions";

const LAST_KEY = "wf-last-position";

export function HomePicker() {
  const [positionId, setPositionId] = useState("");
  const [member, setMember] = useState("");
  const [remembered, setRemembered] = useState<{ id: string; by: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id && getPosition(parsed.id)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setRemembered({ id: parsed.id, by: parsed.by || "" });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const pos = positionId ? getPosition(positionId) : undefined;
  const needsMember = !!pos && pos.members.length > 1;
  const canGo = !!pos && (!needsMember || !!member);

  function go(id: string, by: string) {
    const p = getPosition(id);
    if (!p) return;
    const filledBy = p.members.length === 1 ? p.members[0] : by;
    localStorage.setItem(LAST_KEY, JSON.stringify({ id, by: filledBy }));
    // Hard navigation (not router.push) so we always load the current deployment's
    // chunks — avoids "This page couldn't load" when an old tab hits new chunk hashes.
    window.location.href = `/form/${id}?by=${encodeURIComponent(filledBy)}`;
  }

  const rememberedPos = remembered ? getPosition(remembered.id) : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <div className="eyebrow text-[13px] font-semibold tracking-[.14em] uppercase text-[var(--accent)] mb-2.5 flex items-center gap-2.5">
          <span className="w-[26px] h-0.5 bg-[var(--accent)] rounded-full" />
          True CJ Creations · Workflow
        </div>
        <h1 className="font-disp font-bold text-[28px] leading-[1.15] mb-2">คุณอยู่ตำแหน่งไหน?</h1>
        <p className="text-[15px] text-[var(--muted)] mb-6">
          เลือกตำแหน่งของคุณเพื่อกรอกงานประจำของตำแหน่งนั้น ระบบจะเอาคำตอบทุกตำแหน่งมาต่อเป็นผังงานให้เอง
        </p>

        {rememberedPos && (
          <button
            onClick={() => go(rememberedPos.id, remembered!.by)}
            className="w-full mb-4 text-left bg-[var(--accent-soft)] border border-[var(--accent-line)] rounded-[12px] px-4 py-3 hover:opacity-90"
          >
            <div className="text-[12px] text-[var(--muted)] mb-0.5">กรอกต่อในตำแหน่งเดิม</div>
            <div className="font-semibold text-[#0F5F47]">{rememberedPos.name}</div>
            {remembered!.by && <div className="text-[12px] text-[#0F5F47]">โดย {remembered!.by}</div>}
          </button>
        )}

        <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">เลือกตำแหน่งของคุณ</label>
        <PositionCombobox
          value={positionId}
          onChange={(id) => {
            setPositionId(id);
            setMember("");
          }}
          placeholder="พิมพ์ค้นหาตำแหน่ง / ชื่อตัวเอง…"
        />

        {needsMember && (
          <div className="mt-3">
            <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">คุณคือใคร? (ตำแหน่งนี้มีหลายคน)</label>
            <select
              value={member}
              onChange={(e) => setMember(e.target.value)}
              className="w-full text-sm bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            >
              <option value="">— เลือกชื่อ —</option>
              {pos!.members.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={() => go(positionId, member)}
          disabled={!canGo}
          className="mt-4 w-full text-sm font-semibold px-5 py-3 rounded-[10px] bg-[var(--accent)] text-white disabled:opacity-50"
        >
          เริ่มกรอก
        </button>

        <div className="mt-6 pt-5 border-t border-[var(--line)] text-center">
          <a href="/my-projects" className="text-[13px] font-semibold text-[var(--accent)]">
            อัปเดตโปรเจกต์ที่คุณดูแล →
          </a>
          <p className="text-[11.5px] text-[var(--faint)] mt-1">คนละส่วนกับผังงาน · อัปเดตได้เรื่อยๆ</p>
        </div>
      </div>
    </div>
  );
}
