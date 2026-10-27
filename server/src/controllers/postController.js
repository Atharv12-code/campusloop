const mongoose = require("mongoose");
const Post = require("../models/Post");
const PurchaseAttempt = require("../models/PurchaseAttempt");
const { CATEGORIES } = Post;
const { uploadImage } = require("../utils/imageStorage");
const {
  getRazorpay,
  isRazorpayConfigured,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} = require("../utils/razorpay");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const CURRENCY = "INR";
const MAX_PRICE_MINOR = 10000000;
const RESERVATION_MINUTES = 5;
const PAYMENT_METHODS = ["cash", "upi"];

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseRupeesToPaise(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const paise = Math.round(parsed * 100);
  if (paise < 0) return null;
  return paise;
}

function parsePaymentMethods(value) {
  if (value === undefined) return ["cash"];
  let methods = value;
  if (typeof methods === "string") {
    try {
      methods = JSON.parse(methods);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(methods) || methods.length === 0) return null;
  const normalized = [...new Set(methods)];
  return normalized.every((method) => PAYMENT_METHODS.includes(method)) ? normalized : null;
}

function getPurchaseMeta(post) {
  if (post?.marketplace) {
    delete post.marketplace.sellerPayoutUpiId;
    delete post.marketplace.auction;
    if (Array.isArray(post.marketplace.paymentMethods)) {
      post.marketplace.paymentMethods = post.marketplace.paymentMethods.filter((method) => PAYMENT_METHODS.includes(method));
    }
    if (!post.marketplace.paymentMethods?.length) post.marketplace.paymentMethods = ["cash"];
  }
  const purchase = post?.marketplace?.purchase;
  if (!purchase) return post;
  const isReserved = purchase.status === "reserved" && purchase.expiresAt && new Date(purchase.expiresAt) > new Date();
  post.marketplace.purchase = {
    status: purchase.status === "reserved" && !isReserved ? "available" : purchase.status,
    secondsLeft: isReserved ? Math.ceil((new Date(purchase.expiresAt).getTime() - Date.now()) / 1000) : 0,
    expiresAt: isReserved ? purchase.expiresAt : null,
  };
  return post;
}

async function getPosts(req, res, next) {
  try {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const search = clean(req.query.q);

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({ error: "Page must be a positive integer." });
    }
    if (search.length > 100) {
      return res.status(400).json({ error: "Search must be 100 characters or fewer." });
    }

    const filter = {};
    const category = clean(req.query.category);
    if (category) {
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ error: "Invalid category." });
      }
      filter.category = category;
    }
    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { title: expression },
        { content: expression },
        { author: expression },
      ];
    }

    let posts = await Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean();
    const hasMore = posts.length > limit;
    if (hasMore) posts = posts.slice(0, limit);
    posts = posts.map(getPurchaseMeta);
    res.json({ posts, hasMore, page, limit });
  } catch (err) {
    next(err);
  }
}

async function createPost(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Please sign in to post." });
    }

    const title = clean(req.body?.title);
    const content = clean(req.body?.content);
    const category = clean(req.body?.category) || "General";
    const files = Array.isArray(req.files) ? req.files : [];

    if (title.length < 3 || title.length > 100) {
      return res.status(400).json({ error: "Title must be 3 to 100 characters." });
    }
    if (content.length < 1 || content.length > 2000) {
      return res.status(400).json({ error: "Content must be 1 to 2000 characters." });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "Invalid category." });
    }

    const allowedImageCategories = ["Lost & Found", "Announcements", "Events", "Marketplace"];
    if (files.length > 0 && !allowedImageCategories.includes(category)) {
      return res.status(400).json({ error: "Images are only allowed on Lost & Found, Announcements, Events, and Marketplace posts." });
    }

    let images = [];
    if (files.length > 0) {
      images = await Promise.all(
        files.map(async (file) => {
          const uploaded = await uploadImage(file.buffer);
          return {
            url: uploaded.url,
            publicId: uploaded.publicId,
            width: uploaded.width || 0,
            height: uploaded.height || 0,
            alt: clean(req.body[`imageAlt-${file.fieldname}`] || req.body.alt || ""),
          };
        })
      );
    }

    const payload = {
      title,
      content,
      category,
      author: req.user.displayName,
      user: req.user._id,
      images,
    };

    let payoutUpiId = "";
    if (category === "Marketplace") {
      const rawMarketplace = typeof req.body.marketplace === "string" ? JSON.parse(req.body.marketplace) : (req.body.marketplace || {});
      const rawPriceValue = rawMarketplace.price ?? req.body.price;
      if (rawPriceValue === undefined || rawPriceValue === null || String(rawPriceValue).trim() === "") {
        return res.status(400).json({ error: "Enter a selling price. Use 0 for Free." });
      }
      const priceValue = rawPriceValue;
      const priceMinor = parseRupeesToPaise(priceValue);
      const paymentMethods = parsePaymentMethods(rawMarketplace.paymentMethods ?? req.body.paymentMethods);
      payoutUpiId = clean(rawMarketplace.payoutUpiId ?? req.body.payoutUpiId);

      if (priceMinor === null || priceMinor > MAX_PRICE_MINOR) {
        return res.status(400).json({ error: "Price must be between Rs 0 and Rs 100,000." });
      }
      if (!paymentMethods) {
        return res.status(400).json({ error: "Select at least one valid payment method: cash or UPI." });
      }
      if (priceMinor > 0 && paymentMethods.includes("upi") &&
        !/^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$/.test(payoutUpiId)) {
        return res.status(400).json({ error: "Enter a valid seller UPI ID for online payment settlement." });
      }

      payload.marketplace = {
        priceMinor,
        currency: CURRENCY,
        status: "available",
        paymentMethods,
        sellerPayoutUpiId: priceMinor > 0 && paymentMethods.some((method) => method !== "cash")
          ? payoutUpiId
          : null,
        purchase: { status: "available" },
      };
    }

    const post = await Post.create(payload);
    res.status(201).json({ post });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(400).json({ error: "Invalid marketplace data." });
    }
    next(err);
  }
}

