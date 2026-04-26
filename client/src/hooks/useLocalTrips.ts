import { useEffect, useState } from "react";
import {
  getAllTrips,
  saveTrip,
  deleteTrip,
  type LocalTrip,
} from "@/lib/localDb";

export function useLocalTrips() {
  const [trips, setTrips] = useState<LocalTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrips = async () => {
    const data = await getAllTrips();
    setTrips(data || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadTrips();
  }, []);

  const addTrip = async (trip: LocalTrip) => {
    await saveTrip(trip);
    await loadTrips();
  };

  const removeTrip = async (id: string) => {
    await deleteTrip(id);
    await loadTrips();
  };

  return {
    trips,
    loading,
    addTrip,
    removeTrip,
    reload: loadTrips,
  };
}