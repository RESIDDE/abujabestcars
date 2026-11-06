import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Shield, ShieldCheck, User, Users, Settings2,
  Pencil, Plus, RotateCcw, Lock, Activity,
  UserPlus, ArrowRightLeft, AlertTriangle, Trash2, ArrowLeft, Bell, Save, Car, Check,
  Search, Download, RefreshCw, Filter,
} from "lucide-react";
import {
  ALL_PAGES, DEFAULT_PERMISSIONS, PERMISSION_ACTIONS,
  type AppRole, type PageKey, type PermissionsMap, type PermissionAction,
} from "@/lib/permissions";
import { logAction, describeLog } from "@/lib/logger";
import { exportToExcel } from "@/lib/exportHelpers";

type Tab = "team" | "permissions" | "audit";

const DEFAULT_ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sales: "Sales",
  mechanic: "Mechanic",
  super_admin: "Super Admin",
  pending: "Pending Approval",
};

const getRoleDisplayLabel = (roleKey: string, customLabels?: Record<string, string>) => {
  if (customLabels && customLabels[roleKey]) return customLabels[roleKey];
  if (DEFAULT_ROLE_LABELS[roleKey]) return DEFAULT_ROLE_LABELS[roleKey];
  return roleKey.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  super_admin: { label: "Super Admin", color: "text-primary font-bold", icon: <ShieldCheck className="w-3.5 h-3.5 text-primary" /> },
  admin: { label: "Admin", color: "text-emerald-600 dark:text-emerald-400 font-semibold", icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> },
  sales: { label: "Sales", color: "text-sky-600 dark:text-sky-400 font-semibold", icon: <User className="w-3.5 h-3.5 text-sky-500" /> },
  mechanic: { label: "Mechanic", color: "text-violet-600 dark:text-violet-400 font-semibold", icon: <Settings2 className="w-3.5 h-3.5 text-violet-500" /> },
  pending: { label: "Pending", color: "text-rose-600 dark:text-rose-400 font-semibold", icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> },
};

const ACTION_TOGGLE_STYLES: Record<string, string> = {
  view:   "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/25",
  create: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25",
  edit:   "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/25",
  delete: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/25",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  UPDATE: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
  DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
  LOGIN: "bg-muted text-foreground border border-border",
  LOGOUT: "bg-muted text-muted-foreground border border-border",
  SIGNUP: "bg-muted text-foreground border border-border",
  INVITE: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20",
  ROLE_CHANGE: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
  EXPORT: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
  PRINT: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20",
  VIEW: "bg-muted text-muted-foreground",
  SEARCH: "bg-muted text-muted-foreground",
  STATUS_CHANGE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  PERMISSION_CHANGE: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
  PAYMENT: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  SIGNATURE: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20",
};

