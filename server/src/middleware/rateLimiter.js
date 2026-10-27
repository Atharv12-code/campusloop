const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;
const store = new Map();

function rateLimit(options = {}) {
  const windowMs = options.windowMs || WINDOW_MS;
  const maxRequests = options.maxRequests || MAX_REQUESTS;

  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const entry = store.get(key) || { count: 0, resetAt: now + windowMs };

    if (now >= entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: "Too many attempts. Please wait a few minutes and try again.",
      });
    }

    store.set(key, entry);
    next();
  };
}

module.exports = { rateLimit };
