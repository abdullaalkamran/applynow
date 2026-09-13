const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getConfig } = require("../config");
const { findByEmail, findById } = require("../usersStore");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

function toPublicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, roleUserId: user.roleUserId };
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, roleUserId: user.roleUserId },
    getConfig().jwtSecret,
    { expiresIn: "7d" }
  );
}

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    res.json({ token: issueToken(user), user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, (req, res) => {
  const user = findById(req.authUser.sub);
  if (!user) return res.status(401).json({ error: "Account no longer exists." });
  res.json({ user: toPublicUser(user) });
});

module.exports = router;
