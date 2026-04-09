const express = require("express");
const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorize("admin"));

router.route("/").post(createUser).get(getUsers);
router.route("/:userId").get(getUserById).patch(updateUser).delete(deleteUser);

module.exports = router;
