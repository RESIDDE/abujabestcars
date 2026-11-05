import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PERMISSIONS, type PermissionsMap } from "@/lib/permissions";

const SETTINGS_KEY = "permissions";
export const PERMISSIONS_QUERY_KEY = ["app_settings", "permissions"] as const;

async function fetchPermissions(): Promise<PermissionsMap> {
  const { data, error } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .single();

  if (error) {
    return { ...DEFAULT_PERMISSIONS };
  }

  if (!data?.value) {
    console.warn("[usePermissions] No permissions row found — using defaults.");
    return { ...DEFAULT_PERMISSIONS };
  }

  const fetched = data.value as Partial<PermissionsMap>;

  // Migrate legacy role data: if a role has no `create` field, backfill it
  // from `edit` so existing "Full Access" users retain their Add rights.
  // If `edit` is also missing, default to empty so View-only stays view-only.
  function migrateRole(
    role: { view?: any[]; create?: any[]; edit?: any[] } | undefined,
    defaults: { view: any[]; create: any[]; edit: any[] }
  ) {
    if (!role) return defaults;
    return {
      view: role.view ?? defaults.view,
      create: role.create ?? role.edit ?? [],   // backfill from edit if missing
      edit: role.edit ?? defaults.edit,
    };
  }

  const result: Record<string, { view: any[]; create: any[]; edit: any[] }> = {};

  // First copy all fetched roles migrated
  for (const [key, roleVal] of Object.entries(fetched)) {
    const defaultVal = (DEFAULT_PERMISSIONS as any)[key] ?? { view: [], create: [], edit: [] };
    result[key] = migrateRole(roleVal as any, defaultVal);
  }

  // Ensure default roles exist if not in fetched
  for (const [key, defaultVal] of Object.entries(DEFAULT_PERMISSIONS)) {
    if (!result[key]) {
      result[key] = defaultVal;
    }
  }

  return result as PermissionsMap;
}

/**
 * Fetches and caches live permissions from Supabase `app_settings`.
 * - staleTime: 0 — always fetches fresh data on mount.
 * - The Realtime subscription lives in <PermissionsRealtimeSync /> (App.tsx),
 *   NOT here, to avoid duplicate channels when this hook mounts in many places.
 */
export function usePermissions() {
  const queryClient = useQueryClient();

  const { data: permissions = DEFAULT_PERMISSIONS, isLoading } = useQuery<PermissionsMap>({
    queryKey: PERMISSIONS_QUERY_KEY,
    queryFn: fetchPermissions,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (newPerms: PermissionsMap) => {
      const { error } = await (supabase as any)
        .from("app_settings")
        .upsert(
          { key: SETTINGS_KEY, value: newPerms, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY });
    },
  });

  return {
    permissions,
    isLoading,
    isLoaded: !isLoading,
    savePermissions: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}

/**
 * Mounts ONE global Realtime channel for app_settings.
 * Place this as a sibling to <AppRoutes /> in App.tsx so it only ever
 * creates a single WebSocket subscription for the entire session.
 */
export function PermissionsRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = (supabase as any)
      .channel("global_app_settings_permissions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: `key=eq.${SETTINGS_KEY}`,
        },
        () => {
          // Super admin saved — all clients immediately refetch
          queryClient.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY });
        }
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [queryClient]);

  return null; // Purely a side-effect component
}
