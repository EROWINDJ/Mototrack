import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import useGPS from "@/hooks/useGPS";
import { useLocalSettings } from "@/hooks/useLocalSettings";
import { useLocalTrips } from "@/hooks/useLocalTrips";

type ReverseGeocodeResult = {
  address: string;
  city: string;
};

async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );

    if (!response.ok) throw new Error("Erreur reverse geocoding");

    const data = await response.json();
    const address = data.address || {};

    return {
      address:
        address.road ||
        address.pedestrian ||
        address.footway ||
        address.cycleway ||
        address.path ||
        address.suburb ||
        "Lieu inconnu",
      city:
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.county ||
        "",
    };
  } catch {
    return { address: "Adresse inconnue", city: "" };
  }
}

type TrackingContextValue = ReturnType<typeof useGPS> & {
  isTracking: boolean;
  startedAt: Date | null;
  maxSpeed: number;
  startTracking: () => void;
  stopTracking: () => Promise<void>;
  toggleTracking: () => void;
  resetRoute: () => void;
};

const TrackingContext = createContext<TrackingContextValue | null>(null);

export function TrackingProvider({ children }: { children: ReactNode }) {
  const [isTracking, setIsTracking] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [maxSpeed, setMaxSpeed] = useState(0);

  const gps = useGPS(isTracking);
  const { settings, updateFuel } = useLocalSettings();
  const { addTrip } = useLocalTrips();

  useEffect(() => {
    if (isTracking) {
      setMaxSpeed((prev) => Math.max(prev, gps.speed));
    }
  }, [gps.speed, isTracking]);

  const startTracking = () => {
    gps.resetDistance();
    setMaxSpeed(0);
    setStartedAt(new Date());
    setIsTracking(true);
  };

  const stopTracking = async () => {
    setIsTracking(false);

    if (!settings || !startedAt) {
      setStartedAt(null);
      return;
    }

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - startedAt.getTime();
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

    if (gps.distance < 0.02) {
      setStartedAt(null);
      setMaxSpeed(0);
      gps.resetDistance();
      return;
    }

    const durationHours = durationMinutes / 60;
    const avgSpeedKmh = durationHours > 0 ? gps.distance / durationHours : 0;

    const consumedFuelL = (gps.distance * settings.consumptionRate) / 100;

    const autonomyBeforeKm =
      settings.consumptionRate > 0
        ? (settings.currentFuelL / settings.consumptionRate) * 100
        : 0;

    const newFuelL = Math.max(0, settings.currentFuelL - consumedFuelL);

    const autonomyAfterKm =
      settings.consumptionRate > 0
        ? (newFuelL / settings.consumptionRate) * 100
        : 0;

    const safePath = gps.path ?? [];
    const start = safePath[0];
    const end = safePath[safePath.length - 1];

    let startInfo: ReverseGeocodeResult = {
      address: "Départ inconnu",
      city: "",
    };

    let endInfo: ReverseGeocodeResult = {
      address: "Arrivée inconnue",
      city: "",
    };

    if (start && end) {
      startInfo = await reverseGeocode(start.lat, start.lng);
      endInfo = await reverseGeocode(end.lat, end.lng);
    }

    await addTrip({
      id: crypto.randomUUID(),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),

      distanceKm: gps.distance,
      durationMinutes,

      avgSpeedKmh,
      maxSpeedKmh: maxSpeed,

      consumedFuelL,
      consumptionRateL100: settings.consumptionRate,

      autonomyBeforeKm,
      autonomyAfterKm,

      path: safePath,

      startLat: start?.lat,
      startLng: start?.lng,
      endLat: end?.lat,
      endLng: end?.lng,

      startAddress: startInfo.address,
      startCity: startInfo.city,
      endAddress: endInfo.address,
      endCity: endInfo.city,
    });

    await updateFuel(newFuelL);

    setStartedAt(null);
    setMaxSpeed(0);
    gps.resetDistance();
  };

  const toggleTracking = () => {
    if (isTracking) {
      void stopTracking();
    } else {
      startTracking();
    }
  };

  const resetRoute = () => {
    if (isTracking) return;
    gps.resetDistance();
    setStartedAt(null);
    setMaxSpeed(0);
  };

  return (
    <TrackingContext.Provider
      value={{
        ...gps,
        isTracking,
        startedAt,
        maxSpeed,
        startTracking,
        stopTracking,
        toggleTracking,
        resetRoute,
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  const context = useContext(TrackingContext);

  if (!context) {
    throw new Error("useTracking doit être utilisé dans TrackingProvider");
  }

  return context;
}