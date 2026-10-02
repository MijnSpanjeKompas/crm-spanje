import { useState } from "react";
import {
  REGIONS,
  PLACE_SUGGESTIONS,
  PROPERTY_TYPES,
  BUILD_PREFERENCES,
  PURCHASE_GOALS,
  PURCHASE_TIMELINES,
  FINANCING_TYPES,
  HOUSING_SITUATIONS,
  RENTAL_INTEREST,
  REQUIREMENTS,
  VISIT_SPAIN_STATUSES,
} from "../../crm/constants";
import { getMissingProfileFields } from "../../crm/signals";
import { Card, NumberField, ChipMultiSelect, TagInput, SelectField, TextField, TextAreaField, Notice, Icon, btnStyle, C } from "../ui";

const LEGACY_LABELS = {
  budget: "Budget",
  gewensteRegio: "Regio",
  woningtype: "Woningtype",
  bouwtype: "Nieuwbouw of bestaande bouw",
  slaapkamers: "Slaapkamers",
  doelAankoop: "Doel van aankoop",
  verhuurinteresse: "Verhuur",
  tijdshorizon: "Tijdlijn",
};

const grid = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 });

/** Eigen inbreng is vooral relevant bij (deels) hypotheek. */
function showEquity(form) {
  return ["mortgage", "combination"].includes(form.financingType) || (form.availableEquity !== null && form.availableEquity !== undefined);
}

export function ProfileTab({ form, set, errors, compact = false }) {
  const missing = getMissingProfileFields(form);
  const legacy = form._legacy?.unmapped || {};
  const legacyEntries = Object.entries(legacy).filter(([k]) => LEGACY_LABELS[k]);
  const [showSituation, setShowSituation] = useState(Boolean(form.currentHousingSituation));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!compact && missing.length > 0 && (
        <div style={{ fontSize: 12.5, color: C.textMuted, display: "flex", gap: 7, alignItems: "center" }}>
          <Icon name="info" size={14} /> Nog niet ingevuld: {missing.join(", ")}.
        </div>
      )}

      {legacyEntries.length > 0 && (
        <Notice tone="info">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Oude invoer die niet automatisch kon worden omgezet:</div>
          {legacyEntries.map(([k, v]) => (
            <div key={k}>
              {LEGACY_LABELS[k]}: <strong>{v}</strong>
            </div>
          ))}
        </Notice>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", gap: 16, alignItems: "start" }}>
        {/* 1. AANKOOP */}
        <Card icon="flag" title="Aankoop">
          <div style={grid(170)}>
            <SelectField label="Aankoopdoel" value={form.purchaseGoal} onChange={(v) => set("purchaseGoal", v)} options={PURCHASE_GOALS} />
            <SelectField label="Aankooptermijn" value={form.purchaseTimeline} onChange={(v) => set("purchaseTimeline", v)} options={PURCHASE_TIMELINES} />
            <SelectField label="Interesse in verhuur" value={form.rentalInterest} onChange={(v) => set("rentalInterest", v)} options={RENTAL_INTEREST} />
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.borderSoft}` }}>
            <div style={grid(170)}>
              <SelectField
                label="Bezoek Spanje"
                value={form.visitSpainStatus}
                onChange={(v) => set("visitSpainStatus", v)}
                options={VISIT_SPAIN_STATUSES}
                placeholder="Nog niet bekend"
              />
              {form.visitSpainStatus === "date_known" && (
                <TextField label="Verwachte datum" type="date" value={form.visitSpainDate} onChange={(v) => set("visitSpainDate", v)} />
              )}
              <div style={{ gridColumn: "1 / -1" }}>
                <TextField label="Toelichting" value={form.visitSpainNotes} onChange={(v) => set("visitSpainNotes", v)} placeholder="Bijv. eind oktober, exacte week nog onbekend" />
              </div>
            </div>
            {form.visitSpainDate && form.visitSpainStatus !== "date_known" && (
              <div style={{ fontSize: 11.5, color: C.textSubtle, marginTop: 6 }}>Eerder ingevulde datum (bewaard): {form.visitSpainDate}</div>
            )}
          </div>
        </Card>

        {/* 2. BUDGET & FINANCIERING */}
        <Card icon="chart" title="Budget & financiering">
          <div style={grid(150)}>
            <NumberField label="Budget minimaal (€)" value={form.budgetMin} onChange={(v) => set("budgetMin", v)} step={5000} placeholder="Bijv. 200000" />
            <NumberField label="Budget maximaal (€)" value={form.budgetMax} onChange={(v) => set("budgetMax", v)} step={5000} error={errors.budgetMax} placeholder="Bijv. 300000" />
            <SelectField label="Financiering" value={form.financingType} onChange={(v) => set("financingType", v)} options={FINANCING_TYPES} />
            {showEquity(form) && <NumberField label="Eigen inbreng (€)" value={form.availableEquity} onChange={(v) => set("availableEquity", v)} step={5000} placeholder="Optioneel" />}
          </div>
          <div style={{ marginTop: 12 }}>
            {showSituation ? (
              <SelectField label="Aanvullende situatie" value={form.currentHousingSituation} onChange={(v) => set("currentHousingSituation", v)} options={HOUSING_SITUATIONS} hint="Bijv. of de Nederlandse woning eerst verkocht moet worden." />
            ) : (
              <button type="button" onClick={() => setShowSituation(true)} style={{ ...btnStyle("neutral"), minHeight: 30, padding: "4px 10px", fontSize: 12 }}>
                <Icon name="plus" size={12} /> Aanvullende situatie
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* 3. LOCATIE */}
      <Card icon="map" title="Locatie">
        <div style={{ display: "grid", gap: 14 }}>
          <ChipMultiSelect label="Regio's" options={REGIONS} value={form.regions} onChange={(v) => set("regions", v)} />
          <TagInput label="Plaatsen" value={form.places} onChange={(v) => set("places", v)} suggestions={PLACE_SUGGESTIONS} placeholder="Typ een plaats en druk op Enter" />
        </div>
      </Card>

      {/* 4. WONING */}
      <Card icon="home" title="Woning">
        <div style={{ display: "grid", gap: 14 }}>
          <ChipMultiSelect label="Woningtype(s)" options={PROPERTY_TYPES} value={form.propertyTypes} onChange={(v) => set("propertyTypes", v)} />
          <div style={grid(170)}>
            <SelectField label="Nieuwbouw of bestaande bouw" value={form.buildPreference} onChange={(v) => set("buildPreference", v)} options={BUILD_PREFERENCES} />
            <NumberField label="Min. slaapkamers" value={form.bedroomsMin} onChange={(v) => set("bedroomsMin", v)} />
            <NumberField label="Min. badkamers" value={form.bathroomsMin} onChange={(v) => set("bathroomsMin", v)} />
          </div>
        </div>
      </Card>

      {/* 5. WENSEN */}
      <Card icon="checkCircle" title="Wensen">
        <div style={{ display: "grid", gap: 14 }}>
          <ChipMultiSelect options={REQUIREMENTS} value={form.requirements} onChange={(v) => set("requirements", v)} />
          <TextAreaField label="Extra wensen" value={form.extraRequirements} onChange={(v) => set("extraRequirements", v)} rows={2} placeholder="Bijv. rustige omgeving, geen hoogbouw, goede internetverbinding" />
        </div>
      </Card>
    </div>
  );
}
