-- Per-course accrediting bodies: [{ name, logoUrl? }].
ALTER TABLE "Course" ADD COLUMN "accreditations" JSONB;
