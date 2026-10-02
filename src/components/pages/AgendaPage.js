import { useMemo, useState } from "react";
import { buildAgendaItems, itemsInRange, overdueItems, filterAgenda, agendaTypeMeta, AGENDA_TYPES } from "../../crm/agenda";
import { todayISO, addDaysISO, formatDate, formatMonth } from "../../crm/dates";
import { Card, Icon, btnStyle, selectStyle, C } from "../ui";
import { PageHeader } from "../shell/AppShell";

const VIEWS = [
  { value: "today", label: "Vandaag" },
  { value: "week", label: "Week" },
  { value: "month", label: "Maand" },
];
const DAY_NAMES = ["ma", "di", "wo", "do", "vr", "za", "zo"];

function mondayOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = (date.getDay() + 6) % 7;
  return addDaysISO(iso, -day);
}

function monthGrid(iso) {
  const first = `${iso.slice(0, 7)}-01`;
  const start = mondayOf(first);
  return Array.from({ length: 42 }, (_, i) => addDaysISO(start, i));
}

const TYPE_TONE = {
  meeting: { color: C.info, bg: C.infoBg },
  followup: { color: C.goldText, bg: C.goldSoft },
  task: { color: C.navy, bg: C.navySoft },
  partner: { color: "#85663a", bg: "#f4ede2" },
};

function ItemRow({ it, onOpen, late, compact }) {
  const meta = agendaTypeMeta(it.type);
  const tone = TYPE_TONE[it.type];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="msk-list-btn"
      style={{
        display: "flex",
        gap: 9,
        width: "100%",
        textAlign: "left",
        background: C.surface,
        border: `1px solid ${late ? C.dangerBorder : C.borderSoft}`,
        borderLeft: `3px solid ${late ? C.danger : tone.color}`,
        borderRadius: 10,
        padding: compact ? "6px 8px" : "8px 10px",
        cursor: "pointer",
        fontFamily: "inherit",
        opacity: it.done ? 0.6 : 1,
        minWidth: 0,
        overflow: "hidden",
      }}
      title={`${meta.label}: ${it.leadName || ""} · ${it.title}`}
    >
      <span style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
        <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: late ? C.danger : C.textMuted, whiteSpace: "nowrap", overflow: "hidden" }}>
          <Icon name={meta.icon} size={11} />
          {compact ? (
            it.time && <span style={{ fontWeight: 600 }}>{it.time}</span>
          ) : (
            <>
              <span style={{ fontWeight: 600 }}>{late ? formatDate(it.date) : it.monthOnly ? "Deze maand" : it.time ? `${it.time}${it.endTime ? `–${it.endTime}` : ""}` : "Hele dag"}</span>
              <span>{meta.label}</span>
            </>
          )}
        </span>
        <span style={{ display: "block", fontSize: compact ? 12.5 : 13.5, fontWeight: 600, color: C.text, lineHeight: 1.3, ...(compact ? { overflowWrap: "anywhere" } : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) }}>{it.leadName || "Lead"}</span>
        {!compact && (
          <span style={{ display: "block", fontSize: 12.5, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {it.title}
            {it.ownerName ? ` · ${it.ownerName}` : ""}
            {it.done ? ` · ${it.status === "completed" ? "afgerond" : it.status === "no_show" ? "niet verschenen" : "klaar"}` : ""}
          </span>
        )}
      </span>
    </button>
  );
}