async function reservePurchase(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: "Please sign in to purchase." });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Marketplace listing not found." });
    }

    const post = await Post.findById(req.params.id);
    if (!post || post.category !== "Marketplace" || !post.marketplace) {
      return res.status(404).json({ error: "Marketplace listing not found." });
    }
    const listing = post.marketplace;
    if (String(post.user) === String(req.user._id)) {
      return res.status(403).json({ error: "You cannot purchase your own listing." });
    }
    if (listing.status === "sold") {
      return res.status(409).json({ error: "This listing has already been sold." });
    }
    if (listing.purchase?.status === "reserved" && listing.purchase.expiresAt > new Date()) {
      return res.status(409).json({ error: "This listing is reserved. Try again when the reservation expires." });
    }
    const paymentMethod = clean(req.body?.paymentMethod);
    if (!PAYMENT_METHODS.includes(paymentMethod) ||
      (listing.priceMinor > 0 && !(listing.paymentMethods || ["cash"]).includes(paymentMethod))) {
      return res.status(400).json({ error: "This seller does not accept that payment method." });
    }

    const amountMinor = listing.priceMinor;
    const isFree = amountMinor === 0;
    const now = new Date();
    if (!isFree && paymentMethod !== "cash" && amountMinor < 100) {
      return res.status(400).json({ error: "Razorpay online payments require a minimum total of Rs 1.00." });
    }

    if (isFree || paymentMethod === "cash") {
      const claim = await Post.findOneAndUpdate(
        {
          _id: post._id,
          "marketplace.status": "available",
          $or: [
            { "marketplace.purchase.status": { $ne: "reserved" } },
            { "marketplace.purchase.expiresAt": { $lte: now } },
          ],
        },
        {
          $set: {
            "marketplace.status": "sold",
            "marketplace.purchase.status": "sold",
            "marketplace.purchase.buyer": req.user._id,
            "marketplace.purchase.paymentMethod": isFree ? "cash" : paymentMethod,
            "marketplace.purchase.amountMinor": amountMinor,
            "marketplace.purchase.purchasedAt": now,
            "marketplace.purchase.reservedAt": null,
            "marketplace.purchase.expiresAt": null,
          },
        },
        { new: true }
      );
      if (!claim) return res.status(409).json({ error: "This listing is no longer available. Refresh and try again." });
      return res.json({ status: "sold", free: isFree, message: isFree ? "Item claimed successfully." : "Item claimed. Arrange cash payment with the seller." });
    }

    if (!isRazorpayConfigured()) {
      return res.status(503).json({ error: "Online payments are not configured. Contact the site administrator or choose cash if available." });
    }

    const expiresAt = new Date(now.getTime() + RESERVATION_MINUTES * 60 * 1000);
    const reservation = await Post.findOneAndUpdate(
      {
        _id: post._id,
        "marketplace.status": "available",
        $or: [
          { "marketplace.purchase.status": { $ne: "reserved" } },
          { "marketplace.purchase.expiresAt": { $lte: now } },
        ],
      },
      {
        $set: {
          "marketplace.purchase.status": "reserved",
          "marketplace.purchase.buyer": req.user._id,
          "marketplace.purchase.paymentMethod": paymentMethod,
          "marketplace.purchase.amountMinor": amountMinor,
          "marketplace.purchase.reservedAt": now,
          "marketplace.purchase.expiresAt": expiresAt,
          "marketplace.purchase.razorpayOrderId": null,
          "marketplace.purchase.razorpayPaymentId": null,
        },
      },
      { new: true }
    );
    if (!reservation) return res.status(409).json({ error: "This listing is no longer available. Refresh and try again." });

    try {
      const order = await getRazorpay().orders.create({
        amount: amountMinor,
        currency: CURRENCY,
        receipt: `p${String(post.id).slice(-16)}_${now.getTime()}`,
        notes: { postId: post.id, buyerId: String(req.user._id) },
      });
      await PurchaseAttempt.create({
        post: post._id,
        buyer: req.user._id,
        razorpayOrderId: order.id,
        amountMinor,
        currency: CURRENCY,
        paymentMethod,
        expiresAt,
      });
      const saved = await Post.updateOne(
        {
          _id: post._id,
          "marketplace.purchase.status": "reserved",
          "marketplace.purchase.buyer": req.user._id,
          "marketplace.purchase.reservedAt": now,
          "marketplace.purchase.expiresAt": { $gt: new Date() },
        },
        { $set: { "marketplace.purchase.razorpayOrderId": order.id } }
      );
      if (!saved.modifiedCount) {
        return res.status(409).json({ error: "The reservation expired before payment could start. Please try again." });
      }
      return res.json({
        status: "reserved",
        expiresAt,
        reservationSeconds: RESERVATION_MINUTES * 60,
        keyId: process.env.RAZORPAY_KEY_ID,
        order: { id: order.id, amount: order.amount, currency: order.currency },
        buyer: { name: req.user.displayName, email: req.user.email },
      });
    } catch (err) {
      await Post.updateOne(
        {
          _id: post._id,
          "marketplace.purchase.status": "reserved",
          "marketplace.purchase.buyer": req.user._id,
          "marketplace.purchase.reservedAt": now,
        },
        {
          $set: {
            "marketplace.purchase.status": "available",
            "marketplace.purchase.buyer": null,
            "marketplace.purchase.paymentMethod": null,
            "marketplace.purchase.reservedAt": null,
            "marketplace.purchase.expiresAt": null,
          },
        }
      );
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function verifyPurchasePayment(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: "Please sign in to confirm payment." });
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (![orderId, paymentId, signature].every((value) => typeof value === "string" && value.length > 0)) {
      return res.status(400).json({ error: "Payment confirmation is incomplete." });
    }

    const attempt = await PurchaseAttempt.findOne({ razorpayOrderId: orderId, buyer: req.user._id });
    if (!attempt) return res.status(404).json({ error: "Payment attempt not found." });
    if (attempt.status === "paid") return res.json({ status: "sold", message: "Payment was already confirmed." });

    if (!verifyCheckoutSignature(orderId, paymentId, signature, process.env.RAZORPAY_KEY_SECRET)) {
      return res.status(400).json({ error: "Razorpay payment signature is invalid." });
    }

    const payment = await getRazorpay().payments.fetch(paymentId);
    if (payment.order_id !== orderId || payment.status !== "captured" ||
      payment.amount !== attempt.amountMinor || payment.currency !== attempt.currency) {
      return res.status(400).json({ error: "The Razorpay payment is not captured for this purchase." });
    }

    const now = new Date();
    const post = await Post.findOne({
      _id: attempt.post,
      "marketplace.purchase.status": "reserved",
      "marketplace.purchase.buyer": req.user._id,
      "marketplace.purchase.razorpayOrderId": orderId,
      "marketplace.purchase.expiresAt": { $gt: now },
      "marketplace.status": "available",
    });
    if (!post) {
      await refundLatePayment(attempt, payment);
      return res.status(409).json({ error: "The reservation expired. Razorpay has been asked to refund this payment." });
    }

    const result = await Post.updateOne(
      {
        _id: post._id,
        "marketplace.status": "available",
        "marketplace.purchase.status": "reserved",
        "marketplace.purchase.buyer": req.user._id,
        "marketplace.purchase.razorpayOrderId": orderId,
        "marketplace.purchase.expiresAt": { $gt: now },
      },
      {
        $set: {
          "marketplace.status": "sold",
          "marketplace.purchase.status": "sold",
          "marketplace.purchase.razorpayPaymentId": paymentId,
          "marketplace.purchase.purchasedAt": now,
        },
      }
    );
    if (!result.modifiedCount) {
      if (await wasPurchaseFulfilled(attempt, paymentId)) {
        await markPurchaseAttemptPaid(attempt, paymentId, now);
        return res.json({ status: "sold", message: "Payment was already confirmed." });
      }
      await refundLatePayment(attempt, payment);
      return res.status(409).json({ error: "The reservation changed. Razorpay has been asked to refund this payment." });
    }
    await markPurchaseAttemptPaid(attempt, paymentId, now);
    res.json({ status: "sold", message: "Payment confirmed. The listing is yours." });
  } catch (err) {
    next(err);
  }
}

async function wasPurchaseFulfilled(attempt, paymentId) {
  return Boolean(await Post.exists({
    _id: attempt.post,
    "marketplace.status": "sold",
    "marketplace.purchase.status": "sold",
    "marketplace.purchase.buyer": attempt.buyer,
    "marketplace.purchase.razorpayOrderId": attempt.razorpayOrderId,
    "marketplace.purchase.razorpayPaymentId": paymentId,
  }));
}

async function markPurchaseAttemptPaid(attempt, paymentId, paidAt) {
  await PurchaseAttempt.updateOne(
    { _id: attempt._id, status: { $in: ["created", "refunding"] } },
    { $set: { status: "paid", razorpayPaymentId: paymentId, paidAt } }
  );
}

async function refundLatePayment(attempt, payment) {
  if (attempt.status === "refunded") return;
  const claimed = await PurchaseAttempt.findOneAndUpdate(
    { _id: attempt._id, status: "created" },
    { $set: { status: "refunding", razorpayPaymentId: payment.id } },
    { new: true }
  );
  if (!claimed) return;
  try {
    await getRazorpay().payments.refund(payment.id, { amount: payment.amount });
    await PurchaseAttempt.updateOne(
      { _id: attempt._id, status: "refunding" },
      { $set: { status: "refunded" } }
    );
  } catch (err) {
    await PurchaseAttempt.updateOne(
      { _id: attempt._id, status: "refunding" },
      { $set: { status: "created" } }
    );
    throw err;
  }
}

