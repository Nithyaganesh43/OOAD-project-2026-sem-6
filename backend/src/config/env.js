const dotenv = require("dotenv");

dotenv.config();

const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri:
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/college-task-tracker",
  jwtSecret: process.env.JWT_SECRET || "development-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
};

module.exports = env;
