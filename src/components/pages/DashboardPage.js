import { useMemo } from "react";
import { PIPELINE_STAGES, REGIONS, PURCHASE_TIMELINES, LEAD_SOURCES, ACTIVITY_TYPES, STAGES_REQUIRING_NEXT_ACTION, hasNextAction, isClosedStage, labelOf } from "../../crm/constants";
import { buildAgendaItems, itemsInRange, overdueItems, agendaTypeMeta } from "../../crm/agenda";
import { getCreatedDate } from "../../crm/normalize";
import { todayISO, formatDate, formatRelative, toMillis } from "../../crm/dates";
import { Card, Icon, OptionBadge, ActionLink, contactLinks, btnStyle, formatBudget, C } from "../ui";
import { PageHeader } from "../shell/AppShell";

function greeting(now) {
  const h = now.getHours();
  return h < 12 ? "Goedemorgen" : h < 18 ? "Goedemiddag" : "Goedenavond";
}

function StatCard({ label, value, hint, icon, tone = "neutral", onClick }) {
  const tones = {
    neutral: { color: C.navy, bg: C.navySoft },
    gold: { color: C.goldText, bg: C.goldSoft },
    danger: { color: C.danger, bg: C.dangerBg },
    info: { color: C.info, bg: C.infoBg },
    success: { color: C.success, bg: C.successBg },
  };
  const t = tones[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="msk-kpi"
      style={{ background: C.surface, borderRadius: 16, padding: "14px 16px", border: `1px solid ${C.border}`, boxShadow: C.shadowSm, textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}
    >
      <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 10, background: t.bg, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={icon} size={17} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{label}</span>
        <span style={{ display: "block", fontFamily: C.fontDisplay, fontSize: 28, fontWeight: 600, color: tone === "danger" && value > 0 ? C.danger : C.navy, lineHeight: 1.1, margin: "2px 0" }}>{value}</span>
        <span style={{ display: "block", fontSize: 11.5, color: C.textSubtle }}>{hint}</span>
      </span>
    </button>
  );
}

function AgendaRow({ it, onOpen, late }) {
  const meta = agendaTypeMeta(it.type);
  return (
    <button type="button" className="msk-row" onClick={onOpen} style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 12, alignItems: "center", width: "100%", textAlign: "left", border: "none", borderBottom: `1px solid ${C.borderSoft}`, background: "none", padding: "9px 6px", cursor: "pointer", fontFamily: "inherit" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: late ? C.danger : C.navy }}>{late ? formatDate(it.date).slice(0, 6) : it.time || "Vandaag"}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: C.text }}>{it.leadName || "Lead"}</span>
        <span style={{ display: "block", fontSize: 12.5, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {it.title}
          {it.ownerName ? ` · ${it.ownerName}` : ""}
        </span>
      </span>
      <span style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 11.5, color: C.textSubtle }}>
        <Icon name={meta.icon} size={13} /> {meta.label}
      </span>
    </button>
  );
}

/**
 * Operationeel overzicht: wat moet er vandaag gebeuren?
 * Alle cijfers komen uit dezelfde agenda-/signaalfuncties als de rest van het CRM.
 */
