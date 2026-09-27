// The real Country Guide catalog — replaces countryRegistry.ts's old localStorage-only registry,
// which meant a country a Data Manager added or edited only ever showed up in the browser that
// made the change. See the Country model's own comment in schema.prisma.
const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { requireDataRole } = require("../middleware/access");

const router = express.Router();

function serializeCountry(c) {
  return {
    id: c.id,
    name: c.name,
    logoUrl: c.logoUrl || undefined,
    whyThisCountry: c.whyThisCountry || undefined,
    recommendedFundsUSD: c.recommendedFundsUSD ?? undefined,
    visaCostConfig: c.visaCostConfig || undefined,
    requiredDocuments: c.requiredDocuments && c.requiredDocuments.length ? c.requiredDocuments : undefined,
    applicationProcedure: c.applicationProcedure || undefined,
    visaProcedure: c.visaProcedure || undefined,
    tagline: c.tagline || undefined,
    internationalStudentStat: c.internationalStudentStat || undefined,
    whyStudyHighlights: c.whyStudyHighlights && c.whyStudyHighlights.length ? c.whyStudyHighlights : undefined,
    keyInfo: c.keyInfo || undefined,
    usefulLinks: c.usefulLinks && c.usefulLinks.length ? c.usefulLinks : undefined,
    photoUrl: c.photoUrl || undefined,
    currencySymbols: c.currencySymbols && c.currencySymbols.length ? c.currencySymbols : undefined,
  };
}

function countryWriteData(body) {
  const data = {};
  if (typeof body.name === "string") data.name = body.name;
  if ("logoUrl" in body) data.logoUrl = body.logoUrl || null;
  if ("whyThisCountry" in body) data.whyThisCountry = body.whyThisCountry || null;
  if ("recommendedFundsUSD" in body) data.recommendedFundsUSD = body.recommendedFundsUSD ?? null;
  if ("visaCostConfig" in body) data.visaCostConfig = body.visaCostConfig ?? null;
  if ("requiredDocuments" in body) data.requiredDocuments = body.requiredDocuments ?? [];
  if ("applicationProcedure" in body) data.applicationProcedure = body.applicationProcedure || null;
  if ("visaProcedure" in body) data.visaProcedure = body.visaProcedure || null;
  if ("tagline" in body) data.tagline = body.tagline || null;
  if ("internationalStudentStat" in body) data.internationalStudentStat = body.internationalStudentStat || null;
  if ("whyStudyHighlights" in body) data.whyStudyHighlights = body.whyStudyHighlights ?? [];
  if ("keyInfo" in body) data.keyInfo = body.keyInfo ?? null;
  if ("usefulLinks" in body) data.usefulLinks = body.usefulLinks ?? [];
  if ("photoUrl" in body) data.photoUrl = body.photoUrl || null;
  if ("currencySymbols" in body) data.currencySymbols = body.currencySymbols ?? [];
  return data;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const countries = await prisma.country.findMany({ orderBy: { createdAt: "asc" } });
    res.json(countries.map(serializeCountry));
  } catch (err) {
    next(err);
  }
});

// Upsert, not a plain update: the client registers a brand-new country (see countryRegistry.ts's
// getCountryId) by PATCHing an id that doesn't exist yet with just { name }, then immediately
// follows up with a second PATCH carrying the full Country Guide content — an ordinary update
// would 404 on the first call, and there's no guarantee which of the two requests actually lands
// at the server first.
router.patch("/:id", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const data = countryWriteData(req.body || {});
    // Prisma validates the `create` branch's shape up front even when the row already exists and
    // only `update` will actually run — it always needs a real `name`, whether from this request's
    // own body or (on a follow-up patch that only sends other fields) the row already on file.
    const existing = await prisma.country.findUnique({ where: { id: req.params.id } });
    const name = data.name ?? existing?.name;
    if (!name) return res.status(400).json({ error: "name is required to register a new country." });

    const country = await prisma.country.upsert({
      where: { id: req.params.id },
      create: { id: req.params.id, ...data, name },
      update: data,
    });
    res.json(serializeCountry(country));
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "A country with that name already exists." });
    next(err);
  }
});

router.delete("/:id", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    await prisma.country.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Country not found." });
    next(err);
  }
});

module.exports = router;
