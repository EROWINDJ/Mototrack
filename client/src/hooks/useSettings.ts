import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface UserSettings {
  id: string;
  userId: string;
  tankSize: number;
  consumptionRate: number;
  stopDurationForRefuelAlert: number;
}

export function useSettings(isAuthenticated: boolean) {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    enabled: isAuthenticated,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Pick<UserSettings, "tankSize" | "consumptionRate" | "stopDurationForRefuelAlert">>) => {
      const res = await apiRequest("PATCH", "/api/settings", updates);
      return res.json() as Promise<UserSettings>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/settings"], data);
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
