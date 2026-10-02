# Command Center – technische notities

## Pagina's (hash-routes, geen router-dependency)
`#/dashboard` · `#/leads` · `#/agenda` (`#/agenda/today`) · `#/kpis` · `#/partners` (`#/partners/<id>` opent dossier) · `#/commissies` · `#/instellingen` · `#/help`

## Centrale modules
| Bestand | Rol |
|---|---|
| `src/crm/milestones.js` | Mijlpalen zetten (eerste keer, nooit overschrijven), afleiden uit tijdlijn, `reached()`/`reachedAt()` |
| `src/crm/analytics.js` | Alle KPI-definities: periodes, gebeurtenissen, cohort-conversie, uitsplitsingen, team, partners, commissie |
| `src/crm/agenda.js` | Agenda-items en notificaties uit bestaande data |
| `src/crm/validation.js` | Progressieve validatie per fase (`forwardingGaps`) |

## Nieuwe Firestore-velden op `leads/{id}`
- Mijlpalen: `firstContactAt`, `firstMeetingScheduledAt`, `firstMeetingCompletedAt`, `firstForwardedAt`, `firstReservedAt`, `purchaseCompletedAt`, `stoppedAt`, `milestonesBackfilledAt`
- `consentStatus` (`yes`/`no`/`unknown`; `consentContact` blijft gesynchroniseerd)
- `reservedAt` (corrigeerbare reserveringsdatum)
- Commissie: `commissionStatus`, `commissionExpectedAmount` (`saleCommission` blijft gesynchroniseerd), `commissionReceivedAmount`, `commissionExpectedDate`, `commissionReceivedAt`, `commissionNotes`, `commissionPartnerId`, `commissionPartnerName`

Geen velden verwijderd of hernoemd.

## Security rules
Collection group-leesregels voor `tasks` en `partnerLinks` toegevoegd (zie `firestore.rules`). **Publiceren is nodig**, anders blijven Agenda/notificaties/partner-KPI's leeg. Geen indexes nodig (ongefilterde collection group-queries).
