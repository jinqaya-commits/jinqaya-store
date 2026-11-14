import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("private after-sales evidence requires staff authorization and order-scoped case lookup", async () => {
  const route = await readFile(new URL("src/app/api/admin/orders/[id]/after-sales/[caseId]/evidence/route.ts", root), "utf8");
  assert.match(route, /auth\.getClaims\(\)/);
  assert.match(route, /can_manage_catalog/);
  assert.match(route, /\.eq\("id",caseId\)\.eq\("order_id",id\)/);
  assert.match(route, /startsWith\(\`after-sales\/\$\{id\}\/\`\)/);
});

test("private evidence access is short-lived and recorded before links are returned", async () => {
  const evidence = await readFile(new URL("src/lib/after-sales-evidence.ts", root), "utf8");
  const route = await readFile(new URL("src/app/api/admin/orders/[id]/after-sales/[caseId]/evidence/route.ts", root), "utf8");
  assert.match(evidence, /GetObjectCommand/);
  assert.match(evidence, /expiresIn:300/);
  assert.match(route, /event_type:"evidence_accessed"/);
  assert.match(route, /link_ttl_seconds:300/);
  assert.ok(route.indexOf("auditError") < route.indexOf("return NextResponse.json({evidence})"));
});

test("orphan cleanup excludes evidence attached to a case", async () => {
  const cron = await readFile(new URL("src/app/api/cron/after-sales-cleanup/route.ts", root), "utf8");
  const migrationFiles = await (async () => {
    const { readdir } = await import("node:fs/promises");
    const names = await readdir(new URL("supabase/migrations/", root));
    return Promise.all(names.filter(n => n.includes("after_sales") || n.includes("after-sales")).map(n => readFile(new URL("supabase/migrations/" + n, root), "utf8")));
  })();
  assert.match(cron, /authorization!==\`Bearer \$\{secret\}\`/);
  assert.ok(migrationFiles.some(sql => /not exists\s*\(\s*select 1 from public\.after_sales_cases c where t\.object_key=any\(c\.evidence_urls\)/is.test(sql)));
});
