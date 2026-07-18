"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Directory, DirectorySnapshot, makeDirectory } from "@/lib/directory";

// Central directory cache. Seeded with a server-rendered snapshot (active
// positions + staff) so the first paint already has data — no loading flash.
// A single `/api/directory` refetch on mount keeps it fresh after admin edits
// without every component fetching on its own.

type Ctx = { dir: Directory; loading: boolean };

const DirectoryContext = createContext<Ctx | null>(null);

export function DirectoryProvider({
  initial,
  children,
}: {
  initial: DirectorySnapshot;
  children: React.ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<DirectorySnapshot>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/directory")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.positions && data?.staff) {
          setSnapshot({ positions: data.positions, staff: data.staff });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const dir = useMemo(() => makeDirectory(snapshot.positions, snapshot.staff), [snapshot]);

  return <DirectoryContext.Provider value={{ dir, loading }}>{children}</DirectoryContext.Provider>;
}

export function useDirectory(): Ctx {
  const ctx = useContext(DirectoryContext);
  if (!ctx) throw new Error("useDirectory must be used inside <DirectoryProvider>");
  return ctx;
}
