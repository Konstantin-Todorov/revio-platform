"use client";

import { createContext, useContext, useState } from "react";

type ShellCtx = { open: boolean; setOpen: (v: boolean) => void; toggle: () => void };

const Ctx = createContext<ShellCtx | null>(null);

/** Holds the mobile-drawer open state shared by Sidebar (the drawer) and Topbar (the hamburger). */
export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Ctx.Provider value={{ open, setOpen, toggle: () => setOpen((o) => !o) }}>{children}</Ctx.Provider>;
}

export function useShell() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShell must be used within ShellProvider");
  return ctx;
}
