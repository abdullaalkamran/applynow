const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { getConfig } = require("./config");
const assistantRoute = require("./routes/assistant");
const healthRoute = require("./routes/health");
const adminSettingsRoute = require("./routes/adminSettings");
const transcribeRoute = require("./routes/transcribe");
const speakRoute = require("./routes/speak");
const authRoute = require("./routes/auth");
const notificationRulesRoute = require("./routes/notificationRules");
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
const courseImportsRoute = require("./routes/courseImports");
const universityImportsRoute = require("./routes/universityImports");
const interviewPrepRoute = require("./routes/interviewPrep");
const passportExtractionRoute = require("./routes/passportExtraction");
const commissionRatesRoute = require("./routes/commissionRates");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Behind cPanel/Passenger (and any reverse proxy) the client IP arrives in X-Forwarded-For; the
// rate limiters below key on it, so trust exactly one proxy hop.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Standard security headers. CSP is left to the SPA (this is a JSON API), and the resource
// policy must allow cross-origin embedding because the SPA is served from a different origin
// and loads /uploads images and PDFs from here.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: getConfig().frontendOrigins,
    // Read by the frontend's apiClient to tell a dead session apart from an ordinary 401.
    exposedHeaders: ["X-Session-Invalid"],
  })
);
app.use(express.json({ limit: "1mb" }));

// Brute-force / abuse limits. Per IP for the unauthenticated auth routes and the admin-token
// gate; per user (falling back to IP) for the endpoints that spend real AI-provider money.
// Generous enough that no real user hits them from the UI.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many attempts — try again in a few minutes." } });
const adminLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many attempts — try again shortly." } });
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "You're sending requests too quickly — please wait a moment." },
  keyGenerator: (req) => {
    const header = req.header("authorization") || "";
    return header.startsWith("Bearer ") ? `tok:${header.slice(7, 47)}` : `ip:${req.ip}`;
  },
  validate: { keyGeneratorIpFallback: false },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/google", authLimiter);
app.use("/api/admin", adminLimiter);
app.use("/api/assistant", aiLimiter);
app.use("/api/passport-extraction", aiLimiter);
app.use("/api/interview-prep", aiLimiter);
app.use("/api/course-imports", aiLimiter);
app.use("/api/university-imports", aiLimiter);

// Uploaded documents (see routes/documents.js) — served back exactly as stored, no auth check on
// the static file itself (only the path is unguessable, per multer's random filename), same
// trade-off as any plain object-storage URL. Uploads are restricted to images/PDF at upload
// time; the headers here make sure that even a stray file can never execute as a page on this
// origin (no sniffing, and a sandbox CSP if a browser does render it).
const INLINE_UPLOAD_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".pdf", ".jfif"]);
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"), {
    index: false,
    dotfiles: "deny",
    setHeaders: (res, filePath) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Images and PDFs render inline (the document viewer embeds them); anything else that
      // predates the upload allowlist is forced to download and sandboxed.
      if (!INLINE_UPLOAD_EXT.has(path.extname(filePath).toLowerCase())) {
        res.setHeader("Content-Disposition", "attachment");
        res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
      }
    },
  })
);

app.use("/api/health", healthRoute);
app.use("/api/assistant", assistantRoute);
app.use("/api/assistant/transcribe", transcribeRoute);
app.use("/api/assistant/speak", speakRoute);
app.use("/api/admin/settings", adminSettingsRoute);
app.use("/api/admin/notification-rules", notificationRulesRoute);
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
app.use("/api/course-imports", courseImportsRoute);
app.use("/api/university-imports", universityImportsRoute);
app.use("/api/interview-prep", interviewPrepRoute);
app.use("/api/passport-extraction", passportExtractionRoute);
app.use("/api/commission-rates", commissionRatesRoute);

app.use(errorHandler);

module.exports = app;
