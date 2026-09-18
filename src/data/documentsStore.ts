// The generic, lifecycle-aware document system the workflow needs (Requested → Uploaded → Under
// Review → Verified/Rejected/Expired) — additive, not a replacement for the existing document-ish
// stores (applicationDocsStore, coreDocsStore, documentDueDatesStore). Those keep serving the
// existing core/university-text checklist untouched; new stage-linked documents (bank statement,
// SWIFT copy, CAS/COE/PAL/I-20, visa docs) go through this store from this feature onward.
// Consolidating the older stores into this one is a deliberate later migration, not part of this
// pass.
import type { Role } from "../types";
import type { StageType } from "../types/journey";

export type DocumentStatus = "Requested" | "Uploaded" | "Under Review" | "Verified" | "Rejected" | "Expired";

export interface StageDocument {
  id: string;
  applicationId: string;
  stageType: StageType;
  documentType: string; // e.g. "Bank Statement", "SWIFT Copy", "CAS"
  status: DocumentStatus;
  fileUrl?: string;
  uploadedBy?: { id: string; role: Role; name: string };
  verifiedBy?: { id: string; role: Role; name: string };
  issuedDate?: string;
  expiryDate?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = "sd-stage-documents:";

export function loadStageDocuments(applicationId: string): StageDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + applicationId);
    return raw ? (JSON.parse(raw) as StageDocument[]) : [];
  } catch {
    return [];
  }
}

function persist(applicationId: string, docs: StageDocument[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + applicationId, JSON.stringify(docs));
}

function patchOne(applicationId: string, id: string, patch: Partial<StageDocument>): StageDocument | null {
  const docs = loadStageDocuments(applicationId);
  const idx = docs.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  docs[idx] = { ...docs[idx], ...patch, updatedAt: new Date().toISOString() };
  persist(applicationId, docs);
  return docs[idx];
}

/** A counsellor/AI asking the student for a specific document for one stage. */
export function requestDocument(applicationId: string, stageType: StageType, documentType: string): StageDocument {
  const doc: StageDocument = {
    id: `sdoc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
    applicationId,
    stageType,
    documentType,
    status: "Requested",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  persist(applicationId, [...loadStageDocuments(applicationId), doc]);
  return doc;
}

export function uploadDocument(applicationId: string, id: string, fileUrl: string, uploadedBy: StageDocument["uploadedBy"]): StageDocument | null {
  return patchOne(applicationId, id, { status: "Uploaded", fileUrl, uploadedBy });
}

export function verifyDocument(applicationId: string, id: string, verifiedBy: StageDocument["verifiedBy"], issuedDate?: string, expiryDate?: string): StageDocument | null {
  return patchOne(applicationId, id, { status: "Verified", verifiedBy, issuedDate, expiryDate });
}

export function rejectDocument(applicationId: string, id: string, verifiedBy: StageDocument["verifiedBy"], rejectionReason: string): StageDocument | null {
  return patchOne(applicationId, id, { status: "Rejected", verifiedBy, rejectionReason });
}

export function getMissingDocuments(applicationId: string, stageType?: StageType): StageDocument[] {
  return loadStageDocuments(applicationId).filter(
    (d) => (!stageType || d.stageType === stageType) && (d.status === "Requested" || d.status === "Rejected")
  );
}
