function notFound(req, res) {
  res.status(404).json({ error: "Not found." });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Malformed JSON or oversized body from express.json()
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large." });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Each image must be 5MB or smaller." });
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ error: "Unexpected file field in upload." });
  }
  if (err.statusCode === 400) {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: "Invalid post data." });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: "A record with those details already exists." });
  }

  console.error("Unexpected error:", err.message);
  res.status(500).json({ error: "Something went wrong. Please try again." });
}

module.exports = { notFound, errorHandler };