async function handleRazorpayWebhook(req, res, next) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.get("x-razorpay-signature");
    if (!secret || !signature || !Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: "Razorpay webhook is not configured or is malformed." });
    }
    if (!verifyWebhookSignature(req.body, signature, secret)) {
      return res.status(400).json({ error: "Invalid Razorpay webhook signature." });
    }

    const event = JSON.parse(req.body.toString("utf8"));
    if (event.event !== "payment.captured") return res.sendStatus(200);
    const payment = event.payload?.payment?.entity;
    if (!payment?.order_id || !payment?.id || payment.status !== "captured") {
      return res.status(400).json({ error: "Malformed payment.captured webhook." });
    }
    const attempt = await PurchaseAttempt.findOne({ razorpayOrderId: payment.order_id });
    if (!attempt || attempt.status !== "created") return res.sendStatus(200);
    if (payment.amount !== attempt.amountMinor || payment.currency !== attempt.currency) {
      return res.status(400).json({ error: "Webhook payment does not match the purchase." });
    }

    const now = new Date();
    const result = await Post.updateOne(
      {
        _id: attempt.post,
        "marketplace.status": "available",
        "marketplace.purchase.status": "reserved",
        "marketplace.purchase.buyer": attempt.buyer,
        "marketplace.purchase.razorpayOrderId": payment.order_id,
        "marketplace.purchase.expiresAt": { $gt: now },
      },
      {
        $set: {
          "marketplace.status": "sold",
          "marketplace.purchase.status": "sold",
          "marketplace.purchase.razorpayPaymentId": payment.id,
          "marketplace.purchase.purchasedAt": now,
        },
      }
    );
    if (result.modifiedCount) {
      await markPurchaseAttemptPaid(attempt, payment.id, now);
      return res.sendStatus(200);
    }

    if (await wasPurchaseFulfilled(attempt, payment.id)) {
      await markPurchaseAttemptPaid(attempt, payment.id, now);
      return res.sendStatus(200);
    }
    await refundLatePayment(attempt, payment);
    res.sendStatus(200);
  } catch (err) {
    if (err instanceof SyntaxError) return res.status(400).json({ error: "Invalid Razorpay webhook JSON." });
    next(err);
  }
}

async function addReply(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Please sign in to reply." });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found." });
    }

    const content = clean(req.body?.content);
    const parentReplyId = req.body?.parentReplyId ? mongoose.Types.ObjectId.isValid(req.body.parentReplyId) ? req.body.parentReplyId : null : null;

    if (!content || content.length < 1 || content.length > 500) {
      return res.status(400).json({ error: "Reply must be 1 to 500 characters." });
    }

    if (parentReplyId) {
      const parent = (post.replies || []).find((reply) => String(reply._id) === String(parentReplyId));
      if (!parent) {
        return res.status(400).json({ error: "That reply no longer exists." });
      }
    }

    const reply = {
      _id: new mongoose.Types.ObjectId(),
      user: req.user._id,
      author: req.user.displayName,
      content,
      parentReplyId: parentReplyId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    post.replies = [...(post.replies || []), reply];
    await post.save();

    res.status(201).json({ reply });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPosts,
  createPost,
  addReply,
  reservePurchase,
  verifyPurchasePayment,
  handleRazorpayWebhook,
  CURRENCY,
};
