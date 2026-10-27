const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getJwtSecret } = require("../utils/jwtSecret");

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getAllowedDomains() {
  return (process.env.ALLOWED_EMAIL_DOMAINS || "")
    .split(",")
    .map((domain) => clean(domain).toLowerCase())
    .filter(Boolean);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getSignedToken(userId) {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: "7d" });
}

function setAuthCookie(res, token) {
  res.cookie("authToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function sanitizeUser(user) {
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    isVerified: user.isVerified,
  };
}

async function register(req, res, next) {
  try {
    const email = clean(req.body?.email).toLowerCase();
    const displayName = clean(req.body?.displayName);
    const password = clean(req.body?.password);

    if (!email || !displayName || !password) {
      return res.status(400).json({ error: "Email, display name, and password are required." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (displayName.length < 2 || displayName.length > 50) {
      return res.status(400).json({ error: "Display name must be 2 to 50 characters." });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const allowedDomains = getAllowedDomains();
    if (allowedDomains.length > 0) {
      const domain = email.split("@")[1]?.toLowerCase();
      if (!domain || !allowedDomains.includes(domain)) {
        return res.status(403).json({ error: `Only ${allowedDomains.join(", ")} emails can register.` });
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      displayName,
      passwordHash,
      isVerified: allowedDomains.length === 0,
    });

    const token = getSignedToken(user._id);
    setAuthCookie(res, token);

    return res.status(201).json({ user: sanitizeUser(user), token });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const email = clean(req.body?.email).toLowerCase();
    const password = clean(req.body?.password);

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = getSignedToken(user._id);
    setAuthCookie(res, token);

    return res.json({ user: sanitizeUser(user), token });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res) {
  res.clearCookie("authToken", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res.json({ message: "Signed out successfully." });
}

async function getMe(req, res) {
  return res.json({ user: sanitizeUser(req.user) });
}

module.exports = { register, login, logout, getMe };