export function DashboardPage({ user, leads, tasks, links, now, onOpenLead, onNewLead, onImport, navigate, setLeadFilter }) {
  const today = todayISO(now);
  const live = useMemo(() => leads.filter((l) => !l.archived), [leads]);
  const items = useMemo(() => buildAgendaItems({ leads: live, tasks, links }), [live, tasks, links]);
  const todayItems = useMemo(() => itemsInRange(items, today, today).filter((it) => !it.monthOnly && !it.done), [items, today]);
  const overdue = useMemo(() => overdueItems(items, today), [items, today]);
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const newLeads = live.filter((l) => l.pipelineStage === "new_lead" && !l.lastContactAt);
  const meetingsToday = todayItems.filter((it) => it.type === "meeting");
  const forwarded = live.filter((l) => l.pipelineStage === "partner_connected");
  const noAction = live.filter((l) => STAGES_REQUIRING_NEXT_ACTION.includes(l.pipelineStage) && !isClosedStage(l.pipelineStage) && !hasNextAction(l));

  const attention = [
    ...newLeads.slice(0, 5).map((l) => ({ key: `new-${l.id}`, lead: l, text: "Nieuwe lead, nog geen eerste contact", tab: "overview", tone: C.goldText })),
    ...overdue.slice(0, 8).map((it) => ({ key: it.id, lead: byId.get(it.leadId), text: `${agendaTypeMeta(it.type).label} verlopen: ${it.title} (${formatDate(it.date)})`, tab: it.tab, tone: C.danger })),
    ...noAction.slice(0, 5).map((l) => ({ key: `na-${l.id}`, lead: l, text: "Geen volgende actie gepland", tab: "followup", tone: C.textMuted })),
  ].filter((a) => a.lead);

  const recentLeads = [...live].sort((a, b) => (toMillis(getCreatedDate(b)) || 0) - (toMillis(getCreatedDate(a)) || 0)).slice(0, 5);
  const recentActivity = [...live]
    .filter((l) => l.lastActivityAt)
    .sort((a, b) => (toMillis(b.lastActivityAt) || 0) - (toMillis(a.lastActivityAt) || 0))
    .slice(0, 5);

  const allClear = todayItems.length === 0 && overdue.length === 0;
  const firstName = String(user.displayName || "").split(" ")[0];

  return (
    <div>
      <PageHeader
        eyebrow={now.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        title={`${greeting(now)}${firstName ? ` ${firstName}` : ""}`}
        subtitle={allClear ? "Alles is bijgewerkt." : "Dit vraagt vandaag je aandacht."}
        actions={
          <>
            <button type="button" onClick={onImport} style={{ ...btnStyle("primary"), minHeight: 40, padding: "9px 15px", fontSize: 13 }}>
              <Icon name="upload" size={15} /> Importeren
            </button>
            <button type="button" onClick={onNewLead} style={{ ...btnStyle("primary", true), minHeight: 40, padding: "9px 18px", fontSize: 13 }}>
              <Icon name="plus" size={15} /> Nieuwe lead
            </button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 44vw), 1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Nieuwe leads" value={newLeads.length} hint="Nog niet opgevolgd" icon="userPlus" tone="gold" onClick={() => setLeadFilter({ quick: "new" })} />
        <StatCard label="Vandaag opvolgen" value={todayItems.length} hint="Acties, taken en afspraken" icon="bell" tone="info" onClick={() => navigate("agenda", "today")} />
        <StatCard label="Achterstallig" value={overdue.length} hint={overdue.length ? "Direct aandacht nodig" : "Niets verlopen"} icon="alertCircle" tone={overdue.length ? "danger" : "success"} onClick={() => navigate("agenda", "today")} />
        <StatCard label="Gesprekken vandaag" value={meetingsToday.length} hint="Ingepland voor vandaag" icon="calendar" tone="neutral" onClick={() => navigate("agenda", "today")} />
        <StatCard label="Doorgestuurd" value={forwarded.length} hint="Actief bij partners" icon="briefcase" tone="neutral" onClick={() => setLeadFilter({ stage: "partner_connected" })} />
      </div>

      {allClear ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: C.successBg, border: `1px solid ${C.successBorder}`, color: C.success, borderRadius: 14, padding: "12px 16px", fontSize: 13.5, marginBottom: 20 }}>
          <Icon name="checkCircle" size={18} />
          <strong style={{ fontWeight: 600 }}>Alles bijgewerkt</strong>
          <span style={{ color: C.textBody }}>Geen acties voor vandaag en niets achterstallig.</span>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", gap: 16, marginBottom: 20, alignItems: "start" }}>
          <Card icon="calendar" title={`Vandaag (${todayItems.length})`} right={<button type="button" onClick={() => navigate("agenda", "today")} className="msk-link" style={{ border: "none", background: "none", color: C.goldText, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Agenda openen</button>}>
            {todayItems.length ? todayItems.slice(0, 8).map((it) => <AgendaRow key={it.id} it={it} onOpen={() => onOpenLead(byId.get(it.leadId), it.tab)} />) : <div style={{ fontSize: 13, color: C.textMuted }}>Niets gepland voor vandaag.</div>}
          </Card>
          <Card icon="alertCircle" title={`Aandacht nodig (${attention.length})`} style={attention.length ? { background: C.goldSoft, borderColor: C.goldBorder } : undefined}>
            {attention.length ? (
              attention.slice(0, 8).map((a) => (
                <button key={a.key} type="button" className="msk-row" onClick={() => onOpenLead(a.lead, a.tab)} style={{ display: "block", width: "100%", textAlign: "left", border: "none", borderBottom: `1px solid ${C.borderSoft}`, background: "none", padding: "8px 6px", cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: C.text }}>{a.lead.name || "Naam onbekend"}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: a.tone }}>{a.text}</span>
                </button>
              ))
            ) : (
              <div style={{ fontSize: 13, color: C.textMuted }}>Niets achterstallig.</div>
            )}
          </Card>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 16, alignItems: "start" }} className="msk-dash-bottom">
        <Card icon="users" title="Recent binnengekomen" right={<button type="button" onClick={() => navigate("leads")} className="msk-link" style={{ border: "none", background: "none", color: C.goldText, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Alle leads</button>} bodyStyle={{ padding: "4px 18px 10px" }}>
          {recentLeads.length === 0 && <div style={{ fontSize: 13, color: C.textMuted, padding: "10px 0" }}>Nog geen leads.</div>}
          {recentLeads.map((l) => {
            const links2 = contactLinks(l);
            const where = (l.regions || []).filter((r) => r !== "unknown").map((r) => labelOf(REGIONS, r))[0] || (l.places || [])[0] || "Regio onbekend";
            return (
              <div key={l.id} className="msk-row" style={{ display: "grid", gridTemplateColumns: "minmax(150px, 1.2fr) minmax(170px, 1.6fr) 130px 112px", gap: 12, alignItems: "center", padding: "10px 6px", borderBottom: `1px solid ${C.borderSoft}` }}>
                <button type="button" onClick={() => onOpenLead(l)} style={{ border: "none", background: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: C.text }}>{l.name || "Naam onbekend"}</span>
                  <span style={{ display: "block", fontSize: 12, color: C.textMuted }}>
                    {labelOf(LEAD_SOURCES, l.leadSource)} · {formatRelative(getCreatedDate(l))}
                  </span>
                </button>
                <span style={{ fontSize: 12.5, color: C.textBody, minWidth: 0 }}>
                  {where}
                  <span style={{ display: "block", color: C.textMuted }}>
                    {[formatBudget(l), l.purchaseTimeline ? labelOf(PURCHASE_TIMELINES, l.purchaseTimeline) : ""].filter(Boolean).join(" · ") || "–"}
                  </span>
                </span>
                <span>
                  <OptionBadge options={PIPELINE_STAGES} value={l.pipelineStage} />
                </span>
                <span style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  {links2.tel && <ActionLink compact href={links2.tel} icon="phone" label="Bellen" />}
                  {links2.whatsapp && <ActionLink compact href={links2.whatsapp} icon="chat" label="WhatsApp" />}
                  {links2.mail && <ActionLink compact href={links2.mail} icon="mail" label="E-mail" />}
                </span>
              </div>
            );
          })}
        </Card>
        <Card icon="clock" title="Recente activiteit" bodyStyle={{ padding: "4px 18px 10px" }}>
          {recentActivity.length === 0 && <div style={{ fontSize: 13, color: C.textMuted, padding: "10px 0" }}>Nog geen activiteit.</div>}
          {recentActivity.map((l) => (
            <button key={l.id} type="button" className="msk-row" onClick={() => onOpenLead(l, "timeline")} style={{ display: "block", width: "100%", textAlign: "left", border: "none", borderBottom: `1px solid ${C.borderSoft}`, background: "none", padding: "9px 6px", cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text }}>{l.name || "Naam onbekend"}</span>
              <span style={{ display: "block", fontSize: 12, color: C.textMuted }}>
                {l.lastActivityType ? labelOf(ACTIVITY_TYPES, l.lastActivityType) : "Laatste activiteit"} · {formatRelative(l.lastActivityAt)}
              </span>
            </button>
          ))}
        </Card>
      </div>
    </div>
  );
}
