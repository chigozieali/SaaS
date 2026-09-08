import { seedPermissions } from "@/lib/onboarding";
import { seedDemoData } from "@/lib/demo-seed";
import { db } from "@/lib/prisma";

async function main() {
  await seedPermissions();
  console.log("Seeded permission catalog.");

  await seedDemoData();
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });