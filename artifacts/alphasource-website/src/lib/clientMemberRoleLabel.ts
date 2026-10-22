// Presentation only. Authorization continues to use the server's scope roles.
export type ClientMemberDisplayRole = "Super Admin" | "Manager" | "Member";
export function clientMemberRoleLabel(value: unknown): ClientMemberDisplayRole {
  const role = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["super_admin", "superadmin", "owner"].includes(role)) return "Super Admin";
  if (role === "manager" || role === "admin") return "Manager";
  return "Member";
}