// Isolated Supabase client for inviting users without blowing away super admin's session
const anonClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export default function Settings() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("team");

  // Live permissions from Supabase
  const {
    permissions: livePermissions,
    savePermissions: savePermsToSupabase,
    isSaving,
  } = usePermissions();
  const [localPermissions, setLocalPermissions] = useState<PermissionsMap | null>(null);
  const [permDirty, setPermDirty] = useState(false);
  const permissions = localPermissions ?? livePermissions;

  // Dynamic Role Labels State
  const [customRoleLabels, setCustomRoleLabels] = useState<Record<string, string>>({});

  // Create Role State
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);

  // Rename Role State
  const [renameRoleOpen, setRenameRoleOpen] = useState(false);
  const [targetRoleKey, setTargetRoleKey] = useState("");
  const [renameRoleName, setRenameRoleName] = useState("");
  const [renamingRole, setRenamingRole] = useState(false);

  // Invite User State
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm, clearInviteDraft] = useFormPersistence("invite-user", { email: "", displayName: "", password: "", role: "mechanic" }, false);
  const [inviting, setInviting] = useState(false);

  // Transfer Super Admin State
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferDowngradeTo, setTransferDowngradeTo] = useState("admin");
  const [transferring, setTransferring] = useState(false);

  // Delete User State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Service Interval State
  const [serviceInterval, setServiceInterval] = useState<string>("3");
  const [serviceIntervalDays, setServiceIntervalDays] = useState<string>("0");
  const [intervalSaving, setIntervalSaving] = useState(false);

  const claimSuperAdmin = async () => {
    if (!user) return toast.error("Not logged in");
    const { error } = await (supabase as any)
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id" });
    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success("Admin role granted! Reloading...");
      setTimeout(() => window.location.reload(), 900);
    }
  };

  // Access check fallback
  if (role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 animate-fade-up px-4">
        <div className="p-5 bg-card border border-border rounded-3xl shadow-sm">
          <ShieldCheck className="w-12 h-12 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Claim Admin Access</h2>
          <p className="text-muted-foreground max-w-sm text-xs">
            You don't have an admin role assigned yet. Click below to claim Admin access for your account.
          </p>
        </div>
        <Button
          className="rounded-xl px-8 h-11 text-xs font-semibold shadow-sm transition-all"
          onClick={() => claimSuperAdmin()}
        >
          Claim Admin Access
        </Button>
      </div>
    );
  }

  // Load App Settings
  useEffect(() => {
    async function loadSettings() {
      const { data, error } = await (supabase as any).from("app_settings").select("*");
      if (data && !error) {
        data.forEach((item: any) => {
          if (item.key === "service_interval_months" && item.value) setServiceInterval(item.value);
          if (item.key === "service_interval_days" && item.value) setServiceIntervalDays(item.value);
          if (item.key === "role_labels" && item.value) {
            try {
              setCustomRoleLabels(JSON.parse(item.value));
            } catch (e) {}
          }
        });
      }
    }
    loadSettings();
  }, []);

  // Fetch Users & Roles
  const { data: usersData = [], isLoading } = useQuery({
    queryKey: ["users-roles"],
    queryFn: async () => {
      const [rolesRes, profilesRes] = await Promise.all([
        (supabase as any).from("user_roles").select("*"),
        (supabase as any).from("profiles").select("*"),
      ]);

      if (rolesRes.error) {
        console.error("Error fetching user_roles:", rolesRes.error);
        throw rolesRes.error;
      }

      const roles = rolesRes.data || [];
      const profiles = profilesRes.data || [];

      // Build dictionary of profiles
      const profileMap = new Map<string, any>();
      profiles.forEach((p: any) => {
        if (p.user_id) profileMap.set(p.user_id, p);
        if (p.id) profileMap.set(p.id, p);
      });

      // Combine user_roles with profile metadata
      const list = roles.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        profile: profileMap.get(r.user_id) || null,
      }));

      // Include profiles that do not have a user_roles entry yet
      profiles.forEach((p: any) => {
        const uid = p.user_id || p.id;
        if (uid && !list.some((u: any) => u.user_id === uid)) {
          list.push({
            id: `temp-${uid}`,
            user_id: uid,
            role: "pending",
            profile: p,
          });
        }
      });

      return list;
    },
  });

  const { data: repairs = [] } = useQuery({
    queryKey: ["repairs"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("repairs").select("id, vehicle_id, customer_id, repair_date, vehicle_make, vehicle_year_model");
      return data || [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("customers").select("id, name, phone");
      return data || [];
    },
  });

  // Audit Logs State & Query
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");

  const { data: logs = [], isLoading: isLoadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const [logsRes, profilesRes] = await Promise.all([
        (supabase as any)
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300),
        (supabase as any).from("profiles").select("*"),
      ]);

      if (logsRes.error) {
        console.error("Error fetching audit_logs:", logsRes.error);
        throw logsRes.error;
      }

      const rawLogs = logsRes.data || [];
      const profiles = profilesRes.data || [];
      const profileMap = new Map<string, any>();
      profiles.forEach((p: any) => {
        if (p.user_id) profileMap.set(p.user_id, p);
        if (p.id) profileMap.set(p.id, p);
      });

      return rawLogs.map((log: any) => ({
        ...log,
        profiles: log.user_id ? profileMap.get(log.user_id) : null,
      }));
    },
    enabled: tab === "audit",
  });

  // Subscribe to live audit log inserts in real-time
  useEffect(() => {
    if (tab !== "audit") return;
    const channel = supabase
      .channel("audit_logs_realtime_stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["audit_logs"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tab, queryClient]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log: any) => {
      const matchesAction = auditActionFilter === "ALL" || log.action === auditActionFilter;
      if (!matchesAction) return false;

      if (!auditSearchQuery.trim()) return true;

      const query = auditSearchQuery.toLowerCase();
      const userName = (log.profiles?.display_name || log.details?._user_name || "").toLowerCase();
      const action = (log.action || "").toLowerCase();
      const entity = (log.entity_type || "").toLowerCase();
      const description = describeLog(log).toLowerCase();

      return (
        userName.includes(query) ||
        action.includes(query) ||
        entity.includes(query) ||
        description.includes(query)
      );
    });
  }, [logs, auditSearchQuery, auditActionFilter]);

  const handleExportAuditLogs = () => {
    if (filteredLogs.length === 0) {
      toast.error("No activity logs to export");
      return;
    }
    const exportRows = filteredLogs.map((log: any) => ({
      Date: new Date(log.created_at).toLocaleString(),
      User: log.profiles?.display_name || log.details?._user_name || "System",
      Action: log.action,
      Module: log.entity_type || "N/A",
      Description: describeLog(log),
    }));
    logAction("EXPORT", "Audit Logs", "bulk", { count: exportRows.length });
    exportToExcel(exportRows, `audit_logs_${new Date().toISOString().split("T")[0]}`);
  };

  // Mutations
  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole, targetName }: { userId: string; newRole: string; targetName?: string }) => {
      const { error } = await (supabase as any)
        .from("user_roles")
        .upsert({ user_id: userId, role: newRole }, { onConflict: "user_id" });

      if (error) throw error;
      await logAction("ROLE_CHANGE", "user_roles", userId, { new_role: newRole, target_name: targetName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-roles"] });
      toast.success("Role updated successfully.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      setDeleting(true);
      const targetUser = usersData.find((u: any) => u.user_id === userId);
      const { error } = await (supabase as any).rpc("delete_user_permanently", { target_id: userId });
      if (error) throw error;

      await logAction("DELETE", "profiles", userId, {
        deleted_user_id: userId,
        deleted_user_name: targetUser?.profile?.display_name
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-roles"] });
      toast.success("User account removed.");
      setDeleteId(null);
    },
    onError: (e: any) => toast.error("Failed: " + e.message),
    onSettled: () => setDeleting(false),
  });

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.password || !inviteForm.displayName) {
      toast.error("Please fill in all fields");
      return;
    }
    if (inviteForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setInviting(true);
    try {
      const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
        email: inviteForm.email,
        password: inviteForm.password,
        options: { data: { display_name: inviteForm.displayName } },
      });
      if (signUpError) throw signUpError;

      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error("User creation failed.");

      await (supabase as any).from("profiles").upsert({
        user_id: newUserId,
        display_name: inviteForm.displayName,
      }, { onConflict: "user_id" });

      await (supabase as any).from("user_roles").upsert({
        user_id: newUserId,
        role: inviteForm.role,
      }, { onConflict: "user_id" });

      await logAction("INVITE", "users", newUserId, {
        invited_email: inviteForm.email,
        assigned_role: inviteForm.role,
        invited_name: inviteForm.displayName,
      });

      queryClient.invalidateQueries({ queryKey: ["users-roles"] });
      toast.success(`Account created for ${inviteForm.displayName}!`);
      clearInviteDraft();
      setInviteOpen(false);
      setInviteForm({ email: "", displayName: "", password: "", role: "mechanic" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setInviting(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget) return toast.error("Please select a user to transfer to");
    if (!user) return;
    setTransferring(true);
    try {
      const targetUser = usersData.find((u: any) => u.user_id === transferTarget);
      const myEntry = usersData.find((u: any) => u.user_id === user.id);

      if (!targetUser || !myEntry) throw new Error("Could not find user records");

      await (supabase as any).from("user_roles").update({ role: "admin" }).eq("id", targetUser.id);
      await (supabase as any).from("user_roles").update({ role: transferDowngradeTo }).eq("id", myEntry.id);

      await logAction("ROLE_CHANGE", "user_roles", targetUser.id, {
        action: "admin_transfer",
        transferred_to: targetUser.profile?.display_name,
        previous_admin_downgraded_to: transferDowngradeTo,
      });

      toast.success(`Admin role transferred to ${targetUser.profile?.display_name || "user"}. Reloading...`);
      setTransferOpen(false);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      toast.error(err.message || "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  /**
   * Toggles one action for a role on a page.
   * View is the base: revoking it revokes everything, and granting any other
   * action grants View too, so a role can never act on a page it cannot open.
   */
  const togglePerm = (r: AppRole, page: PageKey, action: PermissionAction) => {
    setLocalPermissions((prev) => {
      const base = prev ?? livePermissions;
      const roleperms: any = base[r] ?? {};
      const lists: Record<PermissionAction, PageKey[]> = {
        view: [...(roleperms.view ?? [])],
        create: [...(roleperms.create ?? [])],
        edit: [...(roleperms.edit ?? [])],
        delete: [...(roleperms.delete ?? [])],
      };

      const granted = lists[action].includes(page);
      const drop = (a: PermissionAction) => { lists[a] = lists[a].filter((p) => p !== page); };
      const add = (a: PermissionAction) => { if (!lists[a].includes(page)) lists[a].push(page); };

      if (granted) {
        drop(action);
        // Losing View means losing the page entirely.
        if (action === "view") { drop("create"); drop("edit"); drop("delete"); }
      } else {
        add(action);
        if (action !== "view") add("view");
      }

      return { ...base, [r]: lists };
    });
    setPermDirty(true);
  };

  const savePerms = async () => {
    try {
      await savePermsToSupabase(permissions);
      logAction("PERMISSION_CHANGE", "app_settings", "permissions", { type: "save", permissions });
      setPermDirty(false);
      setLocalPermissions(null);
      toast.success("Permissions updated across all users.");
    } catch (e: any) {
      toast.error("Failed to save permissions: " + e.message);
    }
  };

  const resetPerms = async () => {
    try {
      await savePermsToSupabase({ ...DEFAULT_PERMISSIONS });
      logAction("PERMISSION_CHANGE", "app_settings", "permissions", { type: "reset" });
      setLocalPermissions(null);
      setPermDirty(false);
      toast.success("Permissions reset to defaults.");
    } catch (e: any) {
      toast.error("Failed to reset permissions: " + e.message);
    }
  };

  const saveServiceInterval = async () => {
    const months = parseInt(serviceInterval);
    const days = parseInt(serviceIntervalDays);

    if (isNaN(months) || months < 0 || months > 24) {
      toast.error("Enter months between 0 and 24");
      return;
    }
    if (isNaN(days) || days < 0 || days > 31) {
      toast.error("Enter days between 0 and 31");
      return;
    }
    if (months === 0 && days === 0) {
      toast.error("Interval cannot be 0 months and 0 days");
      return;
    }

    setIntervalSaving(true);
    try {
      const now = new Date().toISOString();
      await Promise.all([
        (supabase as any).from("app_settings").upsert({ key: "service_interval_months", value: serviceInterval, updated_at: now }, { onConflict: "key" }),
        (supabase as any).from("app_settings").upsert({ key: "service_interval_days", value: serviceIntervalDays, updated_at: now }, { onConflict: "key" })
      ]);

      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      await logAction("UPDATE", "app_settings", "service_interval_settings", { months: serviceInterval, days: serviceIntervalDays });
      toast.success("Service reminder interval saved.");
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    } finally {
      setIntervalSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast.error("Please enter a role name");
      return;
    }

    const key = newRoleName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    if ((permissions as any)[key]) {
      toast.error(`A role with key '${key}' already exists`);
      return;
    }

    setCreatingRole(true);
    try {
      const updatedPerms: any = {
        ...permissions,
        [key]: {
          view: ["dashboard", "vehicles"],
          create: ["vehicles"],
          edit: ["vehicles"],
          delete: [],
        },
      };

      const updatedLabels = { ...customRoleLabels, [key]: newRoleName.trim() };

      await savePermsToSupabase(updatedPerms);
      await (supabase as any).from("app_settings").upsert({
        key: "role_labels",
        value: JSON.stringify(updatedLabels),
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      setCustomRoleLabels(updatedLabels);
      setLocalPermissions(updatedPerms);
      setPermDirty(false);

      await logAction("CREATE", "app_settings", key, { role_name: newRoleName.trim() });
      toast.success(`Role '${newRoleName.trim()}' created successfully!`);
      setCreateRoleOpen(false);
      setNewRoleName("");
    } catch (e: any) {
      toast.error("Failed to create role: " + e.message);
    } finally {
      setCreatingRole(false);
    }
  };

  const handleRenameRole = async () => {
    if (!renameRoleName.trim() || !targetRoleKey) {
      toast.error("Please enter a valid role name");
      return;
    }

    setRenamingRole(true);
    try {
      const updatedLabels = { ...customRoleLabels, [targetRoleKey]: renameRoleName.trim() };

      await (supabase as any).from("app_settings").upsert({
        key: "role_labels",
        value: JSON.stringify(updatedLabels),
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      setCustomRoleLabels(updatedLabels);

      await logAction("UPDATE", "app_settings", targetRoleKey, { new_name: renameRoleName.trim() });
      toast.success(`Role renamed to '${renameRoleName.trim()}'!`);
      setRenameRoleOpen(false);
      setTargetRoleKey("");
      setRenameRoleName("");
    } catch (e: any) {
      toast.error("Failed to rename role: " + e.message);
    } finally {
      setRenamingRole(false);
    }
  };

  const configurableRoles: string[] = useMemo(() => {
    const keys = Object.keys(permissions || {}).filter((k) => !k.startsWith("_"));
    if (keys.length === 0) return ["admin", "sales", "mechanic"];
    return keys;
  }, [permissions]);
  const otherUsers = usersData.filter((u: any) => u.user_id !== user?.id);

  return (
    <div className="space-y-6 animate-fade-up max-w-6xl mx-auto pb-16">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">System Control</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Settings & Administration
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure user roles, access permissions, and security audit logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl transition-all font-semibold text-xs h-10 px-4 border-border text-foreground hover:bg-muted"
            onClick={() => { setTransferTarget(""); setTransferOpen(true); }}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 mr-2 text-muted-foreground" /> Transfer Admin Role
          </Button>
        </div>
      </div>

      {/* ── Navigation Tabs ───────────────────────────────────── */}
      <div className="flex p-1 bg-muted/60 border border-border/80 rounded-2xl gap-1 w-full max-w-xl">
        {[
          ["team", "Team Accounts", <Users className="w-4 h-4 shrink-0" />],
          ["permissions", "Access Matrix", <Shield className="w-4 h-4 shrink-0" />],
          ["audit", "Audit Logs", <Activity className="w-4 h-4 shrink-0" />],
        ].map(([key, label, icon]) => {
          const isActive = tab === key;
          return (
            <button
              key={key as string}
              onClick={() => setTab(key as Tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? "text-foreground bg-background border border-border shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {icon}
              <span>{label as string}</span>
            </button>
          );
        })}
      </div>

      {/* ── TEAM ACCOUNTS TAB ── */}
      {tab === "team" && (
        <div className="bento-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" /> Staff & User Directory
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage registered dealership members and assign their authorization roles.
              </p>
            </div>

            <Button
              size="sm"
              className="rounded-xl transition-all font-semibold text-xs h-10 px-5 shadow-sm"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" /> Invite New User
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted/40 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : usersData.length === 0 ? (
            <div className="text-center p-8 border border-border bg-muted/20 rounded-2xl">
              <p className="text-xs text-muted-foreground">No team members registered yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {usersData.map((u: any) => {
                const profile = u.profile;
                const isSelf = u.user_id === user?.id;
                const roleLabel = getRoleDisplayLabel(u.role, customRoleLabels);
                const rc = ROLE_CONFIG[u.role] ?? { label: roleLabel, color: "text-foreground font-medium", icon: <User className="w-3.5 h-3.5 text-muted-foreground" /> };
                return (
                  <div
                    key={u.user_id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl transition-all border border-border/80 ${
                      isSelf ? "bg-muted/50 shadow-sm" : "bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 bg-primary/10 text-primary border border-primary/20">
                        {profile?.display_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">
                            {profile?.display_name || "Unknown User"}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-semibold">
                              You
                            </span>
                          )}
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full bg-muted flex items-center gap-1 border border-border ${rc.color}`}>
                            {rc.icon} {roleLabel}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {profile?.phone || "No phone recorded"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={u.role}
                        onValueChange={(val) => {
                          if (isSelf && val !== "admin") {
                            if (!window.confirm("⚠️ Changing your role will update your access privileges. Proceed?")) return;
                          }
                          updateRole.mutate({ userId: u.user_id, newRole: val, targetName: profile?.display_name });
                        }}
                        disabled={updateRole.isPending}
                      >
                        <SelectTrigger className="w-[160px] rounded-xl bg-background border-border h-9 text-xs font-semibold">
                          <SelectValue placeholder="Assign Role" />
                        </SelectTrigger>
                        <SelectContent className="font-medium rounded-xl">
                          <SelectItem value="pending" className="rounded-lg text-rose-500 text-xs">Pending Approval</SelectItem>
                          {configurableRoles.map((rKey) => (
                            <SelectItem key={rKey} value={rKey} className="rounded-lg text-foreground text-xs">
                              {getRoleDisplayLabel(rKey, customRoleLabels)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {!isSelf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                          onClick={() => setDeleteId(u.user_id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ACCESS PERMISSIONS MATRIX TAB ── */}
      {tab === "permissions" && (
        <div className="bento-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" /> Role Access Control Matrix
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure module-level permissions for each role. Admin role always maintains full system access.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-border text-foreground hover:bg-muted text-xs h-9 px-3"
                onClick={() => setCreateRoleOpen(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> Add New Role
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted h-9"
                onClick={resetPerms}
                disabled={isSaving}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset Defaults
              </Button>
              <Button
                size="sm"
                disabled={!permDirty || isSaving}
                className="rounded-xl transition-all font-semibold text-xs h-9 px-5 shadow-sm disabled:opacity-40"
                onClick={savePerms}
              >
                {isSaving ? "Saving..." : permDirty ? "Save Changes *" : "Save Changes"}
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/40 p-3.5 rounded-xl border border-border/80 space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>Click each action to grant or revoke it:</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">V</span>
                View
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">A</span>
                Add
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">E</span>
                Edit
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">D</span>
                Delete
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground/80">
              Greyed out means denied. Granting Add, Edit or Delete also grants View; revoking View removes the page entirely.
              Delete is independent — a role can have Add and Edit without being able to delete anything.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-6">Module / Page</th>
                  {configurableRoles.map((r) => {
                    const displayLabel = getRoleDisplayLabel(r, customRoleLabels);
                    const rc = ROLE_CONFIG[r] ?? { label: displayLabel, color: "text-foreground font-semibold", icon: <User className="w-3.5 h-3.5 text-muted-foreground" /> };
                    return (
                      <th key={r} className="pb-3 text-center px-2">
                        <div className="inline-flex items-center gap-1.5 bg-muted/60 border border-border px-3 py-1.5 rounded-xl">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${rc.color}`}>
                            {rc.icon} {displayLabel}
                          </span>
                          <button
                            onClick={() => {
                              setTargetRoleKey(r);
                              setRenameRoleName(displayLabel);
                              setRenameRoleOpen(true);
                            }}
                            className="p-1 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-colors"
                            title={`Rename ${displayLabel}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ALL_PAGES.map((page) => (
                  <tr key={page.key} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="py-3 pr-6 text-xs font-medium text-foreground">{page.label}</td>
                    {configurableRoles.map((r) => (
                      <td key={r} className="py-3 px-2">
                        <div className="flex items-center justify-center gap-1">
                          {PERMISSION_ACTIONS.map((action) => {
                            const granted = (((permissions[r] as any)?.[action.key] ?? []) as PageKey[]).includes(page.key);
                            return (
                              <button
                                key={action.key}
                                onClick={() => togglePerm(r as AppRole, page.key, action.key)}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-bold transition-all border ${
                                  granted
                                    ? ACTION_TOGGLE_STYLES[action.key]
                                    : "bg-muted border-transparent text-muted-foreground/40 hover:text-foreground hover:bg-muted/80"
                                }`}
                                title={`${granted ? "Revoke" : "Grant"} ${action.label} on ${page.label}`}
                                aria-pressed={granted}
                              >
                                {action.short}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SYSTEM AUDIT LOGS TAB ── */}
      {tab === "audit" && (
        <div className="bento-card p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" /> Security Audit Log
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {filteredLogs.length} events
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Live audit trail recording system actions, user logins, data changes, and security events.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-border text-foreground hover:bg-muted text-xs h-9 px-3"
                onClick={() => refetchLogs()}
                disabled={isLoadingLogs}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingLogs ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-border text-foreground hover:bg-muted text-xs h-9 px-3"
                onClick={handleExportAuditLogs}
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> Export Excel
              </Button>
            </div>
          </div>

          {/* Search & Action Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search audit logs by user, action, entity, or keyword..."
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                className="pl-9 rounded-xl h-10 text-xs bg-background border-border"
              />
            </div>

            <div className="w-full sm:w-[200px] shrink-0">
              <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                <SelectTrigger className="rounded-xl h-10 text-xs bg-background border-border font-medium">
                  <SelectValue placeholder="Filter by Action" />
                </SelectTrigger>
                <SelectContent className="rounded-xl font-medium">
                  <SelectItem value="ALL" className="rounded-lg text-xs">All Actions</SelectItem>
                  <SelectItem value="CREATE" className="rounded-lg text-xs">CREATE</SelectItem>
                  <SelectItem value="UPDATE" className="rounded-lg text-xs">UPDATE</SelectItem>
                  <SelectItem value="DELETE" className="rounded-lg text-xs">DELETE</SelectItem>
                  <SelectItem value="LOGIN" className="rounded-lg text-xs">LOGIN</SelectItem>
                  <SelectItem value="ROLE_CHANGE" className="rounded-lg text-xs">ROLE_CHANGE</SelectItem>
                  <SelectItem value="PERMISSION_CHANGE" className="rounded-lg text-xs">PERMISSION_CHANGE</SelectItem>
                  <SelectItem value="EXPORT" className="rounded-lg text-xs">EXPORT</SelectItem>
                  <SelectItem value="PRINT" className="rounded-lg text-xs">PRINT</SelectItem>
                  <SelectItem value="PAYMENT" className="rounded-lg text-xs">PAYMENT</SelectItem>
                  <SelectItem value="INVITE" className="rounded-lg text-xs">INVITE</SelectItem>
                  <SelectItem value="STATUS_CHANGE" className="rounded-lg text-xs">STATUS_CHANGE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoadingLogs ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-muted/40 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-10 text-center border border-border bg-muted/20 rounded-2xl space-y-2">
              <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-xs font-semibold text-foreground">No audit logs found</p>
              <p className="text-[11px] text-muted-foreground">
                {auditSearchQuery || auditActionFilter !== "ALL"
                  ? "Try adjusting your search query or action filter."
                  : "No security activity events recorded yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log: any) => {
                const userName = log.profiles?.display_name || log.details?._user_name || null;
                const actionColor = ACTION_COLORS[log.action] || "bg-muted text-foreground border border-border";
                const description = describeLog(log);
                return (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/70 bg-card hover:bg-muted/30 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary">
                        {userName ? userName.charAt(0).toUpperCase() : "?"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="font-semibold text-xs text-foreground">
                            {userName || <span className="italic text-muted-foreground">System</span>}
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${actionColor}`}>
                            {log.action}
                          </span>
                          {log.entity_type && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono border border-border">
                              {log.entity_type}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{description}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 sm:self-center">
                      <p className="text-[11px] font-medium text-foreground">
                        {new Date(log.created_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── INVITE USER DIALOG ── */}
      <Dialog open={inviteOpen} onOpenChange={(v) => !inviting && setInviteOpen(v)}>
        <DialogContent className="max-w-md rounded-3xl bg-background border border-border shadow-2xl p-0">
          <div className="p-6 border-b border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <UserPlus className="h-4 w-4 text-primary" /> Invite New Team Member
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Create user account and initial password. Share credentials with the team member.
              </p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Full Name</Label>
              <Input
                placeholder="e.g. John Doe"
                className="rounded-xl h-10 text-xs"
                value={inviteForm.displayName}
                onChange={(e) => setInviteForm({ ...inviteForm, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Email Address</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                className="rounded-xl h-10 text-xs"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Set Password</Label>
              <Input
                type="password"
                placeholder="Min. 6 characters"
                className="rounded-xl h-10 text-xs"
                value={inviteForm.password}
                onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Assign Role</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {configurableRoles.map((rKey) => (
                    <SelectItem key={rKey} value={rKey} className="rounded-lg text-xs">
                      {getRoleDisplayLabel(rKey, customRoleLabels)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="p-6 pt-0 gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting} className="rounded-xl text-xs h-10">
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviting}
              className="rounded-xl text-xs font-semibold h-10"
            >
              {inviting ? "Creating Account..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CREATE ROLE DIALOG ── */}
      <Dialog open={createRoleOpen} onOpenChange={(v) => !creatingRole && setCreateRoleOpen(v)}>
        <DialogContent className="max-w-md rounded-3xl bg-background border border-border shadow-2xl p-0">
          <div className="p-6 border-b border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <Plus className="h-4 w-4 text-emerald-500" /> Create Custom Role
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Add a new staff or management authorization role to the system.
              </p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Role Name</Label>
              <Input
                placeholder="e.g. Inventory Manager, Auditor, Supervisor"
                className="rounded-xl h-10 text-xs"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateRole(); }}
              />
              <p className="text-[11px] text-muted-foreground">
                Key preview: {newRoleName ? newRoleName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_") : "role_key"}
              </p>
            </div>
          </div>
          <DialogFooter className="p-6 pt-0 gap-2">
            <Button variant="outline" onClick={() => setCreateRoleOpen(false)} disabled={creatingRole} className="rounded-xl text-xs h-10">
              Cancel
            </Button>
            <Button
              onClick={handleCreateRole}
              disabled={creatingRole || !newRoleName.trim()}
              className="rounded-xl text-xs font-semibold h-10"
            >
              {creatingRole ? "Creating Role..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── RENAME ROLE DIALOG ── */}
      <Dialog open={renameRoleOpen} onOpenChange={(v) => !renamingRole && setRenameRoleOpen(v)}>
        <DialogContent className="max-w-md rounded-3xl bg-background border border-border shadow-2xl p-0">
          <div className="p-6 border-b border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <Pencil className="h-4 w-4 text-sky-500" /> Rename Role Title
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Change the public display title of this role.
              </p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Display Title</Label>
              <Input
                placeholder="e.g. Service Tech, Senior Advisor"
                className="rounded-xl h-10 text-xs"
                value={renameRoleName}
                onChange={(e) => setRenameRoleName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameRole(); }}
              />
            </div>
          </div>
          <DialogFooter className="p-6 pt-0 gap-2">
            <Button variant="outline" onClick={() => setRenameRoleOpen(false)} disabled={renamingRole} className="rounded-xl text-xs h-10">
              Cancel
            </Button>
            <Button
              onClick={handleRenameRole}
              disabled={renamingRole || !renameRoleName.trim()}
              className="rounded-xl text-xs font-semibold h-10"
            >
              {renamingRole ? "Saving..." : "Save Role Title"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── TRANSFER ADMIN DIALOG ── */}
      <Dialog open={transferOpen} onOpenChange={(v) => !transferring && setTransferOpen(v)}>
        <DialogContent className="max-w-md rounded-3xl bg-background border border-border shadow-2xl p-0">
          <div className="p-6 border-b border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <ArrowRightLeft className="h-4 w-4 text-primary" /> Transfer Admin Role
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Promote selected user to Admin role and set your updated role.
              </p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Transfer Admin Role To</Label>
              <Select value={transferTarget} onValueChange={setTransferTarget}>
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {otherUsers.map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id} className="rounded-lg text-xs">
                      {u.profile?.display_name || "Unknown User"} — <span className="opacity-60">{getRoleDisplayLabel(u.role, customRoleLabels)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Set My Role To</Label>
              <Select value={transferDowngradeTo} onValueChange={setTransferDowngradeTo}>
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {configurableRoles.map((rKey) => (
                    <SelectItem key={rKey} value={rKey} className="rounded-lg text-xs">
                      {getRoleDisplayLabel(rKey, customRoleLabels)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="p-6 pt-0 gap-2">
            <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={transferring} className="rounded-xl text-xs h-10">
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={transferring || !transferTarget}
              className="rounded-xl text-xs font-semibold h-10"
            >
              {transferring ? "Transferring..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE USER CONFIRM DIALOG ── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => !deleting && setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl bg-background border border-border p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <AlertTriangle className="w-5 h-5 text-rose-500" /> Remove Team Member
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-2">
              Are you sure you want to remove <span className="font-semibold text-foreground">{usersData.find((u: any) => u.user_id === deleteId)?.profile?.display_name}</span> from the system?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="rounded-xl text-xs h-10" disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl text-xs h-10 font-semibold border-none"
              disabled={deleting}
              onClick={() => deleteId && deleteUserMutation.mutate(deleteId)}
            >
              {deleting ? "Removing..." : "Remove User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
