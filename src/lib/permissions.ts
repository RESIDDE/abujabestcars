// ─── Role & Page Definitions ────────────────────────────────────────────────

export type AppRole = "admin" | "sales" | "mechanic";

export type PageKey =
  | "dashboard"
  | "vehicles"
  | "customers"
  | "sales"
  | "inquiries"
  | "authority-to-sell"
  | "performance-quotes"
  | "expenses";

export const ALL_PAGES: { key: PageKey; label: string; path: string }[] = [
  { key: "dashboard",          label: "Dashboard",        path: "/dashboard" },
  { key: "vehicles",           label: "Lamido Vehicles",  path: "/vehicles" },
  { key: "customers",          label: "Customers",        path: "/customers" },
  { key: "sales",              label: "Sales",            path: "/sales" },
  { key: "inquiries",          label: "Inquiries",        path: "/inquiries" },
  { key: "authority-to-sell",  label: "Auth. Form",       path: "/authority-to-sell" },
  { key: "performance-quotes", label: "Proforma Invoices", path: "/performance-quotes" },
  { key: "expenses",           label: "Company Expenses", path: "/expenses" },
];

export const ADMIN_PAGES: PageKey[] = ALL_PAGES.map((p) => p.key);

export type PermissionsMap = Record<
  AppRole,
  { view: PageKey[]; create: PageKey[]; edit: PageKey[] }
>;

export const DEFAULT_PERMISSIONS: PermissionsMap = {
  admin: {
    view: ALL_PAGES.map((p) => p.key),
    create: ALL_PAGES.map((p) => p.key),
    edit: ALL_PAGES.map((p) => p.key),
  },
  sales: {
    view: ["dashboard", "vehicles", "customers", "sales", "inquiries", "performance-quotes", "authority-to-sell", "expenses"],
    create: ["vehicles", "customers", "sales", "inquiries", "performance-quotes", "authority-to-sell", "expenses"],
    edit: ["vehicles", "customers", "sales", "inquiries", "performance-quotes", "authority-to-sell", "expenses"],
  },
  mechanic: {
    view: ["dashboard", "vehicles", "expenses"],
    create: ["vehicles", "expenses"],
    edit: ["vehicles", "expenses"],
  },
};

// ─── Pure helper functions (accept a permissions map — no localStorage) ───────

/**
 * Returns true if the given role can VIEW the given page.
 * - null role (pending) = no access
 * - admin / super_admin = always full access
 * - others = check permissions map
 */
export function canAccess(
  role: AppRole | null,
  page: PageKey,
  permissions: PermissionsMap = DEFAULT_PERMISSIONS
): boolean {
  if (!role) return false;
  if (role === "admin" || (role as string) === "super_admin") return true;
  const rolePerms = (permissions as any)?.[role];
  if (!rolePerms) return false;
  return Boolean((rolePerms.view ?? []).includes(page));
}

/**
 * Returns true if the given role can CREATE (ADD) on the given page.
 * - null role (pending) = no access
 * - admin / super_admin = always full access
 */
export function canCreate(
  role: AppRole | null,
  page: PageKey,
  permissions: PermissionsMap = DEFAULT_PERMISSIONS
): boolean {
  if (!role) return false;
  if (role === "admin" || (role as string) === "super_admin") return true;
  const rolePerms = (permissions as any)?.[role];
  if (!rolePerms) return false;
  return Boolean((rolePerms.create ?? []).includes(page));
}

/**
 * Returns true if the given role can EDIT on the given page.
 * - null role (pending) = no access
 * - admin / super_admin = always full access
 */
export function canEdit(
  role: AppRole | null,
  page: PageKey,
  permissions: PermissionsMap = DEFAULT_PERMISSIONS
): boolean {
  if (!role) return false;
  if (role === "admin" || (role as string) === "super_admin") return true;
  const rolePerms = (permissions as any)?.[role];
  if (!rolePerms) return false;
  return Boolean((rolePerms.edit ?? []).includes(page));
}

/**
 * Returns the list of pages accessible (viewable) by this role.
 * - null role (pending) = empty list
 * - admin / super_admin = all pages
 */
export function getAccessiblePages(
  role: AppRole | null,
  permissions: PermissionsMap = DEFAULT_PERMISSIONS
): PageKey[] {
  if (!role) return [];
  if (role === "admin" || (role as string) === "super_admin") return ADMIN_PAGES;
  const rolePerms = (permissions as any)?.[role];
  return rolePerms?.view ?? [];
}
