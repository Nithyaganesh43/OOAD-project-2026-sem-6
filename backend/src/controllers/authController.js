const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { isNonEmptyString } = require("../utils/validators");

const buildToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+password"
  );

  if (!user || !user.isActive) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = buildToken(user);

  res.json({
    message: "Login successful",
    token,
    user: user.toJSON(),
  });
});

const getCurrentUser = asyncHandler(async (req, res) => {
  res.json({
    user: req.user,
  });
});

module.exports = {
  login,
  getCurrentUser,
};
