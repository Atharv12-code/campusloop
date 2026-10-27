const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const postRoutes = require("./routes/postRoutes");
const authRoutes = require("./routes/authRoutes");
const { handleRazorpayWebhook } = require("./controllers/postController");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
app.set("trust proxy", 1);
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const uploadRoot = path.resolve(__dirname, "../uploads");

app.use(cors({ origin: allowedOrigin, credentials: true }));
app.post(
  "/api/payments/razorpay/webhook",
  express.raw({ type: "application/json", limit: "100kb" }),
  handleRazorpayWebhook
);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(uploadRoot));

app.get("/", (req, res) => {
  res.json({ message: "CampusLoop API is running!" });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    app: "CampusLoop",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
