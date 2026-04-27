import { useEffect, useRef, useState } from "react";

export type Position = {
  lat: number;
  lng: number;
};

const MAX_ACCEPTABLE_ACCURACY_METERS = 30;
const MAX_REALISTIC_SPEED_KMH = 130;
const MIN_DISTANCE_METERS = 5;
const MIN_DISPLAY_SPEED_KMH = 3;
const GPS_TIMEOUT_MS = 10000;
const GPS_MAXIMUM_AGE_MS = 1000;

export default function useGPS(isTracking: boolean) {
  const [position, setPosition] = useState<Position | null>(null);
  const [path, setPath] = useState<Position[]>([]);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState("stopped");

  const watchId = useRef<number | null>(null);
  const lastPosition = useRef<Position | null>(null);
  const lastTime = useRef<number | null>(null);

  useEffect(() => {
    if (!isTracking) {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }

      setGpsStatus("stopped");
      setSpeed(0);
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus("unsupported");
      setSpeed(0);
      return;
    }

    setGpsStatus("searching");

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy ?? 9999;
        const now = Date.now();

        const newPos: Position = { lat, lng };

        setAccuracy(acc);

        // 1. Filtre principal : GPS trop imprécis
        if (acc > MAX_ACCEPTABLE_ACCURACY_METERS) {
          console.warn(
            `[GPS] Point ignoré : précision insuffisante (${Math.round(acc)} m)`
          );

          setGpsStatus("low_accuracy");
          setSpeed(0);
          return;
        }

        setGpsStatus("tracking");
        setPosition(newPos);

        // 2. Premier point fiable
        if (!lastPosition.current || !lastTime.current) {
          lastPosition.current = newPos;
          lastTime.current = now;
          setPath([newPos]);
          setSpeed(0);
          return;
        }

        const distanceMeters = getDistance(
          lastPosition.current.lat,
          lastPosition.current.lng,
          lat,
          lng
        );

        const elapsedSeconds = (now - lastTime.current) / 1000;

        const calculatedSpeedKmh =
          elapsedSeconds > 0 ? (distanceMeters / elapsedSeconds) * 3.6 : 0;

        const gpsSpeedKmh =
          typeof pos.coords.speed === "number" && pos.coords.speed >= 0
            ? pos.coords.speed * 3.6
            : null;

        const rawSpeedKmh = gpsSpeedKmh ?? calculatedSpeedKmh;

        // 3. Filtre vitesse aberrante
        if (rawSpeedKmh > MAX_REALISTIC_SPEED_KMH) {
          console.warn(
            `[GPS] Point ignoré : vitesse aberrante (${Math.round(
              rawSpeedKmh
            )} km/h)`
          );

          setGpsStatus("unrealistic_speed");
          setSpeed(0);
          return;
        }

        // 4. Petit mouvement parasite : on affiche éventuellement la vitesse GPS,
        // mais on n'ajoute ni distance ni point au trajet
        if (distanceMeters < MIN_DISTANCE_METERS) {
          const displayedSpeed =
            rawSpeedKmh < MIN_DISPLAY_SPEED_KMH ? 0 : rawSpeedKmh;

          setSpeed(displayedSpeed);
          return;
        }

        const displayedSpeed =
          rawSpeedKmh < MIN_DISPLAY_SPEED_KMH ? 0 : rawSpeedKmh;

        setDistance((prev) => prev + distanceMeters / 1000);
        setSpeed(displayedSpeed);
        setPath((prev) => [...prev, newPos]);

        lastPosition.current = newPos;
        lastTime.current = now;
      },
      (err) => {
        console.error("[GPS ERROR]", err);

        if (err.code === 1) {
          setGpsStatus("permission_denied");
        } else if (err.code === 2) {
          setGpsStatus("position_unavailable");
        } else if (err.code === 3) {
          setGpsStatus("timeout");
        } else {
          setGpsStatus("error");
        }

        setSpeed(0);
      },
      {
        enableHighAccuracy: true,
        maximumAge: GPS_MAXIMUM_AGE_MS,
        timeout: GPS_TIMEOUT_MS,
      }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [isTracking]);

  const resetDistance = () => {
    setPosition(null);
    setPath([]);
    setSpeed(0);
    setDistance(0);
    setAccuracy(null);
    setGpsStatus(isTracking ? "tracking" : "stopped");

    lastPosition.current = null;
    lastTime.current = null;
  };

  return {
    position,
    path,
    speed,
    distance,
    accuracy,
    gpsStatus,
    resetDistance,
  };
}

function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371000;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}