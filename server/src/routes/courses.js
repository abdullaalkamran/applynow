// Paginated catalog search — see courseSearch.js. Replaces downloading the whole catalog to search it in the browser.
//   POST /api/courses/search   full filter set in the body (the Explore page / Advanced Search)
//   GET  /api/courses/search   the simple filters as query parameters: q, level, intake, year, country, nationality, state,
//                              sort, page, limit (default 20, max 100)
// Both return { items, total, page, limit } with only what a list card shows. Full detail is GET /api/universities/:id.
const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { search, MAX_LIMIT } = require("../courseSearch");

const router = express.Router();

const list = (v) => (v === undefined || v === "" ? undefined : String(v).split(",").map((s) => s.trim()).filter(Boolean));

router.get("/search", requireAuth, async (req, res, next) => {
  try {
    const q = req.query;
    const result = await search({
      view: q.view,
      q: typeof q.q === "string" ? q.q : "",
      sort: q.sort,
      page: q.page,
      limit: q.limit,
      filters: {
        level: list(q.level),
        intakes: list(q.intake),
        destination: list(q.country),
        year: typeof q.year === "string" ? q.year : "",
        residenceName: typeof q.nationality === "string" ? q.nationality : "",
        studentState: typeof q.state === "string" ? q.state : "",
      },
    });
    res.set("Cache-Control", "private, max-age=60");
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/search", requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    res.json(await search({ ...body, limit: Math.min(Number(body.limit) || 20, MAX_LIMIT) }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
