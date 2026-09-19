// Singleton Prisma client — guards against duplicate connections when `node --watch` (this repo's
// dev script) or Passenger reloads the module without restarting the process.
require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env") });
const { PrismaClient } = require("@prisma/client");

const prisma = global.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") global.__prisma = prisma;

module.exports = prisma;
