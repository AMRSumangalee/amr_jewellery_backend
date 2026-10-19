import "dotenv/config";
import prisma from "../src/config/database.js";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Starting database seed...");

  const passwordHash = await bcrypt.hash("Admin@123", 10);

  const admin = await prisma.user.upsert({
    where: {
      username: "admin",
    },

    update: {
      name: "Super Admin",
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },

    create: {
      name: "Super Admin",
      username: "admin",
      phone: null,
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  console.log("✅ Super Admin created/updated");
  console.log({
    id: admin.id,
    name: admin.name,
    username: admin.username,
    role: admin.role,
    status: admin.status,
  });
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });