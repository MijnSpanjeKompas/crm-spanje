// ─── PROFIELEN (Luke / Indy) ────────────────────────────────────────────────
// Het team logt in met hetzelfde Firebase-account. Na het inloggen kies je
// altijd een profiel; vanaf dan staat alles wat je doet (tijdlijn, contact-
// momenten, afgevinkte acties, nieuwe leads) op naam van dat profiel.
// De data zelf blijft gedeeld en realtime: wat Luke wijzigt, ziet Indy direct.
//
// De keuze geldt per browsertabblad (sessionStorage): bij elke nieuwe start
// van het CRM kies je opnieuw. Ids zijn stabiel en worden in Firestore
// opgeslagen (createdByUserId, ownerId, ...); namen mogen vrij wijzigen.

export const PROFILES = [
  { id: "luke", displayName: "Luke", fullName: "Luke van Spronsen", active: true },
  { id: "indy", displayName: "Indy", fullName: "Indy", active: true },
];

const STORAGE_KEY = "msk:profiel";

export function profileById(id) {
  return PROFILES.find((p) => p.id === id) || null;
}

export function getStoredProfileId() {
  try {
    const id = window.sessionStorage.getItem(STORAGE_KEY);
    return profileById(id) ? id : null;
  } catch (e) {
    return null;
  }
}

export function storeProfileId(id) {
  try {
    if (id) window.sessionStorage.setItem(STORAGE_KEY, id);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* opslag niet beschikbaar: keuze geldt alleen tot herladen */
  }
}

/**
 * Gebruiker zoals de rest van het CRM hem ziet: id en naam van het profiel,
 * e-mail en rol van het ingelogde Firebase-account.
 */
export function profileUser(authUser, profileId) {
  const p = profileById(profileId);
  if (!authUser || !p) return null;
  return {
    ...authUser,
    id: p.id,
    displayName: p.displayName,
    fullName: p.fullName,
    profileId: p.id,
    authUid: authUser.id,
    actorType: "human",
  };
}

/** Naam alleen tonen als het een van de profielen is (oude accountnamen zoals "Mijn Spanje Kompas" niet). */
export function profileNameOnly(name) {
  const n = String(name || "").trim().toLowerCase();
  const p = PROFILES.find((x) => x.displayName.toLowerCase() === n || x.fullName.toLowerCase() === n);
  return p ? p.displayName : "";
}
