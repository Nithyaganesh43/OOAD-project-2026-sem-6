const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const WorkSession = require("../models/WorkSession");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { isNonEmptyString } = require("../utils/validators");
const { ROLES } = require("../constants/roles");

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (
    !isNonEmptyString(name) ||
    !isNonEmptyString(email) ||
    !isNonEmptyString(password)
  ) {
    throw new ApiError(400, "Name, email, and password are required");
  }

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });

  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    role: ROLES.USER,
  });

  res.status(201).json({
    message: "User created successfully",
    user,
  });
});

const getUsers = asyncHandler(async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ users });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.json({ user });
});

const updateUser = asyncHandler(async (req, res) => {
  const { name, email, password, isActive } = req.body;
  const user = await User.findById(req.params.userId).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === ROLES.ADMIN && email && email.toLowerCase().trim() !== user.email) {
    throw new ApiError(400, "Default admin email should not be changed");
  }

  if (user.role === ROLES.ADMIN && isActive === false) {
    throw new ApiError(400, "Default admin account cannot be deactivated");
  }

  if (isNonEmptyString(name)) {
    user.name = name.trim();
  }

  if (isNonEmptyString(email)) {
    const normalizedEmail = email.toLowerCase().trim();
    const duplicateUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id },
    });

    if (duplicateUser) {
      throw new ApiError(409, "A user with this email already exists");
    }

    user.email = normalizedEmail;
  }

  if (isNonEmptyString(password)) {
    user.password = password;
  }

  if (typeof isActive === "boolean") {
    user.isActive = isActive;
  }

  await user.save();

  res.json({
    message: "User updated successfully",
    user: user.toJSON(),
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === ROLES.ADMIN) {
    throw new ApiError(400, "Default admin account cannot be deleted");
  }

  const [assignedProject, assignedTask, activeSession] = await Promise.all([
    Project.findOne({ members: user._id }),
    Task.findOne({ assignee: user._id }),
    WorkSession.findOne({ user: user._id, status: "active" }),
  ]);

  if (assignedProject || assignedTask || activeSession) {
    throw new ApiError(
      400,
      "User cannot be deleted while linked to projects, tasks, or active sessions"
    );
  }

  await user.deleteOne();

  res.json({
    message: "User deleted successfully",
    deletedUser: {
      _id: user._id,
      name: user.name,
      email: user.email,
    },
  });
});

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
};
