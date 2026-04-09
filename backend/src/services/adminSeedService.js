const User = require("../models/User");
const { ROLES } = require("../constants/roles");

const seedDefaultAdmin = async () => {
  const adminEmail = "admin@email.com";
  const adminPassword = "admin@123";

  const existingAdmin = await User.findOne({ email: adminEmail });

  if (existingAdmin) {
    return existingAdmin;
  }

  const admin = await User.create({
    name: "Default Admin",
    email: adminEmail,
    password: adminPassword,
    role: ROLES.ADMIN,
  });

  console.log("Default admin account seeded: admin@email.com / admin@123");
  return admin;
};

module.exports = seedDefaultAdmin;
