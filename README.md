# Mijn Spanje Kompas – CRM

Intern lead- en klantvolgsysteem (React + Firebase, deploy via GitHub → Vercel).

## Structuur

- `src/App.js` – inloggen, live data, dashboard, lijst en modals
- `src/crm/` – businesslogica: constants, datamodel (`types.js`), legacy-mapping (`normalize.js`), validatie, signalen/KPI's, filters, alle Firebase-schrijfacties (`services.js`), login (`useCrmAuth.js`)
- `src/components/` – UI (dashboard, filters, kaarten/tabel, leaddetail met tabs, partnerdatabase, login)
- `src/testing/fakeFirebase.js` – in-memory Firestore/Storage voor tests
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `cors.json` – Firebase-configuratie

Drempelwaarden voor signalen (24 uur zonder contact, 14 dagen inactief, 7 dagen partner) staan in `THRESHOLDS` in `src/crm/constants.js`.

## Eenmalige setup in Firebase

1. **Authentication** → Sign-in method → *Email/Password* aanzetten. Maak onder *Users* een account voor elk teamlid. Zodra iemand succesvol is ingelogd met Firebase Authentication krijgt diegene toegang tot het CRM.
2. **Optioneel – teamprofielen**: je mag per teamlid een document `users/{UID}` gebruiken voor naam/rol in het CRM:
   ```
   displayName: "Luke van Spronsen"
   email: "..."
   role: "admin"        // of "member"
   active: true
   ```
   Zo'n document is **niet verplicht om in te loggen**. Ontbreekt het, dan gebruikt het CRM de naam/e-mail uit Firebase Authentication als fallback.
3. **Firestore rules**: publiceer `firestore.rules` (console → Rules, of `firebase deploy --only firestore:rules`).
   ⚠️ Publiceren vervangt alle bestaande rules. Draaien er andere apps in hetzelfde project (bijv. `growth_*`-collecties)? Neem hun regels eerst over in het blok onderaan het bestand.
4. **Storage** aanzetten (voor `*.firebasestorage.app`-buckets is waarschijnlijk het Blaze-plan nodig) en `storage.rules` publiceren. De meegeleverde Storage-rules controleren alleen Firebase Authentication; er is geen users-profielcheck nodig.
5. **Optioneel – CORS** (voor direct downloaden met de juiste bestandsnaam). Vul je domein in `cors.json` in en voer uit:
   ```
   gsutil cors set cors.json gs://mijn-spanje-kompas-crm.firebasestorage.app
   ```
   Zonder CORS opent "downloaden" het bestand in een nieuw tabblad.

## Environment variables (Vercel)

Niet verplicht. De Firebase web-config staat als fallback in `src/firebase.js` (dit is geen geheim; de beveiliging zit in Auth + rules). Overschrijven kan met:
`REACT_APP_FIREBASE_API_KEY`, `REACT_APP_FIREBASE_AUTH_DOMAIN`, `REACT_APP_FIREBASE_PROJECT_ID`, `REACT_APP_FIREBASE_STORAGE_BUCKET`, `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`, `REACT_APP_FIREBASE_APP_ID`, `REACT_APP_FIREBASE_MEASUREMENT_ID`.

## Oude leads

Leads uit de vorige versie worden bij het uitlezen automatisch vertaald naar de nieuwe velden. Pas bij de eerste keer opslaan worden de nieuwe velden weggeschreven (`schemaVersion: 2`, `legacyInfo`, `legacyTags`). Oude velden worden nooit verwijderd.

## Testen

```
CI=true npm test -- --watchAll=false
CI=true npm run build
```
Let op: Vercel bouwt met `CI=true`, dus ESLint-warnings laten de build falen.

---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
