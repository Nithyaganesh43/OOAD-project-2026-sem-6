const express = require("express");
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectKanban,
  getProjectGantt,
} = require("../controllers/projectController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.route("/").get(getProjects).post(authorize("admin"), createProject);
router.get("/:projectId/kanban", getProjectKanban);
router.get("/:projectId/gantt", getProjectGantt);
router
  .route("/:projectId")
  .get(getProjectById)
  .patch(authorize("admin"), updateProject)
  .delete(authorize("admin"), deleteProject);

module.exports = router;
