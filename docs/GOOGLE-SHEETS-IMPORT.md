# Leads importeren uit Google Sheets

Er zijn twee manieren. Beide gebruiken dezelfde mapping (`src/crm/sheetImport.js`).

## 1. Handmatig in het CRM (werkt direct)

Knop **Importeren** op de leadpagina → CSV kiezen of rijen plakken → preview → importeren.
Alleen ingelogde medewerkers kunnen dit; er is niets extra in te stellen.

## 2. Automatisch vanuit de Sheet (Cloud Function)

Het CRM is een Create React App zonder eigen server, dus er is geen `/api`-route.
De automatische import draait daarom als Firebase Cloud Function `importLeads`.

**Eenmalig instellen**

1. Firebase-project moet op het **Blaze**-abonnement staan (vereist voor Cloud Functions).
2. Secret aanmaken (kies een lange willekeurige string):
   ```
   firebase functions:secrets:set LEAD_IMPORT_SECRET
   ```
3. Deployen:
   ```
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```
   De URL staat daarna in de output, bijv.
   `https://europe-west1-<project-id>.cloudfunctions.net/importLeads`.

**Apps Script in de Sheet** (Extensies → Apps Script). Zet het secret in
*Projectinstellingen → Scripteigenschappen* als `LEAD_IMPORT_SECRET`, niet in de code.

```javascript
const ENDPOINT = "https://europe-west1-<project-id>.cloudfunctions.net/importLeads";

/** Stuurt één rij (bijv. vanuit een onFormSubmit-trigger) naar het CRM. */
function sendRowToCrm(rowNumber) {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Leads"); // pas aan
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = sheet.getRange(rowNumber, 1, 1, header.length).getDisplayValues()[0];
  const row = Object.fromEntries(header.map((h, i) => [h, values[i]]));
  const res = UrlFetchApp.fetch(ENDPOINT, {
    method: "post",
    contentType: "application/json",
    headers: { "x-import-secret": PropertiesService.getScriptProperties().getProperty("LEAD_IMPORT_SECRET") },
    payload: JSON.stringify({ rows: [row] }),
    muteHttpExceptions: true,
  });
  Logger.log(res.getResponseCode() + " " + res.getContentText());
}

/** Alle rijen opnieuw sturen: veilig, bestaande Submission ID's worden overgeslagen. */
function sendAllRowsToCrm() {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Leads");
  for (let r = 2; r <= sheet.getLastRow(); r++) sendRowToCrm(r);
}
```

**Antwoord van de endpoint** per rij: `new`, `possible_duplicate`, `already_exists`
(met `leadId`), `invalid` (met `problems`) of `error`.

## Mapping in het kort

| Sheet | CRM-veld | Opmerking |
|---|---|---|
| Submission ID | `sourceSubmissionId` + document-id `sheet-<id>` | harde duplicaatcontrole |
| Submission time | `sourceSubmittedAt` | "Binnengekomen op" |
| property_type | `propertyTypes[]` | villa, appartement, … |
| listing_type | `buildPreference` | nieuwbouw / bestaande bouw / beide |
| bedrooms | `bedroomsMin` | "3+" → 3 |
| region | `regions[]` + `places[]` | onbekende plaatsnamen → plaatsen |
| max_budget | `budgetMin` / `budgetMax` | "0 - 200.000" → max 200000 |
| aankooptijd | `purchaseTimeline` | "Binnen 3-6 maanden" → `3_to_6_months` |
| doeleinde | `purchaseGoal` | |
| financiering | `financingType` | |
| bezoek spanje | `visitSpainStatus` / `visitSpainDate` / `visitSpainNotes` | |
| name, Telefoonnummer, email | `name`, `phone`, `email` | telefoon leesbaar, `phoneNormalized` voor duplicaten |
| contact | `preferredContactMethod` + `contactPreferenceText` | vrije tekst blijft bewaard |
| bereikbaar | `preferredContactMoment` + `contactMomentText` | |
| toestemming | `consentContact` | true / false / null |
| utm_*, landingPage, form_source | `utmSource` … `landingPage`, `formSource` | bron → `leadSource` (fb + paid_social = Meta Ads) |
| pdf_url, pdf_file_id, pdf_created_at, pdf_sent | `searchProfilePdf` | zichtbaar onder Bestanden |
| mail_status, growth_sync_* | `syncInfo` | alleen zichtbaar bij een fout |
| (hele rij) | `importRaw` | originele waarden, voor audit |
