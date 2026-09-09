import { seedPermissions, syncSystemRolePermissions } from "../src/lib/onboarding";

async function main() {
  await seedPermissions();
  await syncSystemRolePermissions();
  console.log("Permissions seeded and system roles synced.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});