import { useEffect, useState } from "react";
import { getAllTrips, saveTrip, type LocalTrip } from "@/lib/localDb";

export function useLocalTrips() {
  const [trips, setTrips] = useState<LocalTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    const data = await getAllTrips();
    setTrips(data || []);
    setLoading(false);
  };

  const addTrip = async (trip: LocalTrip) => {
    await saveTrip(trip);
    await loadTrips();
  };

  return {
    trips,
    loading,
    addTrip,
    reload: loadTrips,
  };
}