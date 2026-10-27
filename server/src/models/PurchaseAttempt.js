const mongoose = require("mongoose");

const purchaseAttemptSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, default: null },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },
    paymentMethod: { type: String, enum: ["upi"], required: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ["created", "paid", "refunding", "refunded"], default: "created" },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PurchaseAttempt", purchaseAttemptSchema);
