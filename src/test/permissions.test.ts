import { describe, it, expect } from "vitest";
import {
  canAccess,
  canCreate,
  canEdit,
  canDelete,
  getAccessiblePages,
  DEFAULT_PERMISSIONS,
  ALL_PAGES,
  ADMIN_PAGES,
  type PermissionsMap,
} from "@/lib/permissions";

describe("Role-based permissions enforcement", () => {
  it("denies all access for null or pending role", () => {
    expect(canAccess(null, "dashboard")).toBe(false);
    expect(canAccess(null, "vehicles")).toBe(false);
    expect(canAccess(null, "sales")).toBe(false);
    expect(canCreate(null, "vehicles")).toBe(false);
    expect(canEdit(null, "vehicles")).toBe(false);
    expect(getAccessiblePages(null)).toEqual([]);
  });

  it("grants full access to admin role", () => {
    expect(canAccess("admin", "dashboard")).toBe(true);
    expect(canAccess("admin", "vehicles")).toBe(true);
    expect(canAccess("admin", "sales")).toBe(true);
    expect(canCreate("admin", "sales")).toBe(true);
    expect(canEdit("admin", "sales")).toBe(true);
    expect(getAccessiblePages("admin")).toEqual(ADMIN_PAGES);
  });

  it("restricts mechanic role to only configured pages", () => {
    // Mechanic defaults: view ["dashboard", "vehicles", "expenses"]
    expect(canAccess("mechanic", "vehicles")).toBe(true);
    expect(canAccess("mechanic", "expenses")).toBe(true);
    expect(canAccess("mechanic", "dashboard")).toBe(true);

    // Restricted pages
    expect(canAccess("mechanic", "sales")).toBe(false);
    expect(canAccess("mechanic", "customers")).toBe(false);
    expect(canAccess("mechanic", "inquiries")).toBe(false);
    expect(canAccess("mechanic", "performance-quotes")).toBe(false);
    expect(canAccess("mechanic", "authority-to-sell")).toBe(false);

    // Mechanic accessible pages should not include restricted pages
    const pages = getAccessiblePages("mechanic");
    expect(pages).toContain("vehicles");
    expect(pages).toContain("expenses");
    expect(pages).not.toContain("sales");
    expect(pages).not.toContain("customers");
  });

  it("restricts actions when role has custom permissions matrix", () => {
    const customPerms: PermissionsMap = {
      admin: DEFAULT_PERMISSIONS.admin,
      sales: {
        view: ["vehicles", "customers"],
        create: ["customers"],
        edit: [],
        delete: [],
      },
      mechanic: {
        view: ["vehicles"],
        create: [],
        edit: [],
        delete: [],
      },
    };

    expect(canAccess("sales", "sales", customPerms)).toBe(false);
    expect(canAccess("sales", "vehicles", customPerms)).toBe(true);
    expect(canCreate("sales", "vehicles", customPerms)).toBe(false);
    expect(canCreate("sales", "customers", customPerms)).toBe(true);
    expect(canEdit("sales", "customers", customPerms)).toBe(false);
    expect(getAccessiblePages("sales", customPerms)).toEqual(["vehicles", "customers"]);
  });

  it("treats delete as its own permission, not implied by edit", () => {
    const perms: PermissionsMap = {
      admin: DEFAULT_PERMISSIONS.admin,
      sales: {
        view: ["vehicles", "customers"],
        create: ["vehicles", "customers"],
        edit: ["vehicles", "customers"],
        delete: ["customers"],
      },
      mechanic: {
        view: ["vehicles"],
        create: [],
        edit: [],
        delete: [],
      },
    };

    // Edit on vehicles must NOT grant delete on vehicles.
    expect(canEdit("sales", "vehicles", perms)).toBe(true);
    expect(canDelete("sales", "vehicles", perms)).toBe(false);

    // Delete granted explicitly.
    expect(canDelete("sales", "customers", perms)).toBe(true);

    // Roles with nothing granted cannot delete.
    expect(canDelete("mechanic", "vehicles", perms)).toBe(false);

    // Admin always can.
    expect(canDelete("admin", "sales", perms)).toBe(true);

    // No role at all.
    expect(canDelete(null, "vehicles", perms)).toBe(false);
  });

  it("gives no role delete rights by default except admin", () => {
    expect(canDelete("admin", "vehicles")).toBe(true);
    expect(canDelete("sales", "vehicles")).toBe(false);
    expect(canDelete("mechanic", "vehicles")).toBe(false);
  });
});
