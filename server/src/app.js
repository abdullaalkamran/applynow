const express = require("express");
const path = require("path");
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
const documentsRoute = require("./routes/documents");
const applicationNextStepsRoute = require("./routes/applicationNextSteps");
const documentDueDatesRoute = require("./routes/documentDueDates");
const studentFinancialReadinessRoute = require("./routes/studentFinancialReadiness");
const inboxRoute = require("./routes/inbox");
const subjectsRoute = require("./routes/subjects");
const universitiesRoute = require("./routes/universities");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(
  cors({
    origin: getConfig().frontendOrigins,
  })
);
app.use(express.json({ limit: "1mb" }));

// Uploaded documents (see routes/documents.js) — served back exactly as stored, no auth check on
// the static file itself (only the path is unguessable, per multer's random filename), same
// trade-off as any plain object-storage URL.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

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
app.use("/api/documents", documentsRoute);
app.use("/api/next-steps", applicationNextStepsRoute);
app.use("/api/document-due-dates", documentDueDatesRoute);
app.use("/api/financial-readiness", studentFinancialReadinessRoute);
app.use("/api/inbox", inboxRoute);
app.use("/api/subjects", subjectsRoute);
app.use("/api/universities", universitiesRoute);

app.use(errorHandler);

module.exports = app;
