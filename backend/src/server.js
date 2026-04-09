const app = require("./app");
const env = require("./config/env");
const connectDatabase = require("./config/db");
const seedDefaultAdmin = require("./services/adminSeedService");

const startServer = async () => {
  try {
    await connectDatabase();
    await seedDefaultAdmin();

    await new Promise((resolve, reject) => {
      const server = app.listen(env.port, () => {
        console.log(`Server running on port ${env.port}`);
        resolve(server);
      });

      server.on("error", reject);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

startServer();
