// A playbook is the scripted, selector-level knowledge of one portal. Each exports:
//   match(portal)                                  -> boolean (by URL host)
//   fillApplication(page, payload)                 -> { draftRef?, notes? }   leave the page ready for the final submit
//   finalSubmit(page, payload)                     -> { externalRef? }        reopen the draft (payload.submission.snapshot.draftRef) and submit
//   readStatus(page, payload)                      -> { portalStatus?, comments:[{id,text}], requiredDocuments:[string] }
// Everything runs after login (src/login.js). Add one file per real portal; a portal with no playbook is handed to
// the counsellor as "needs help" instead of the agent improvising on a live admissions system.
const playbooks = [require("./mock")];

const find = (portal) => playbooks.find((p) => p.match(portal)) || null;
module.exports = { find };
