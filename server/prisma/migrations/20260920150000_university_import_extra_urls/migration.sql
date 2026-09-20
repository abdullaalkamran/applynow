-- A university import row can read several pages of the same university together.
ALTER TABLE "UniversityImportItem" ADD COLUMN "extraUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
