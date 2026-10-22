import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { clientMemberRoleLabel } from "../src/lib/clientMemberRoleLabel.ts";
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("stored Super Admin/legacy owner roles are never displayed as Member", () => {
  for (const role of ["super_admin", "superadmin", "Super Admin", "super-admin", " SUPER_ADMIN ", "owner"]) {
    assert.equal(clientMemberRoleLabel(role), "Super Admin");
  }
  for (const role of ["manager", "admin", " Manager "]) assert.equal(clientMemberRoleLabel(role), "Manager");
  for (const role of ["member", null, undefined, "unknown"]) assert.equal(clientMemberRoleLabel(role), "Member");
});
test("role label is presentation-only and does not expand assignable roles", () => {
  const page = read("src/pages/dashboard/MembersPage.tsx");
  assert.match(page, /role: clientMemberRoleLabel\(item.role\)/);
  assert.match(page, /type AssignableMemberRole = "Manager" \| "Member"/);
  assert.match(page, /useState<AssignableMemberRole>\("Member"\)/);
  assert.doesNotMatch(page, /<option value="Super Admin"/);
  assert.match(page, /role: role.toLowerCase\(\)/);
  assert.match(page, /isMemberManagerFallbackRole\(selectedMembershipRole\)/);
});
test("admin-created client still requests Super Admin using the existing creation flow", () => {
  const admin = read("src/pages/admin/AdminClientsPage.tsx");
  assert.match(admin, /const admin_role = "super_admin"/);
  assert.match(admin, /body: JSON.stringify\(\{[\s\S]*?admin_name,[\s\S]*?admin_email,[\s\S]*?admin_role,/);
  assert.match(admin, /placeholder="Super Admin name"/);
  assert.match(admin, /placeholder="Super Admin email"/);
});
