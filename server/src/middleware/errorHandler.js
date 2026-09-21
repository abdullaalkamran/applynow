const multer = require("multer");
const { Prisma } = require("@prisma/client");

// Prisma error codes that map cleanly onto HTTP statuses — the message is generic on purpose:
// Prisma's own text embeds the failing query and its arguments (which for a user.create includes
// the password hash), so it must never reach a client.
const PRISMA_STATUS = {
  P2025: [404, "Not found."],
  P2002: [409, "That record already exists."],
  P2003: [409, "This record is still referenced by other data."],
  P2000: [400, "A value is too long."],
};

/** Express error handler — every route's `next(err)` lands here. Anything with an explicit
 * `status < 500` is a deliberate client-facing error and keeps its message; everything else is
 * logged in full server-side and reported to the client only as "Internal server error". */
function errorHandler(err, _req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || "Internal server error";

  if (err instanceof multer.MulterError) {
    status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "That file is too large." : "Invalid upload.";
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && PRISMA_STATUS[err.code]) {
    [status, message] = PRISMA_STATUS[err.code];
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    status = 400;
    message = "Invalid request.";
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Malformed JSON body.";
  } else if (err.type === "entity.too.large") {
    status = 413;
    message = "Request body is too large.";
  }

  if (status >= 500) {
    console.error(err);
    message = "Internal server error";
  }
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
