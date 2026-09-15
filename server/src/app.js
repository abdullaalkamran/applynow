const express = require("express");
const cors = require("cors");
const { getConfig } = require("./config");
const assistantRoute = require("./routes/assistant");
const healthRoute = require("./routes/health");
const adminSettingsRoute = require("./routes/adminSettings");
const transcribeRoute = require("./routes/transcribe");
const speakRoute = require("./routes/speak");
const authRoute = require("./routes/auth");
const notificationRulesRoute = require("./routes/notificationRules");
const notificationsRoute = require("./routes/notifications");
const studentsRoute = require("./routes/students");
const staffRoute = require("./routes/staff");
const applicationsRoute = require("./routes/applications");
const tasksRoute = require("./routes/tasks");
const messagesRoute = require("./routes/messages");
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
app.use("/api/admin/notification-rules", notificationRulesRoute);
app.use("/api/notifications", notificationsRoute);
app.use("/api/auth", authRoute);
app.use("/api/students", studentsRoute);
app.use("/api/staff", staffRoute);
app.use("/api/applications", applicationsRoute);
app.use("/api/tasks", tasksRoute);
app.use("/api/messages", messagesRoute);

app.use(errorHandler);

module.exports = app;
