const mongoose = require("mongoose");

async function connectDB(uri) {
  if (!uri) {
    throw new Error("MONGODB_URI is missing. Add it to server/.env.");
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB Atlas");
}

module.exports = connectDB;
