import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  const adapter = new PrismaPg({
    connectionString: connectionString ?? "",
    ssl: connectionString?.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  return new PrismaClient({ adapter });
}

export const db =
  globalForPrisma.prisma ??
  createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
