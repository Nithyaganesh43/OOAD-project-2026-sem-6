const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const env = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const { errorHandler, notFound } = require("./middleware/errorMiddleware");

const app = express();
const spaDistPath = path.resolve(__dirname, "..", "public", "dist");
const spaIndexPath = path.join(spaDistPath, "index.html");
const hasSpaBuild = fs.existsSync(spaIndexPath);

app.use(
  cors({
    origin: env.clientUrl,
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({
    message: "Task allocation backend is running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/dashboard", dashboardRoutes);

if (hasSpaBuild) {
  app.use(express.static(spaDistPath));

  app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => {
    if (path.extname(req.path)) {
      return next();
    }

    return res.sendFile(spaIndexPath);
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
