const express = require("express");
const { getConfig } = require("../config");

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({ ok: true, provider: getConfig().provider });
});

module.exports = router;
