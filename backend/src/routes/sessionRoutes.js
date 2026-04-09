const express = require("express");
const {
  checkIn,
  checkOut,
  getMySessions,
  getMySessionOverview,
  getMyTodaySessions,
  getAdminSessionOverview,
} = require("../controllers/sessionController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/me", authorize("user"), getMySessions);
router.get("/me/overview", authorize("user"), getMySessionOverview);
router.get("/me/today", authorize("user"), getMyTodaySessions);
router.post("/check-in", authorize("user"), checkIn);
router.post("/:sessionId/check-out", authorize("user"), checkOut);
router.get("/admin/overview", authorize("admin"), getAdminSessionOverview);

module.exports = router;
