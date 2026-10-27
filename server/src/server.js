require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = require("./app");
const connectDB = require("./config/db");
const { getJwtSecret } = require("./utils/jwtSecret");

const PORT = process.env.PORT || 5000;

async function startServer() {
  getJwtSecret();
  await connectDB(process.env.MONGODB_URI);
  app.listen(PORT, () => {
    console.log(`CampusLoop API running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start CampusLoop API:", error.message);
  process.exit(1);
});
