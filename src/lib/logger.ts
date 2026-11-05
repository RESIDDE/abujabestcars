import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "SIGNUP"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "EXPORT"
  | "PRINT"
  | "VIEW"
  | "SEARCH"
  | "STATUS_CHANGE"
  | "PERMISSION_CHANGE"
  | "ROLE_CHANGE"
  | "INVITE"
  | "SIGNATURE"
  | "PAYMENT"
  | "OTHER";

export async function logAction(
  action: AuditAction,
  entityType: string,
  entityId?: string | null,
  details?: Record<string, any>,
  userIdOverride?: string
) {
  try {
    const sessionRes = await supabase.auth.getSession();
    const currentUser = sessionRes.data.session?.user;
    const userId = userIdOverride || currentUser?.id;

    let userName: string | undefined = currentUser?.user_metadata?.full_name || currentUser?.email?.split("@")[0];
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();
      if (profile?.display_name?.trim()) {
        userName = profile.display_name.trim();
      }
    }

    await (supabase as any).from("audit_logs").insert({
      user_id: userId || null,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      details: {
        ...(details || {}),
        ...(userName ? { _user_name: userName } : {}),
      },
    });
  } catch (error) {
    console.error("Failed to log action:", error);
  }
}

/** Convenience: human-readable description of an audit log row */
export function describeLog(log: any): string {
  const action = log.action as AuditAction;
  const entity = log.entity_type ?? "";
  const name = log.details?._user_name ?? log.profiles?.display_name ?? "Someone";
  const d = log.details ?? {};

  switch (action) {
    case "LOGIN":       return `${name} logged in`;
    case "LOGOUT":      return `${name} logged out`;
    case "SIGNUP":      return `${name} created an account`;

    case "CREATE":
      if (entity === "Vehicle") return `${name} added vehicle — ${d.make ?? ""} ${d.model ?? ""} ${d.year ?? ""}`.trim();
      if (entity === "Customer") return `${name} added customer — ${d.name ?? ""}`;
      if (entity === "Sales") return `${name} recorded a sale — ${d.vehicle ?? ""}`;
      if (entity === "Invoice") return `${name} created invoice ${d.invoice_number ?? ""}`;
      if (entity === "Inquiry") return `${name} logged inquiry from ${d.customer ?? ""}`;
      if (entity === "Inspection") return `${name} recorded inspection for ${d.vehicle ?? ""}`;
      if (entity === "Repair") return `${name} opened repair job — ${d.vehicle ?? ""}`;
      if (entity === "Authority to Sell") return `${name} created Authority to Sell for ${d.customer ?? ""}`;
      if (entity === "Proforma Quote" || entity === "Proforma Invoice") return `${name} created proforma invoice`;
      if (entity === "Document") return `${name} created document — ${d.title ?? ""}`;
      if (entity === "Expense") return `${name} recorded expense${d.count > 1 ? `s (${d.count} items, ₦${Number(d.total ?? 0).toLocaleString()})` : ` — ${d.title ?? ""}`}`;
      return `${name} created a ${entity.toLowerCase()} record`;

    case "UPDATE":
      if (entity === "Vehicle") return `${name} edited vehicle — ${d.make ?? ""} ${d.model ?? ""}`.trim();
      if (entity === "Customer") return `${name} edited customer — ${d.name ?? ""}`;
      if (entity === "Sales") return `${name} edited sale record`;
      if (entity === "Invoice") return `${name} edited invoice ${d.invoice_number ?? ""}`;
      if (entity === "Inquiry") return `${name} edited inquiry from ${d.customer ?? ""}`;
      if (entity === "Inspection") return `${name} edited inspection for ${d.vehicle ?? ""}`;
      if (entity === "Repair") return `${name} edited repair job — ${d.vehicle ?? ""}`;
      if (entity === "Authority to Sell") return `${name} edited Authority to Sell for ${d.customer ?? ""}`;
      if (entity === "Sales Agreement") return `${name} edited Sales Agreement for ${d.customer ?? ""}`;
      if (entity === "Document") return `${name} edited document — ${d.title ?? ""}`;
      if (entity === "Expense") return `${name} edited expense — ${d.title ?? ""}`;
      if (entity === "Settings" || entity === "App Settings") return `${name} updated settings`;
      return `${name} edited ${entity.toLowerCase()}`;

    case "DELETE":
      if (entity === "Vehicle") return `${name} deleted vehicle — ${d.make ?? ""} ${d.model ?? ""}`.trim();
      if (entity === "Customer") return `${name} deleted customer — ${d.name ?? ""}`;
      if (entity === "Sales") return `${name} deleted a sale record`;
      if (entity === "Invoice") return `${name} deleted invoice ${d.invoice_number ?? ""}`;
      if (entity === "Inquiry") return `${name} deleted inquiry from ${d.customer ?? ""}`;
      if (entity === "Inspection") return `${name} deleted inspection for ${d.vehicle ?? ""}`;
      if (entity === "Repair") return `${name} deleted repair job`;
      if (entity === "Document") return `${name} deleted document — ${d.title ?? ""}`;
      if (entity === "Expense") return `${name} deleted expense`;
      return `${name} deleted a ${entity.toLowerCase()} record`;

    case "EXPORT":      return `${name} exported ${d.format ?? "file"} — ${entity} ${d.count ? `(${d.count} rows)` : ""}`.trim();
    case "PRINT":       return `${name} printed ${entity} ${d.ref || d.title ? `— ${d.ref || d.title}` : ""}`.trim();
    case "VIEW":        return `${name} viewed ${entity} ${d.ref ?? ""}`.trim();
    case "SEARCH":      return `${name} searched ${entity} — "${d.query ?? ""}"`;
    case "STATUS_CHANGE": return `${name} changed status of ${entity} to "${d.new_status ?? ""}"`;
    case "PERMISSION_CHANGE": return `${name} updated role permissions`;
    case "ROLE_CHANGE": return `${name} changed ${d.target_name ?? "a user"}'s role to ${d.new_role ?? ""}`;
    case "INVITE":      return `${name} invited ${d.invited_name ?? "a new user"} (${d.assigned_role ?? ""})`;
    case "SIGNATURE":   return `${name} signed ${entity} ${d.ref ?? ""}`.trim();
    case "PAYMENT":     return `${name} recorded payment of ${d.amount ?? ""} on ${entity}`;
    default:            return `${name} performed ${action} on ${entity}`;
  }
}
