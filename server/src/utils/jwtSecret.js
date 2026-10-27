function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error("JWT_SECRET must be set to a random value with at least 32 characters.");
  }
  return secret.trim();
}

module.exports = { getJwtSecret };
