-- Index for the catalog's own ordering (ORDER BY createdAt, id) — used by the catalog build, /api/universities/summary and the
-- search index (courseSearch.js). Purely additive: an index only, no column or data is touched.
--
-- Rollback (if ever needed): DROP INDEX `University_createdAt_id_idx` ON `University`;
-- (also remove the matching @@index line from schema.prisma)

-- CreateIndex
CREATE INDEX `University_createdAt_id_idx` ON `University`(`createdAt`, `id`);
