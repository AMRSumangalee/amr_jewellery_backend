
import "dotenv/config";

import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
});

const prisma = new PrismaClient({
  adapter,
});

// Temporary database diagnostic test
export async function testDatabase() {
  try {
    // Test basic MySQL query
    const result = await prisma.$queryRaw`SELECT 1 AS test`;
    console.log("✅ DATABASE QUERY TEST:", result);

    // Test Prisma User model and users table
    const userCount = await prisma.user.count();
    console.log("✅ USERS TABLE COUNT:", userCount);
  } catch (error) {
    console.error("❌ DATABASE QUERY TEST FAILED:", error);
    throw error;
  }
}

export default prisma;
