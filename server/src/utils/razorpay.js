const Razorpay = require("razorpay");
const crypto = require("crypto");

function isRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());
}

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    const error = new Error("Razorpay API keys are not configured.");
    error.statusCode = 503;
    throw error;
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function verifySignature(body, signature, secret) {
  if (!Buffer.isBuffer(body) || typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature) || typeof secret !== "string" || !secret) {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function verifyCheckoutSignature(orderId, paymentId, signature, secret) {
  if (typeof orderId !== "string" || typeof paymentId !== "string") return false;
  return verifySignature(Buffer.from(`${orderId}|${paymentId}`), signature, secret);
}

function verifyWebhookSignature(body, signature, secret) {
  return verifySignature(body, signature, secret);
}

module.exports = {
  getRazorpay,
  isRazorpayConfigured,
  verifyCheckoutSignature,
  verifyWebhookSignature,
};
