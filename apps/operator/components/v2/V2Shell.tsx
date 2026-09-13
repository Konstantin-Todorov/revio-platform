"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LayoutGrid, Activity, Building2, Ticket, Inbox, FileText, BarChart3,
  Radio, HeartPulse, Search, Bell, Sun, Moon, Menu, X, ChevronsUpDown, Settings, LogOut,
} from "lucide-react";

/**
 * The v2 chrome, shared by every v2 page.
 *
 * ⚠️ It is a LAYOUT, not a page decoration. The first pass baked the rail and topbar into the home
 * screen, which meant the design could only ever be judged one screen at a time — and a console is
 * judged by moving through it.
 *
 * Icons are Lucide at `strokeWidth 1.5`, 16px. The library ships 2 and every generator leaves it
 * there; 1.5 is what Linear and Vercel actually run, and it is the difference between an icon that
 * sits in the interface and one that shouts from it.
 */

const NAV: { group: string; items: { href: string; label: string; icon: typeof LayoutGrid; count?: "hotels" | "errors" }[] }[] = [
  {
    group: "Today",
    items: [
      { href: "/v2", label: "Home", icon: LayoutGrid },
      { href: "/v2/health", label: "Platform health", icon: Activity, count: "errors" },
    ],
  },
  {
    group: "Customers",
    items: [
      { href: "/v2/clients", label: "Hotels", icon: Building2, count: "hotels" },
      { href: "/clients", label: "Trials", icon: Ticket },
      { href: "/leads", label: "Enquiries", icon: Inbox },
    ],
  },
  {
    group: "Revenue",
    items: [
      { href: "/v2/billing", label: "Invoices", icon: FileText },
      { href: "/plans", label: "Plans & pricing", icon: BarChart3 },
    ],
  },
  {
    group: "Platform",
    items: [
      { href: "/connectivity", label: "Connectivity", icon: Radio },
      { href: "/health", label: "Jobs", icon: HeartPulse },
    ],
  },
];

const PRODUCTS = [
  { k: "L", n: "RevioLink", d: "Channels, mapping, ARI", c: "var(--link)" },
  { k: "C", n: "RevioCRS", d: "Reservations, rates, guests", c: "var(--crs)" },
  { k: "P", n: "RevioPMS", d: "Front desk, housekeeping, folios", c: "var(--pms)" },
];

export interface ShellProps {
  counts: { hotels: number; errors: number };
  search: { t: string; s: string; h: string; g: string }[];
  children: ReactNode;
}

