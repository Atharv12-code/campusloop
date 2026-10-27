const mongoose = require("mongoose");

const CATEGORIES = [
  "General",
  "Announcements",
  "Questions",
  "Events",
  "Marketplace",
  "Lost & Found",
];

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    alt: { type: String, default: "", maxlength: 120 },
  },
  { _id: false }
);

const marketplaceSchema = new mongoose.Schema(
  {
    priceMinor: { type: Number, required: true, min: 0, max: 10000000 },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["available", "sold"], default: "available" },
    paymentMethods: {
      type: [{ type: String, enum: ["cash", "upi"] }],
      default: ["cash"],
    },
    sellerPayoutUpiId: { type: String, maxlength: 100, default: null },
    purchase: {
      status: { type: String, enum: ["available", "reserved", "sold"], default: "available" },
      buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      paymentMethod: { type: String, enum: ["cash", "upi"], default: null },
      amountMinor: { type: Number, min: 0, default: null },
      reservedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      razorpayOrderId: { type: String, default: null },
      razorpayPaymentId: { type: String, default: null },
      purchasedAt: { type: Date, default: null },
    },
  },
  { _id: false }
);

const replySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    author: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
    parentReplyId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    category: { type: String, enum: CATEGORIES, default: "General" },
    author: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    images: { type: [imageSchema], default: [] },
    marketplace: { type: marketplaceSchema, default: undefined },
    replies: { type: [replySchema], default: [] },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
module.exports.CATEGORIES = CATEGORIES;
