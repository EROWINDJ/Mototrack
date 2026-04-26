import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface Trip {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  consumedFuelL: number;
  consumptionRateL100: number;
  durationMinutes: number;
}

export interface NewTrip {
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  consumedFuelL: number;
  consumptionRateL100: number;
  durationMinutes: number;
}

export function useTrips(isAuthenticated: boolean) {
  const queryClient = useQueryClient();

  const { data: trips = [], isLoading } = useQuery<Trip[]>({
    queryKey: ["/api/trips"],
    enabled: isAuthenticated,
  });

  const saveTripMutation = useMutation({
    mutationFn: async (trip: NewTrip) => {
      const res = await apiRequest("POST", "/api/trips", trip);
      return res.json() as Promise<Trip>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
  });

  return {
    trips,
    isLoading,
    saveTrip: saveTripMutation.mutateAsync,
    isSaving: saveTripMutation.isPending,
  };
}
