import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("payroll approve action should not auto-post to accounting", () => {
  const routeSource = readFileSync(
    join(process.cwd(), "src/app/api/payroll/runs/[id]/route.ts"),
    "utf8"
  );

  const approveBlock = routeSource.match(/case "approve": \{[\s\S]*?break;\n\s*\}/)?.[0] ?? "";
  assert.ok(!/postPayrollToAccounting/.test(approveBlock), "approve branch should not trigger postPayrollToAccounting");
});
