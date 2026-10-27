const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getJwtSecret } = require("../utils/jwtSecret");

function parseCookies(rawCookieHeader = "") {
  return rawCookieHeader.split(";").reduce((cookies, segment) => {
    const [name, ...rest] = segment.trim().split("=");
    if (!name) return cookies;
    cookies[name] = decodeURIComponent(rest.join("="));
    return cookies;
  }, {});
}

async function protect(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies.authToken;

    if (!token) {
      return res.status(401).json({ error: "Please sign in to continue." });
    }

    const payload = jwt.verify(token, getJwtSecret());
    const user = await User.findById(payload.userId).select("-passwordHash");

    if (!user) {
      return res.status(401).json({ error: "Account not found. Please sign in again." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}

module.exports = { protect };
