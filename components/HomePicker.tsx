"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PersonCombobox } from "./PersonSelect";
import { getStaff } from "@/lib/staff";

const LAST_PERSON_KEY = "wf-last-person";

export function HomePicker() {
  const router = useRouter();
  const [personId, setPersonId] = useState("");
  const [remembered, setRemembered] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LAST_PERSON_KEY);
    if (saved && getStaff(saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemembered(saved);
    }
  }, []);

  function go(id: string) {
    if (!id || !getStaff(id)) return;
    localStorage.setItem(LAST_PERSON_KEY, id);
    router.push(`/form/${id}`);
  }

  const rememberedStaff = remembered ? getStaff(remembered) : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <div className="eyebrow text-[13px] font-semibold tracking-[.14em] uppercase text-[var(--accent)] mb-2.5 flex items-center gap-2.5">
          <span className="w-[26px] h-0.5 bg-[var(--accent)] rounded-full" />
          True CJ Creations · Workflow
        </div>
        <h1 className="font-disp font-bold text-[28px] leading-[1.15] mb-2">คุณคือใคร?</h1>
        <p className="text-[15px] text-[var(--muted)] mb-6">
          เลือกชื่อตัวเองเพื่อกรอกงานที่คุณทำ ระบบจะเอาคำตอบของทุกคนมาต่อเป็นผังงานให้เอง
        </p>

        {rememberedStaff && (
          <button
            onClick={() => go(rememberedStaff.id)}
            className="w-full mb-4 text-left bg-[var(--accent-soft)] border border-[var(--accent-line)] rounded-[12px] px-4 py-3 hover:opacity-90"
          >
            <div className="text-[12px] text-[var(--muted)] mb-0.5">กรอกต่อในชื่อเดิม</div>
            <div className="font-semibold text-[#0F5F47]">
              {rememberedStaff.nick} <span className="font-normal text-[13px]">— {rememberedStaff.title}</span>
            </div>
          </button>
        )}

        <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">
          เลือกชื่อของคุณ
        </label>
        <PersonCombobox value={personId} onChange={setPersonId} placeholder="พิมพ์ค้นหาชื่อตัวเอง…" />

        <button
          onClick={() => go(personId)}
          disabled={!personId}
          className="mt-4 w-full text-sm font-semibold px-5 py-3 rounded-[10px] bg-[var(--accent)] text-white disabled:opacity-50"
        >
          เริ่มกรอก
        </button>
      </div>
    </div>
  );
}
