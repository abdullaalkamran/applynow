// The Requirement Engine: which documents/rules apply to a given application, driven by data
// (country/university/course-scoped rows), never a hardcoded `if country === "UK"`. Deliberately
// NOT a condition-parser DSL — a small table plus specificity resolution (course beats university
// beats country) is enough for this app's scale and is easy to extend by adding a row, not code.
//
// Extends the one real precedent that existed before this: COUNTRY_REQUIREMENTS in
// utils/documentChecklist.ts, a hardcoded `Record<string,string[]>` keyed by country *name*. This
// keys by countryRegistry's stable country *id* instead, and covers more than just documents
// (financial holding periods, which immigration document type a country issues).
import { getCountryId } from "./countryRegistry";
import type { StageType } from "../types/journey";

export interface RequirementRule {
  id: string;
  countryId?: string;
  universityId?: string;
  courseId?: string;
  stageType: StageType;
  requirementType: "document" | "financial_holding_period" | "immigration_document_type";
  name: string;
  isRequired: boolean;
  configuration?: Record<string, unknown>;
  active: boolean;
}

// Seed rules — real, but illustrative; a real deployment would manage these through a Data
// Management screen the same way universities/subjects already are, not by editing this file.
// Financial holding periods and immigration document types are the two data points this codebase
// had zero structured model for before this feature (confirmed: no "holding period"/"I-20"/"PAL"
// anywhere in the app previously).
const RULES: RequirementRule[] = [
  // Immigration document type per destination country (the "one dynamic stage" requirement).
  // Country names here must match countryRegistry.ts's real seeded names exactly ("UK", not
  // "United Kingdom") — getCountryId() auto-registers any name it doesn't recognize as a brand-new
  // disconnected country, which would silently orphan these rules from real University.country data.
  { id: "req-doctype-uk", countryId: getCountryId("UK"), stageType: "university_document", requirementType: "immigration_document_type", name: "CAS", isRequired: true, configuration: { docType: "CAS" }, active: true },
  { id: "req-doctype-au", countryId: getCountryId("Australia"), stageType: "university_document", requirementType: "immigration_document_type", name: "COE", isRequired: true, configuration: { docType: "COE" }, active: true },
  { id: "req-doctype-ca", countryId: getCountryId("Canada"), stageType: "university_document", requirementType: "immigration_document_type", name: "PAL", isRequired: true, configuration: { docType: "PAL" }, active: true },
  { id: "req-doctype-us", countryId: getCountryId("United States"), stageType: "university_document", requirementType: "immigration_document_type", name: "I-20", isRequired: true, configuration: { docType: "I-20" }, active: true },

  // Bank-statement holding period per destination country.
  { id: "req-holding-uk", countryId: getCountryId("UK"), stageType: "financial_readiness", requirementType: "financial_holding_period", name: "Bank statement holding period", isRequired: true, configuration: { holdingPeriodDays: 28 }, active: true },
  { id: "req-holding-au", countryId: getCountryId("Australia"), stageType: "financial_readiness", requirementType: "financial_holding_period", name: "Bank statement holding period", isRequired: true, configuration: { holdingPeriodDays: 90 }, active: true },
  { id: "req-holding-ca", countryId: getCountryId("Canada"), stageType: "financial_readiness", requirementType: "financial_holding_period", name: "Bank statement holding period", isRequired: true, configuration: { holdingPeriodDays: 30 }, active: true },
  { id: "req-holding-us", countryId: getCountryId("United States"), stageType: "financial_readiness", requirementType: "financial_holding_period", name: "Bank statement holding period", isRequired: true, configuration: { holdingPeriodDays: 365 }, active: true },
  // Fallback for any country without a specific rule — 6 months is a common default.
  { id: "req-holding-default", stageType: "financial_readiness", requirementType: "financial_holding_period", name: "Bank statement holding period", isRequired: true, configuration: { holdingPeriodDays: 180 }, active: true },

  // Financial Readiness supporting documents.
  { id: "req-doc-bank-statement", stageType: "financial_readiness", requirementType: "document", name: "Bank Statement", isRequired: true, active: true },
  { id: "req-doc-solvency", stageType: "financial_readiness", requirementType: "document", name: "Solvency Certificate", isRequired: true, active: true },
  { id: "req-doc-affidavit", stageType: "financial_readiness", requirementType: "document", name: "Financial Affidavit", isRequired: false, configuration: { condition: "accountHolder != Student" }, active: true },

  // Payment supporting documents.
  { id: "req-doc-swift", stageType: "payment", requirementType: "document", name: "SWIFT Copy", isRequired: true, active: true },
  { id: "req-doc-receipt", stageType: "payment", requirementType: "document", name: "Payment Receipt", isRequired: true, active: true },
];

function specificityScore(rule: RequirementRule): number {
  // Course-specific beats university-specific beats country-specific beats a bare fallback.
  return (rule.courseId ? 4 : 0) + (rule.universityId ? 2 : 0) + (rule.countryId ? 1 : 0);
}

/** Every active rule that applies to this scope — at most one per distinct requirement `name`
 * (the most specific match wins), so a country-specific holding period and the generic fallback
 * never both show up as if they were two separate requirements. */
export function getApplicableRules(
  scope: { countryId?: string; universityId?: string; courseId?: string },
  stageType?: StageType
): RequirementRule[] {
  const matches = RULES.filter((rule) => {
    if (!rule.active) return false;
    if (stageType && rule.stageType !== stageType) return false;
    if (rule.countryId && rule.countryId !== scope.countryId) return false;
    if (rule.universityId && rule.universityId !== scope.universityId) return false;
    if (rule.courseId && rule.courseId !== scope.courseId) return false;
    return true;
  });

  const byKey = new Map<string, RequirementRule>();
  for (const rule of matches) {
    const key = `${rule.stageType}:${rule.name}`;
    const existing = byKey.get(key);
    if (!existing || specificityScore(rule) > specificityScore(existing)) byKey.set(key, rule);
  }
  return [...byKey.values()].sort((a, b) => specificityScore(b) - specificityScore(a));
}

export function resolveImmigrationDocType(scope: { countryId?: string; universityId?: string; courseId?: string }): "CAS" | "COE" | "PAL" | "I-20" | "Other" {
  const rule = getApplicableRules(scope, "university_document").find((r) => r.requirementType === "immigration_document_type");
  const docType = rule?.configuration?.docType;
  return (docType as "CAS" | "COE" | "PAL" | "I-20" | undefined) ?? "Other";
}

export function resolveHoldingPeriodDays(scope: { countryId?: string; universityId?: string; courseId?: string }): number {
  const rule = getApplicableRules(scope, "financial_readiness").find((r) => r.requirementType === "financial_holding_period");
  const days = rule?.configuration?.holdingPeriodDays;
  return typeof days === "number" ? days : 180;
}

/** The document-type requirements for one stage in this scope — the data-driven equivalent of the
 * old hardcoded COUNTRY_REQUIREMENTS map, now covering every stage, not just documents generally. */
export function resolveDocumentRequirements(scope: { countryId?: string; universityId?: string; courseId?: string }, stageType: StageType): RequirementRule[] {
  return getApplicableRules(scope, stageType).filter((r) => r.requirementType === "document");
}
