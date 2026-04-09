const express = require("express");
const {
  getAdminDashboard,
  getUserDashboard,
} = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/admin", protect, authorize("admin"), getAdminDashboard);
router.get("/user", protect, authorize("user"), getUserDashboard);

module.exports = router;
