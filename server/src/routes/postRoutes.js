const express = require("express");
const {
  getPosts,
  createPost,
  addReply,
  reservePurchase,
  verifyPurchasePayment,
} = require("../controllers/postController");
const { protect } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.get("/", getPosts);
router.post("/", protect, upload.array("images", 4), createPost);
router.post("/:id/purchase", protect, reservePurchase);
router.post("/:id/purchase/verify", protect, verifyPurchasePayment);
router.post("/:id/replies", protect, addReply);

module.exports = router;
