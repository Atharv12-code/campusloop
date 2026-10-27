const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const {
  isRazorpayConfigured,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} = require("../src/utils/razorpay");

const secret = "test-webhook-secret";

function sign(message, key = secret) {
  return crypto.createHmac("sha256", key).update(message).digest("hex");
}

test("accepts a valid Razorpay checkout signature", () => {
  const orderId = "order_test123";
  const paymentId = "pay_test456";
  assert.equal(
    verifyCheckoutSignature(orderId, paymentId, sign(`${orderId}|${paymentId}`), secret),
    true
  );
});

test("rejects a modified checkout signature and malformed signatures", () => {
  assert.equal(verifyCheckoutSignature("order_test123", "pay_test456", "bad", secret), false);
  assert.equal(
    verifyCheckoutSignature("order_test123", "pay_test456", sign("different|payment"), secret),
    false
  );
});

test("validates the raw webhook body with its separate secret", () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  const signature = sign(body);
  assert.equal(verifyWebhookSignature(body, signature, secret), true);
  assert.equal(verifyWebhookSignature(body, signature, "another-secret"), false);
  assert.equal(verifyWebhookSignature(JSON.parse(body), signature, secret), false);
});

test("Checkout configuration requires API keys but not a webhook secret", () => {
  const previous = {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  };

  try {
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "api-secret";
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    assert.equal(isRazorpayConfigured(), true);

    process.env.RAZORPAY_KEY_SECRET = " ";
    assert.equal(isRazorpayConfigured(), false);
  } finally {
    if (previous.keyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = previous.keyId;
    if (previous.keySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = previous.keySecret;
    if (previous.webhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previous.webhookSecret;
  }
});
