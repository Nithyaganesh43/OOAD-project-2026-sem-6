const express = require("express");
const {
  getTasks,
  createTask,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
} = require("../controllers/taskController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.route("/").get(getTasks).post(authorize("admin"), createTask);
router.patch("/:taskId/status", updateTaskStatus);
router
  .route("/:taskId")
  .get(getTaskById)
  .patch(authorize("admin"), updateTask)
  .delete(authorize("admin"), deleteTask);

module.exports = router;
