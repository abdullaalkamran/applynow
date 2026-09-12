const express = require("express");
const cors = require("cors");
const { getConfig } = require("./config");
const assistantRoute = require("./routes/assistant");
const healthRoute = require("./routes/health");
const adminSettingsRoute = require("./routes/adminSettings");
const transcribeRoute = require("./routes/transcribe");
const speakRoute = require("./routes/speak");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(
  cors({
    origin: getConfig().frontendOrigins,
  })
);
app.use(express.json({ limit: "1mb" }));

app.use("/api/health", healthRoute);
app.use("/api/assistant", assistantRoute);
app.use("/api/assistant/transcribe", transcribeRoute);
app.use("/api/assistant/speak", speakRoute);
app.use("/api/admin/settings", adminSettingsRoute);

app.use(errorHandler);

module.exports = app;
