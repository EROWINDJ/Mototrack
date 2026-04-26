import { useEffect, useRef, useState } from "react";

export type Position = {
  lat: number;
  lng: number;
};

const MAX_REALISTIC_SPEED_KMH = 130;
const MIN_DISTANCE_METERS = 5;
const MIN_DISPLAY_SPEED_KMH = 3;
const MAX_ACCEPTABLE_ACCURACY_METERS = 35;

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
      return;
    }

    setGpsStatus("tracking");

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        const now = Date.now();

        const newPos: Position = { lat, lng };

        setAccuracy(acc);

        if (acc > MAX_ACCEPTABLE_ACCURACY_METERS) {
          setGpsStatus("low_accuracy");
          setSpeed(0);
          return;
        }

        setGpsStatus("tracking");
        setPosition(newPos);

        if (!lastPosition.current || !lastTime.current) {
          lastPosition.current = newPos;
          lastTime.current = now;
          setPath([newPos]);
          setSpeed(0);
          return;
        }

        const d = getDistance(
          lastPosition.current.lat,
          lastPosition.current.lng,
          lat,
          lng
        );

        const dt = (now - lastTime.current) / 1000;
        const speedKmh = dt > 0 ? (d / dt) * 3.6 : 0;

        if (speedKmh > MAX_REALISTIC_SPEED_KMH) {
          console.warn("Point GPS ignoré : vitesse aberrante", speedKmh);
          return;
        }

        if (d < MIN_DISTANCE_METERS) {
          setSpeed(0);
          return;
        }

        const displayedSpeed =
          speedKmh < MIN_DISPLAY_SPEED_KMH ? 0 : speedKmh;

        setDistance((prev) => prev + d / 1000);
        setSpeed(displayedSpeed);
        setPath((prev) => [...prev, newPos]);

        lastPosition.current = newPos;
        lastTime.current = now;
      },
      (err) => {
        console.error("[GPS ERROR]", err);

        if (err.code === 1) setGpsStatus("permission_denied");
        else if (err.code === 2) setGpsStatus("position_unavailable");
        else if (err.code === 3) setGpsStatus("timeout");
        else setGpsStatus("error");

        setSpeed(0);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
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
    setDistance(0);
    setPath([]);
    setSpeed(0);
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