export function V2Shell({ counts, search, children }: ShellProps) {
  const path = usePathname();
  const [open, setOpen] = useState<"ws" | "bell" | "me" | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [pal, setPal] = useState(false);
  const [q, setQ] = useState("");
  const [dark, setDark] = useState(false);
  const [mod, setMod] = useState("⌘");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMod(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl ");
    setDark(matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  // Any navigation closes everything — a drawer that survives a route change is how somebody ends
  // up on a new screen looking at the old screen's menu.
  useEffect(() => { setDrawer(false); setOpen(null); setPal(false); }, [path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setOpen(null); setPal(true); setQ("");
        requestAnimationFrame(() => input.current?.focus());
      }
      if (e.key === "Escape") { setPal(false); setOpen(null); setDrawer(false); }
    };
    const onClick = () => setOpen(null);
    addEventListener("keydown", onKey);
    addEventListener("click", onClick);
    return () => { removeEventListener("keydown", onKey); removeEventListener("click", onClick); };
  }, []);

  const toggle = (k: "ws" | "bell" | "me") => (e: React.MouseEvent) => {
    e.stopPropagation(); setOpen((c) => (c === k ? null : k));
  };
  const hits = search.filter((c) => `${c.t} ${c.s}`.toLowerCase().includes(q.trim().toLowerCase()));
  const count = (k?: "hotels" | "errors") => (k === "hotels" ? counts.hotels : k === "errors" ? counts.errors : undefined);

  const Rail = (
    <>
      <div style={{ position: "relative" }}>
        <button className="ws" onClick={toggle("ws")} aria-haspopup="menu" aria-expanded={open === "ws"}
                style={{ width: "100%", border: 0, font: "inherit", textAlign: "left" }}>
          <span className="m">R</span>
          <span className="t"><b>Revio</b><s>Operator console</s></span>
          <ChevronsUpDown className="c" size={13} strokeWidth={1.5} />
        </button>
        <div className="pop pop-l" data-open={open === "ws"} role="menu" onClick={(e) => e.stopPropagation()}>
          <h6>Revio · operator</h6>
          <button className="mi" role="menuitem" aria-current="true">
            <span className="sw" style={{ background: "#16305a" }}>R</span>
            <span className="two"><b>Operator console</b><s>Every hotel, billing, health</s></span>
          </button>
          <hr />
          <h6>Hotel products</h6>
          {PRODUCTS.map((p, i) => (
            <button key={p.n} className="mi" role="menuitem">
              <span className="sw" style={{ background: p.c }}>{p.k}</span>
              <span className="two"><b>{p.n}</b><s>{p.d}</s></span>
              <span className="k">{i + 1}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="find" onClick={(e) => { e.stopPropagation(); setPal(true); setQ(""); requestAnimationFrame(() => input.current?.focus()); }}
              style={{ width: "100%", border: "1px solid var(--line)", font: "inherit", fontSize: "12.5px" }}>
        <Search size={13} strokeWidth={1.5} />
        Search
        <kbd>{mod}K</kbd>
      </button>

      {NAV.map((g) => (
        <div key={g.group}>
          <div className="sect">{g.group}</div>
          <nav className="nav">
            {g.items.map(({ href, label, icon: Icon, count: ck }) => {
              const n = count(ck);
              return (
                <Link key={href} href={href} className={path === href ? "on" : undefined}>
                  <Icon size={16} strokeWidth={1.5} />
                  {label}
                  {n !== undefined && n > 0 && <span className={`n${ck === "errors" ? " hot" : ""}`}>{n}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </>
  );

  return (
    <div className="v2" data-theme={dark ? "dark" : "light"} style={{ minHeight: "100vh", padding: "0" }}>
      <div className="app shell">
        <aside className="rail rail-desktop">{Rail}</aside>

        {/* A phone gets a drawer, never a squeezed rail: 228px of chrome on a 390px screen leaves
            nothing to work in. Same links, same order, same counts. */}
        <div className="drawer-scrim" data-open={drawer} onClick={() => setDrawer(false)} />
        <aside className="rail rail-drawer" data-open={drawer}>
          <button className="ic drawer-x" onClick={() => setDrawer(false)} aria-label="Close menu"><X size={16} strokeWidth={1.5} /></button>
          {Rail}
        </aside>

        <div className="main">
          <div className="top">
            <button className="ic burger" onClick={(e) => { e.stopPropagation(); setDrawer(true); }} aria-label="Open menu">
              <Menu size={17} strokeWidth={1.5} />
            </button>
            <span className="crumb"><b>{NAV.flatMap((g) => g.items).find((i) => i.href === path)?.label ?? "Home"}</b></span>
            <span className="sp" style={{ flex: 1 }} />

            <div className="seg hide-sm" role="group" aria-label="Time range">
              <button aria-pressed="false">30d</button>
              <button aria-pressed="true">90d</button>
              <button aria-pressed="false">12m</button>
            </div>

            <button className="ic" onClick={(e) => { e.stopPropagation(); setDark((d) => !d); }} aria-label="Switch theme" style={{ border: 0, background: "none" }}>
              {dark ? <Moon size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />}
            </button>

            <div style={{ position: "relative" }}>
              <button className="ic" onClick={toggle("bell")} aria-haspopup="dialog" aria-expanded={open === "bell"} style={{ border: 0, background: "none", position: "relative" }}>
                <Bell size={16} strokeWidth={1.5} />
                {counts.errors > 0 && <span className="dot-badge" />}
              </button>
              <div className="pop pop-r notif" data-open={open === "bell"} role="dialog" onClick={(e) => e.stopPropagation()}>
                <h6>Notifications</h6>
                {counts.errors === 0
                  ? <p style={{ padding: "14px 9px", fontSize: 12.5, color: "var(--ink-4)" }}>Nothing is failing. Last checked a moment ago.</p>
                  : <div className="nrow"><span className="d" style={{ background: "var(--neg)" }} />
                      <span className="b"><b>{counts.errors}</b> open error{counts.errors === 1 ? "" : "s"} across the platform.<s>Open Platform health</s></span></div>}
              </div>
            </div>

            <div style={{ position: "relative" }}>
              <button className="me" onClick={toggle("me")} aria-haspopup="menu" aria-expanded={open === "me"} style={{ cursor: "pointer" }}>KT</button>
              <div className="pop pop-r" data-open={open === "me"} role="menu" onClick={(e) => e.stopPropagation()} style={{ top: 46, minWidth: 236 }}>
                <div style={{ display: "flex", gap: 10, padding: "8px 9px 10px" }}>
                  <span className="me" style={{ width: 34, height: 34, fontSize: 12 }}>KT</span>
                  <span style={{ minWidth: 0, lineHeight: 1.3 }}>
                    <b style={{ display: "block", fontSize: 13, fontWeight: 600 }}>Operator</b>
                    <s style={{ display: "block", textDecoration: "none", fontSize: 11, color: "var(--ink-4)" }}>operator@revio.app</s>
                  </span>
                </div>
                <hr />
                <Link className="mi" href="/settings"><Settings size={16} strokeWidth={1.5} />Settings</Link>
                <Link className="mi" href="/logout" style={{ color: "var(--neg)" }}><LogOut size={16} strokeWidth={1.5} />Sign out</Link>
              </div>
            </div>
          </div>

          <div className="page">{children}</div>
        </div>
      </div>

      <div className="scrim" data-open={pal} onClick={() => setPal(false)} />
      <div className="pal" data-open={pal} role="dialog" aria-modal="true" aria-label="Search">
        <div className="pal-in">
          <Search size={17} strokeWidth={1.5} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Search hotels — or jump to a screen" autoComplete="off" spellCheck={false} />
          <span className="esc">esc</span>
        </div>
        <div className="pal-body">
          {hits.length === 0
            ? <p className="pal-empty">Nothing matches “{q}”.</p>
            : hits.map((c, i) => (
                <div key={`${c.h}-${i}`}>
                  {(i === 0 || hits[i - 1]!.g !== c.g) && <h6>{c.g}</h6>}
                  <Link className="mi" href={c.h} onClick={() => setPal(false)}>
                    <span className="two"><b>{c.t}</b><s>{c.s}</s></span>
                  </Link>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
