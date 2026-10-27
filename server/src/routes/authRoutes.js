const express = require("express");
const { register, login, logout, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimiter");

const router = express.Router();

router.post("/register", rateLimit(), register);
router.post("/login", rateLimit(), login);
router.post("/logout", logout);
router.get("/me", protect, getMe);

module.exports = router;
