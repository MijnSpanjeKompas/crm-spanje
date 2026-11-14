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

Indeling sinds november 2026 (oude kolomnamen tussen haakjes werken nog steeds).
**Plakken in het CRM:** alleen de rij van de lead is genoeg; zonder kopregel worden
de cellen op deze volgorde gelezen (zie `SHEET_COLUMNS` in `src/crm/sheetImport.js`).

| Sheet | CRM-veld | Opmerking |
|---|---|---|
| lead_status | `syncInfo.sheetLeadStatus` | alleen bewaard, verandert de fase niet |
| Submission ID | `sourceSubmissionId` + document-id `sheet-<id>` | harde duplicaatcontrole |
| Submission time | `sourceSubmittedAt` | "Binnengekomen op" |
| Type woning (property_type) | `propertyTypes[]` | villa, appartement, … |
| Bouwtype (listing_type) | `buildPreference` | nieuwbouw / bestaande bouw / beide |
| Regio (region) | `regions[]` + `places[]` | onbekende plaatsnamen → plaatsen |
| Budget (max_budget) | `budgetMin` / `budgetMax` | "0 - 200.000" → max 200000 |
| Doeleinde (doeleinde) | `purchaseGoal` | |
| Termijn (aankooptijd) | `purchaseTimeline` | "Binnen 3-6 maanden" → `3_to_6_months` |
| Naam, Telefoonnummer, Email-adres | `name`, `phone`, `email` | telefoon leesbaar, `phoneNormalized` voor duplicaten |
| Algemene voorwaarde (toestemming) | `consentContact` | true / false / null |
| utm_*, landingPage, form_source | `utmSource` … `landingPage`, `formSource` | bron → `leadSource` (fb + paid_social = Meta Ads) |
| mail_status, mail_processing_at, mail_error, intern_mail | `syncInfo` | |
| pdf_url, pdf_file_id, pdf_created_at, pdf_sent | `searchProfilePdf` | zichtbaar onder Bestanden |
| growth_sync_* | `syncInfo` | alleen zichtbaar bij een fout |
| (hele rij) | `importRaw` | originele waarden, voor audit |

Vervallen in de nieuwe Sheet (blijven leeg bij nieuwe leads): bedrooms, financiering,
bezoek spanje, contact, bereikbaar.
