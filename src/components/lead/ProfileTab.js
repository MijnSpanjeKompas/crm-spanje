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
} from "../../crm/constants";
import { getMissingProfileFields } from "../../crm/signals";
import { Panel, NumberField, ChipMultiSelect, TagInput, SelectField, TextField, TextAreaField, Notice } from "../ui";

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

export function ProfileTab({ form, set, errors }) {
  const missing = getMissingProfileFields(form);
  const legacy = form._legacy?.unmapped || {};
  const legacyEntries = Object.entries(legacy).filter(([k]) => LEGACY_LABELS[k]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {missing.length > 0 && <Notice tone="warn">Nog niet ingevuld: {missing.join(", ")}.</Notice>}

      {legacyEntries.length > 0 && (
        <Notice tone="info">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Oude invoer die niet automatisch kon worden omgezet:</div>
          {legacyEntries.map(([k, v]) => (
            <div key={k}>
              {LEGACY_LABELS[k]}: <strong>{v}</strong>
            </div>
          ))}
        </Notice>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        <Panel title="Budget en financiering">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <NumberField label="Budget minimaal (€)" value={form.budgetMin} onChange={(v) => set("budgetMin", v)} step={5000} />
            <NumberField label="Budget maximaal (€)" value={form.budgetMax} onChange={(v) => set("budgetMax", v)} step={5000} error={errors.budgetMax} />
            <SelectField label="Financiering" value={form.financingType} onChange={(v) => set("financingType", v)} options={FINANCING_TYPES} />
            <NumberField label="Eigen inbreng (€, optioneel)" value={form.availableEquity} onChange={(v) => set("availableEquity", v)} step={5000} />
            <div style={{ gridColumn: "1 / -1" }}>
              <SelectField label="Huidige woonsituatie" value={form.currentHousingSituation} onChange={(v) => set("currentHousingSituation", v)} options={HOUSING_SITUATIONS} />
            </div>
          </div>
        </Panel>

        <Panel title="Aankoop">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <SelectField label="Aankoopdoel" value={form.purchaseGoal} onChange={(v) => set("purchaseGoal", v)} options={PURCHASE_GOALS} />
            <SelectField label="Aankooptermijn" value={form.purchaseTimeline} onChange={(v) => set("purchaseTimeline", v)} options={PURCHASE_TIMELINES} />
            <SelectField label="Interesse in verhuur" value={form.rentalInterest} onChange={(v) => set("rentalInterest", v)} options={RENTAL_INTEREST} />
            <TextField label="Verwacht bezoek aan Spanje" type="date" value={form.visitSpainDate} onChange={(v) => set("visitSpainDate", v)} />
            <div style={{ gridColumn: "1 / -1" }}>
              <TextField
                label="Bezoek Spanje – toelichting"
                value={form.visitSpainNotes}
                onChange={(v) => set("visitSpainNotes", v)}
                placeholder="Bijv. 'Eind oktober, week nog onbekend'"
              />
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Locatie">
        <div style={{ display: "grid", gap: 14 }}>
          <ChipMultiSelect label="Regio's" options={REGIONS} value={form.regions} onChange={(v) => set("regions", v)} />
          <TagInput label="Plaatsen" value={form.places} onChange={(v) => set("places", v)} suggestions={PLACE_SUGGESTIONS} placeholder="Typ een plaats en druk op Enter" />
        </div>
      </Panel>

      <Panel title="Woning">
        <div style={{ display: "grid", gap: 14 }}>
          <ChipMultiSelect label="Woningtype(s)" options={PROPERTY_TYPES} value={form.propertyTypes} onChange={(v) => set("propertyTypes", v)} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <SelectField label="Nieuwbouw of bestaande bouw" value={form.buildPreference} onChange={(v) => set("buildPreference", v)} options={BUILD_PREFERENCES} />
            <NumberField label="Min. slaapkamers" value={form.bedroomsMin} onChange={(v) => set("bedroomsMin", v)} />
            <NumberField label="Min. badkamers" value={form.bathroomsMin} onChange={(v) => set("bathroomsMin", v)} />
          </div>
          <ChipMultiSelect label="Wensen" options={REQUIREMENTS} value={form.requirements} onChange={(v) => set("requirements", v)} />
          <TextAreaField label="Extra wensen" value={form.extraRequirements} onChange={(v) => set("extraRequirements", v)} rows={3} />
        </div>
      </Panel>
    </div>
  );
}
