/**
 * Type-definities voor het CRM (JSDoc, omdat het project JavaScript gebruikt).
 * VS Code gebruikt deze voor autocomplete en type-hints.
 *
 * Datums:
 *  - "DateString" = "YYYY-MM-DD" (lokale kalenderdag, bijv. opvolgdatum).
 *  - Timestamp    = Firestore Timestamp (tijdstip, bijv. createdAt).
 *
 * @typedef {string} DateString
 * @typedef {import("firebase/firestore").Timestamp} Timestamp
 */

/**
 * users/{userId} — documentId = Firebase Auth UID.
 * @typedef {Object} CrmUser
 * @property {string} id
 * @property {string} displayName
 * @property {string} email
 * @property {"admin"|"member"} role
 * @property {boolean} active
 */

/**
 * leads/{leadId}
 * @typedef {Object} Lead
 * @property {string} id
 * @property {number} schemaVersion
 * // Contact
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 * @property {string} emailNormalized
 * @property {string} phoneNormalized
 * @property {string} preferredContactMethod
 * @property {string} preferredContactMoment
 * // Proces
 * @property {string} pipelineStage
 * @property {string} purchaseIntent
 * @property {string} priority
 * @property {string} ownerId
 * @property {string} ownerName
 * @property {string} leadSummary
 * @property {string} notities
 * // Volgende actie
 * @property {string} nextActionType
 * @property {string} nextActionLabel
 * @property {DateString} nextActionDate
 * @property {string} nextActionAssignedTo
 * @property {string} nextActionAssignedToName
 * @property {string} nextActionNotes
 * // Kennismaking
 * @property {DateString} appointmentDate
 * @property {string} appointmentTime
 * @property {string} appointmentType
 * @property {string} appointmentAssignedTo
 * @property {string} appointmentAssignedToName
 * @property {string} appointmentStatus
 * // Zoekprofiel
 * @property {number|null} budgetMin
 * @property {number|null} budgetMax
 * @property {string[]} regions
 * @property {string[]} places
 * @property {string[]} propertyTypes
 * @property {string} buildPreference
 * @property {number|null} bedroomsMin
 * @property {number|null} bathroomsMin
 * @property {string} purchaseGoal
 * @property {string} purchaseTimeline
 * @property {string} financingType
 * @property {number|null} availableEquity
 * @property {string} currentHousingSituation
 * @property {DateString} visitSpainDate
 * @property {string} visitSpainNotes
 * @property {string} rentalInterest
 * @property {string[]} requirements
 * @property {string} extraRequirements
 * // Bron / marketing
 * @property {string} leadSource
 * @property {string} utmSource
 * @property {string} utmMedium
 * @property {string} utmCampaign
 * @property {string} utmContent
 * @property {string} landingPage
 * @property {string[]} tags
 * // Afsluiten / archief
 * @property {string} closureReason
 * @property {string} closureNotes
 * @property {Timestamp|null} closedAt
 * @property {boolean} archived
 * @property {Timestamp|null} archivedAt
 * @property {string} archivedBy
 * @property {boolean} pinned
 * // Gedenormaliseerd (beheerd door services, niet door het formulier)
 * @property {Timestamp|null} lastContactAt
 * @property {string} lastContactMethod
 * @property {Timestamp|null} lastContactAttemptAt
 * @property {Timestamp|null} lastActivityAt
 * @property {string} lastActivityType
 * @property {string[]} partnerIds
 * @property {string[]} partnerNames
 * @property {string} partnerStatus
 * @property {PartnerSummary} partnerSummary
 * @property {number} openTaskCount
 * @property {DateString} nextTaskDueDate
 * @property {string} nextTaskTitle
 * @property {number} fileCount
 * // Techniek
 * @property {Timestamp|null} createdAt
 * @property {string} createdBy
 * @property {Timestamp|null} updatedAt
 * @property {string} updatedBy
 * @property {LegacyInfo} _legacy   Alleen in de client, wordt nooit opgeslagen.
 */

/**
 * @typedef {Object} PartnerSummary
 * @property {number} count
 * @property {number} waitingCount     Koppelingen in sent/received/contacted
 * @property {Timestamp|null} waitingSince  Oudste laatste opvolging/koppeling van wachtende koppelingen
 * @property {DateString} nextFollowUpAt   Eerstvolgende geplande partneropvolging
 */

/**
 * @typedef {Object} LegacyInfo
 * @property {string} [status]
 * @property {string} [leadType]
 * @property {string} [source]
 * @property {string[]} [tags]
 * @property {Object<string,string>} [unmapped]  Oude waarden die niet 1-op-1 te mappen waren
 */

/**
 * leads/{leadId}/activities/{activityId}
 * @typedef {Object} Activity
 * @property {string} id
 * @property {string} type
 * @property {Timestamp} occurredAt
 * @property {Timestamp} createdAt
 * @property {string} createdByUserId
 * @property {string} createdByName
 * @property {string} [performedByUserId]
 * @property {string} [performedByName]
 * @property {string} title
 * @property {string} description
 * @property {string} outcome
 * @property {string} contactMethod
 * @property {Object} metadata
 */

/**
 * leads/{leadId}/files/{fileId}
 * @typedef {Object} LeadFile
 * @property {string} id
 * @property {string} fileName
 * @property {string} originalFileName
 * @property {string} storagePath
 * @property {string} mimeType
 * @property {number} size
 * @property {string} category
 * @property {Timestamp} uploadedAt
 * @property {string} uploadedByUserId
 * @property {string} uploadedByName
 */

/**
 * partners/{partnerId}
 * @typedef {Object} Partner
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {string} contactPerson
 * @property {string} email
 * @property {string} phone
 * @property {string[]} regions
 * @property {string} notes
 * @property {boolean} active
 * @property {Timestamp} createdAt
 * @property {Timestamp} updatedAt
 */

/**
 * leads/{leadId}/partnerLinks/{partnerLinkId}
 * @typedef {Object} PartnerLink
 * @property {string} id
 * @property {string} partnerId
 * @property {string} partnerName
 * @property {string} partnerType
 * @property {string} contactPerson
 * @property {Timestamp} linkedAt
 * @property {string} linkedByUserId
 * @property {string} status
 * @property {string} notes
 * @property {Timestamp|null} lastFollowUpAt
 * @property {DateString} nextFollowUpAt
 */

/**
 * leads/{leadId}/tasks/{taskId}
 * @typedef {Object} LeadTask
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} assignedToUserId
 * @property {string} assignedToName
 * @property {DateString} dueDate
 * @property {"open"|"completed"|"cancelled"} status
 * @property {string} priority
 * @property {Timestamp} createdAt
 * @property {Timestamp|null} completedAt
 * @property {string} createdBy
 */

export {};