/** Pick-a-lead dialoog voor "+ Afspraak" / "+ Taak". */
function LeadPicker({ leads, title, onPick, onClose }) {
  const [q, setQ] = useState("");
  const list = leads.filter((l) => !l.archived && `${l.name} ${l.email} ${l.phone}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 60, width: 340, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadowMd, padding: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>{title}: kies een lead</div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek lead..." aria-label="Zoek lead" style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit" }} onKeyDown={(e) => e.key === "Escape" && onClose()} />
      <div style={{ marginTop: 6, maxHeight: 260, overflowY: "auto" }}>
        {list.map((l) => (
          <button key={l.id} type="button" className="msk-list-btn" onClick={() => onPick(l)} style={{ display: "block", width: "100%", textAlign: "left", border: "1px solid transparent", background: "none", borderRadius: 8, padding: "7px 8px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: C.text }}>
            {l.name || "Naam onbekend"}
            <span style={{ color: C.textSubtle, fontSize: 12 }}> {l.phone || l.email}</span>
          </button>
        ))}
        {!list.length && <div style={{ fontSize: 12.5, color: C.textMuted, padding: 8 }}>Geen leads gevonden.</div>}
      </div>
    </div>
  );
}

/**
 * Agenda: gesprekken, follow-ups, taken en partneropvolgingen uit de CRM-data.
 * Standaard weekweergave. "Vandaag" en verlopen items zijn altijd rechts zichtbaar.
 */
export function AgendaPage({ leads, tasks, links, users, now, initialView, onOpenLead }) {
  const today = todayISO(now);
  const [view, setView] = useState(initialView === "today" ? "today" : "week");
  const [anchor, setAnchor] = useState(today);
  const [type, setType] = useState("all");
  const [ownerId, setOwnerId] = useState("");
  const [picker, setPicker] = useState(null);
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const all = useMemo(() => filterAgenda(buildAgendaItems({ leads, tasks, links }), { type, ownerId }), [leads, tasks, links, type, ownerId]);
  const overdue = useMemo(() => overdueItems(all, today), [all, today]);
  const todays = useMemo(() => itemsInRange(all, today, today).filter((it) => !it.monthOnly), [all, today]);

  const open = (it) => onOpenLead(byId.get(it.leadId), it.tab);
  const range =
    view === "today"
      ? { from: anchor, to: anchor, label: formatDate(anchor) }
      : view === "week"
      ? { from: mondayOf(anchor), to: addDaysISO(mondayOf(anchor), 6), label: `${formatDate(mondayOf(anchor))} – ${formatDate(addDaysISO(mondayOf(anchor), 6))}` }
      : { from: monthGrid(anchor)[0], to: monthGrid(anchor)[41], label: formatMonth(anchor) };
  const inView = itemsInRange(all, range.from, range.to);
  const step = (dir) => setAnchor((a) => (view === "today" ? addDaysISO(a, dir) : view === "week" ? addDaysISO(a, dir * 7) : `${addDaysISO(`${a.slice(0, 7)}-15`, dir * 30).slice(0, 7)}-01`));
  const countBy = (list, t) => list.filter((it) => it.type === t).length;

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Gesprekken, follow-ups, taken en partneropvolgingen op één plek."
        actions={["Afspraak", "Taak"].map((label) => (
          <div key={label} style={{ position: "relative" }}>
            <button type="button" onClick={() => setPicker(picker === label ? null : label)} style={{ ...btnStyle(label === "Afspraak" ? "primary" : "primary", label === "Afspraak"), minHeight: 40, padding: "9px 16px", fontSize: 13 }}>
              <Icon name="plus" size={15} /> {label}
            </button>
            {picker === label && (
              <LeadPicker
                leads={leads}
                title={label === "Afspraak" ? "Afspraak plannen" : "Taak toevoegen"}
                onClose={() => setPicker(null)}
                onPick={(l) => {
                  setPicker(null);
                  onOpenLead(l, "followup");
                }}
              />
            )}
          </div>
        ))}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div role="group" aria-label="Weergave" style={{ display: "flex", background: C.surfaceSunken, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: 3, gap: 2 }}>
          {VIEWS.map((v) => (
            <button key={v.value} type="button" aria-pressed={view === v.value} onClick={() => { setView(v.value); setAnchor(today); }} style={{ border: "none", padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: view === v.value ? 600 : 500, cursor: "pointer", fontFamily: "inherit", background: view === v.value ? C.surface : "transparent", color: view === v.value ? C.navy : C.textMuted }}>
              {v.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button type="button" aria-label="Vorige" onClick={() => step(-1)} style={{ ...btnStyle("neutral"), width: 34, padding: 0 }}>
            <Icon name="chevronLeft" size={15} />
          </button>
          <button type="button" onClick={() => setAnchor(today)} style={btnStyle("neutral")}>
            Vandaag
          </button>
          <button type="button" aria-label="Volgende" onClick={() => step(1)} style={{ ...btnStyle("neutral"), width: 34, padding: 0 }}>
            <Icon name="chevronRight" size={15} />
          </button>
          <strong style={{ fontSize: 14, color: C.text, marginLeft: 8, fontWeight: 600, textTransform: "capitalize" }}>{range.label}</strong>
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
          <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle} aria-label="Soort">
            {AGENDA_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={selectStyle} aria-label="Verantwoordelijke">
            <option value="">Iedereen</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: view === "today" ? "1fr" : "minmax(0, 1fr) 300px", gap: 16, alignItems: "start" }} className="msk-agenda-grid">
        <div>
          {view === "today" && (
            <Card icon="calendar" title={`${formatDate(anchor)} (${inView.length})`}>
              {anchor === today && overdue.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.danger, marginBottom: 6 }}>Verlopen ({overdue.length})</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {overdue.map((it) => (
                      <ItemRow key={it.id} it={it} late onOpen={() => open(it)} />
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gap: 6 }}>
                {inView.map((it) => (
                  <ItemRow key={it.id} it={it} onOpen={() => open(it)} />
                ))}
                {!inView.length && <div style={{ fontSize: 13, color: C.textMuted }}>Geen afspraken of acties op deze dag.</div>}
              </div>
            </Card>
          )}

          {view === "week" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }} className="msk-week">
              {Array.from({ length: 7 }, (_, i) => addDaysISO(range.from, i)).map((day, i) => {
                const list = inView.filter((it) => !it.monthOnly && it.date === day);
                const isToday = day === today;
                return (
                  <div key={day} style={{ background: isToday ? C.surfaceWarm : C.surface, border: `1px solid ${isToday ? C.goldBorder : C.border}`, borderRadius: 12, padding: 8, minHeight: 160, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? C.goldText : C.textMuted, marginBottom: 6, textTransform: "capitalize" }}>
                      {DAY_NAMES[i]} {Number(day.slice(8))}
                    </div>
                    <div style={{ display: "grid", gap: 5 }}>
                      {list.map((it) => (
                        <ItemRow key={it.id} it={it} compact onOpen={() => open(it)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === "month" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginBottom: 4 }}>
                {DAY_NAMES.map((d) => (
                  <div key={d} style={{ fontSize: 11.5, color: C.textSubtle, fontWeight: 600, padding: "0 6px", textTransform: "capitalize" }}>
                    {d}
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
                {monthGrid(anchor).map((day) => {
                  const list = inView.filter((it) => !it.monthOnly && it.date === day);
                  const inMonth = day.slice(0, 7) === anchor.slice(0, 7);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setView("today");
                        setAnchor(day);
                      }}
                      style={{ textAlign: "left", background: day === today ? C.surfaceWarm : C.surface, border: `1px solid ${day === today ? C.goldBorder : C.borderSoft}`, borderRadius: 8, padding: 6, minHeight: 78, opacity: inMonth ? 1 : 0.45, cursor: "pointer", fontFamily: "inherit", minWidth: 0 }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{Number(day.slice(8))}</div>
                      {list.slice(0, 2).map((it) => (
                        <div key={it.id} style={{ fontSize: 11, color: TYPE_TONE[it.type].color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.time ? `${it.time} ` : ""}
                          {it.leadName}
                        </div>
                      ))}
                      {list.length > 2 && <div style={{ fontSize: 11, color: C.textSubtle }}>+{list.length - 2} meer</div>}
                    </button>
                  );
                })}
              </div>
              {inView.some((it) => it.monthOnly) && (
                <Card title="Ergens deze maand" style={{ marginTop: 12 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    {inView
                      .filter((it) => it.monthOnly)
                      .map((it) => (
                        <ItemRow key={it.id} it={it} onOpen={() => open(it)} />
                      ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>

        {view !== "today" && (
          <aside style={{ display: "grid", gap: 12 }}>
            <Card icon="calendar" title="Vandaag">
              <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 8 }}>
                {countBy(todays, "meeting")} gesprekken · {countBy(todays, "task")} taken · {countBy(todays, "followup") + countBy(todays, "partner")} follow-ups
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {todays.map((it) => (
                  <ItemRow key={it.id} it={it} onOpen={() => open(it)} />
                ))}
                {!todays.length && <div style={{ fontSize: 13, color: C.textMuted }}>Niets gepland voor vandaag.</div>}
              </div>
            </Card>
            {overdue.length > 0 && (
              <Card icon="alertCircle" title={`Verlopen (${overdue.length})`} style={{ borderColor: C.dangerBorder }}>
                <div style={{ display: "grid", gap: 6 }}>
                  {overdue.slice(0, 10).map((it) => (
                    <ItemRow key={it.id} it={it} late onOpen={() => open(it)} />
                  ))}
                </div>
              </Card>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
