import { useEffect, useMemo, useRef, useState } from "react";
import { REGIONS, PARTNER_TYPES, PIPELINE_STAGES, labelOf, optionOf } from "../../crm/constants";
import { normalizePhone } from "../../crm/normalize";
import { ROUTES, BOTTOM_ROUTES } from "./useHashRoute";
import { Icon, BrandLogo, Badge, C, btnStyle } from "../ui";

// ─── ZIJBALK ─────────────────────────────────────────────────────────────────
function NavItem({ route, active, collapsed, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={collapsed ? route.label : undefined}
      className={active ? undefined : "msk-nav"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        width: "100%",
        border: "none",
        borderRadius: 10,
        padding: collapsed ? "10px 0" : "9px 12px",
        justifyContent: collapsed ? "center" : "flex-start",
        background: active ? C.navy : "transparent",
        color: active ? "#fff" : C.navy,
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        fontFamily: "inherit",
        position: "relative",
      }}
    >
      <Icon name={route.icon} size={18} />
      {!collapsed && <span style={{ flex: 1, textAlign: "left" }}>{route.label}</span>}
      {badge > 0 && (
        <span
          style={{
            position: collapsed ? "absolute" : "static",
            top: 4,
            right: 8,
            background: active ? C.gold : C.danger,
            color: active ? C.navyDark : "#fff",
            borderRadius: 999,
            fontSize: 10.5,
            fontWeight: 700,
            padding: "1px 6px",
            minWidth: 18,
            textAlign: "center",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export function Sidebar({ page, navigate, collapsed, setCollapsed, badges = {} }) {
  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="msk-sidebar"
      style={{
        width: collapsed ? 68 : 232,
        flexShrink: 0,
        background: C.surfaceWarm,
        borderRight: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        transition: "width .18s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: collapsed ? "16px 0" : "16px 18px", justifyContent: collapsed ? "center" : "flex-start", minHeight: 68 }}>
        <BrandLogo height={34} />
        {!collapsed && <span style={{ fontFamily: C.fontDisplay, fontWeight: 600, fontSize: 16, color: C.navy, lineHeight: 1.15 }}>Mijn Spanje Kompas</span>}
      </div>
      <div style={{ padding: collapsed ? "6px 10px" : "6px 12px", display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        {ROUTES.map((r) => (
          <NavItem key={r.key} route={r} active={page === r.key} collapsed={collapsed} onClick={() => navigate(r.key)} badge={badges[r.key]} />
        ))}
      </div>
      <div style={{ padding: collapsed ? "10px" : "10px 12px", borderTop: `1px solid ${C.borderSoft}`, display: "flex", flexDirection: "column", gap: 3 }}>
        {BOTTOM_ROUTES.map((r) => (
          <NavItem key={r.key} route={r} active={page === r.key} collapsed={collapsed} onClick={() => navigate(r.key)} />
        ))}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Menu uitklappen" : "Menu inklappen"}
          title={collapsed ? "Menu uitklappen" : "Menu inklappen"}
          className="msk-nav"
          style={{ display: "flex", alignItems: "center", gap: 11, border: "none", background: "transparent", color: C.textMuted, borderRadius: 10, padding: collapsed ? "10px 0" : "9px 12px", justifyContent: collapsed ? "center" : "flex-start", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}
        >
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={16} />
          {!collapsed && "Inklappen"}
        </button>
      </div>
    </nav>
  );
}

// ─── UNIVERSEEL ZOEKEN ───────────────────────────────────────────────────────
function searchIndex(leads, partners) {
  const leadRows = leads.map((l) => ({
    kind: "lead",
    id: l.id,
    item: l,
    text: [l.name, l.email, l.phone, normalizePhone(l.phone), ...(l.places || []), ...(l.regions || []).map((r) => labelOf(REGIONS, r)), ...(l.partnerNames || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }));
  const partnerRows = partners.map((p) => ({
    kind: "partner",
    id: p.id,
    item: p,
    text: [p.name, p.contactPerson, p.email, p.phone].filter(Boolean).join(" ").toLowerCase(),
  }));
  return [...leadRows, ...partnerRows];
}

export function GlobalSearch({ leads, partners, onOpenLead, onOpenPartner }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const index = useMemo(() => searchIndex(leads, partners), [leads, partners]);

  const results = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const digits = q.replace(/\D/g, "");
    return index
      .filter((r) => terms.every((t) => r.text.includes(t)) || (digits.length >= 5 && r.text.includes(digits)))
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "lead" ? -1 : 1))
      .slice(0, 8);
  }, [q, index]);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(r) {
    setOpen(false);
    setQ("");
    if (r.kind === "lead") onOpenLead(r.item);
    else onOpenPartner(r.item);
  }

  return (
    <div ref={ref} style={{ position: "relative", flex: "1 1 420px", maxWidth: 560, minWidth: 0 }}>
      <div className="msk-search" style={{ display: "flex", alignItems: "center", gap: 9, height: 40, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 12px", color: C.textSubtle }}>
        <Icon name="search" size={16} />
        <input
          className="msk-bare"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            if (e.key === "Enter" && results[active]) pick(results[active]);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Zoek op naam, e-mail, telefoon, plaats, partner…"
          aria-label="Universeel zoeken"
          role="combobox"
          aria-controls="msk-global-search-results"
          aria-expanded={open && results.length > 0}
          style={{ border: "none", outline: "none", background: "transparent", fontSize: 13.5, flex: 1, minWidth: 0, color: C.text, fontFamily: "inherit", height: "100%" }}
        />
      </div>
      {open && q.trim() && (
        <div id="msk-global-search-results" role="listbox" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 300, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadowMd, padding: 6 }}>
          {results.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 13, color: C.textMuted }}>Geen resultaten voor "{q}".</div>
          ) : (
            results.map((r, i) => {
              const stage = r.kind === "lead" ? optionOf(PIPELINE_STAGES, r.item.pipelineStage) : null;
              return (
                <button
                  key={`${r.kind}-${r.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(r)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none", background: i === active ? C.surfaceSoft : "transparent", borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontFamily: "inherit" }}
                >
                  <span style={{ color: C.textSubtle, display: "flex" }}>
                    <Icon name={r.kind === "lead" ? "user" : "briefcase"} size={15} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: C.text }}>{r.item.name || "Naam onbekend"}</span>
                    <span style={{ display: "block", fontSize: 12, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.kind === "lead" ? [r.item.phone, r.item.email, (r.item.places || [])[0]].filter(Boolean).join(" · ") : `Partner · ${labelOf(PARTNER_TYPES, r.item.type)}`}
                    </span>
                  </span>
                  {stage && (
                    <Badge color={stage.color} bg={stage.bg}>
                      {stage.label}
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── NOTIFICATIES ────────────────────────────────────────────────────────────
const SEV = {
  high: { color: C.danger, icon: "alertCircle" },
  warn: { color: C.goldText, icon: "alertCircle" },
  info: { color: C.info, icon: "bell" },
};

export function NotificationBell({ notifications, readIds, markRead, markAllRead, onOpen }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = notifications.filter((n) => !readIds.includes(n.id));
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificaties${unread.length ? ` (${unread.length} ongelezen)` : ""}`}
        title="Notificaties"
        aria-expanded={open}
        style={{ ...btnStyle("neutral"), width: 40, minHeight: 40, padding: 0, position: "relative" }}
      >
        <Icon name="bell" size={18} />
        {unread.length > 0 && (
          <span style={{ position: "absolute", top: -5, right: -5, background: C.danger, color: "#fff", borderRadius: 999, fontSize: 10.5, fontWeight: 700, padding: "1px 5px", minWidth: 18, textAlign: "center", border: "2px solid #fff" }}>
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notificaties" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 300, width: 380, maxWidth: "90vw", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadowMd, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${C.borderSoft}` }}>
            <strong style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>Notificaties</strong>
            {unread.length > 0 && (
              <button type="button" onClick={markAllRead} className="msk-link" style={{ border: "none", background: "none", color: C.goldText, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Alles als gelezen markeren
              </button>
            )}
          </div>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "16px 14px", fontSize: 13, color: C.textMuted, display: "flex", gap: 8, alignItems: "center" }}>
                <Icon name="checkCircle" size={15} /> Geen meldingen.
              </div>
            ) : (
              notifications.slice(0, 40).map((n) => {
                const s = SEV[n.severity] || SEV.info;
                const isUnread = !readIds.includes(n.id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    className="msk-row"
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                      onOpen(n);
                    }}
                    style={{ display: "flex", gap: 10, width: "100%", textAlign: "left", border: "none", borderBottom: `1px solid ${C.borderSoft}`, background: isUnread ? C.surfaceWarm : C.surface, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <span style={{ color: s.color, display: "flex", marginTop: 2 }}>
                      <Icon name={s.icon} size={15} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: isUnread ? 600 : 500, color: C.text }}>{n.title}</span>
                      <span style={{ display: "block", fontSize: 12, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.text}</span>
                    </span>
                    {isUnread && <span aria-label="ongelezen" style={{ width: 8, height: 8, borderRadius: 99, background: C.gold, marginTop: 6, flexShrink: 0 }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TOPBALK ─────────────────────────────────────────────────────────────────
export function Topbar({ user, onSignOut, search, bell }) {
  const initials = (user.displayName || user.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 100, background: C.surfaceWarm, borderBottom: `1px solid ${C.border}` }}>
      <div className="msk-header-inner" style={{ height: 64, display: "flex", alignItems: "center", gap: 14, maxWidth: 1400, margin: "0 auto" }}>
        {search}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          {bell}
          <div title={user.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 12px 4px 4px", border: `1px solid ${C.border}`, borderRadius: 999, background: C.surface }}>
            <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 99, background: C.gold, color: C.navyDark, fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {initials}
            </span>
            <span className="msk-hide-sm" style={{ lineHeight: 1.2 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text }}>{user.displayName}</span>
              <span style={{ display: "block", fontSize: 11, color: C.textMuted }}>{user.isAdmin ? "Beheerder" : "Medewerker"}</span>
            </span>
          </div>
          <button type="button" onClick={onSignOut} title="Uitloggen" aria-label="Uitloggen" style={{ ...btnStyle("neutral"), minHeight: 40 }}>
            <Icon name="logout" size={15} />
            <span className="msk-hide-sm">Uitloggen</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/** Standaard paginakop. */
export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 6, textTransform: "capitalize" }}>{eyebrow}</div>}
        <h1 className="msk-page-title" style={{ fontFamily: C.fontDisplay, fontSize: 30, fontWeight: 600, color: C.navy, margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}>
          {title}
        </h1>
        {subtitle && <div style={{ fontSize: 14, color: C.textMuted, marginTop: 6 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}
