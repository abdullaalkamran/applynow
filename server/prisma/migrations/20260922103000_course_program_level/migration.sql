-- Separate from `level` (which stays "Undergraduate"/"Postgraduate" — several existing features
-- do exact string comparisons against it: MOI eligibility, English-requirement splits, entry
-- requirements). `programLevel` is the finer-grained Advanced Search taxonomy (Pathway Programs,
-- Twinning Programmes, Short-term/Summer, etc.) — a course can belong to more than one, and it's
-- purely additive so it never conflicts with the existing UG/PG logic.
ALTER TABLE "Course" ADD COLUMN "programLevel" TEXT[] DEFAULT ARRAY[]::TEXT[];
