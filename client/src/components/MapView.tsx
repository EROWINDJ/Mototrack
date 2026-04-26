import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { getAllTrips, type LocalTrip } from "@/lib/localDb";
import { useTracking } from "@/context/TrackingContext";

type Position = {
  lat: number;
  lng: number;
};

export default function MapView() {
  const { position, isTracking, speed, accuracy, distance } = useTracking();

  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const currentPolylineRef = useRef<L.Polyline | null>(null);
  const lastTripPolylineRef = useRef<L.Polyline | null>(null);
  const hasCenteredRef = useRef(false);

  const [lastTrip, setLastTrip] = useState<LocalTrip | null>(null);

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map("map", {
      zoomControl: false,
    }).setView([48.8566, 2.3522], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    mapRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 250);
  }, []);

  useEffect(() => {
    const loadLastTrip = async () => {
      const trips = await getAllTrips();

      if (!trips || trips.length === 0) {
        setLastTrip(null);
        return;
      }

      setLastTrip(trips[trips.length - 1]);
    };

    loadLastTrip();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lastTripPolylineRef.current) {
      lastTripPolylineRef.current.remove();
      lastTripPolylineRef.current = null;
    }

    const points = lastTrip?.path || [];

    if (points.length < 2) return;

    const latLngs: L.LatLngExpression[] = points.map((p: Position) => [
      p.lat,
      p.lng,
    ]);

    lastTripPolylineRef.current = L.polyline(latLngs, {
      color: "#64748b",
      weight: 5,
      opacity: 0.55,
      dashArray: "8 8",
    }).addTo(map);
  }, [lastTrip]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;

    const latLng: L.LatLngExpression = [position.lat, position.lng];

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(latLng, {
        radius: 8,
        color: "#020617",
        weight: 3,
        fillColor: "#ef4444",
        fillOpacity: 1,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(latLng);
    }

    if (isTracking) {
      map.setView(latLng, map.getZoom() < 16 ? 16 : map.getZoom(), {
        animate: true,
      });

      hasCenteredRef.current = true;
      return;
    }

    if (!hasCenteredRef.current) {
      map.setView(latLng, 16);
      hasCenteredRef.current = true;
    }
  }, [position, isTracking]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const path = useTrackingPathFromGps();

    if (!path || path.length < 2) {
      if (currentPolylineRef.current) {
        currentPolylineRef.current.remove();
        currentPolylineRef.current = null;
      }
      return;
    }

    const latLngs: L.LatLngExpression[] = path.map((p: Position) => [
      p.lat,
      p.lng,
    ]);

    if (currentPolylineRef.current) {
      currentPolylineRef.current.setLatLngs(latLngs);
    } else {
      currentPolylineRef.current = L.polyline(latLngs, {
        color: "#22c55e",
        weight: 6,
        opacity: 0.95,
      }).addTo(map);
    }
  }, [isTracking, position]);

  const centerMap = () => {
    if (!mapRef.current || !position) return;

    mapRef.current.setView([position.lat, position.lng], 16, {
      animate: true,
    });
  };

  return (
    <div style={styles.wrapper}>
      <div id="map" style={styles.map} />

      <div style={styles.topLeft}>
        <div style={styles.badgeGreen}>
          ● {isTracking ? "GPS TRACKING" : "GPS STOPPED"}
        </div>
        <div style={styles.badgeDark}>
          Précision : {accuracy ? `${Math.round(accuracy)} m` : "-"}
        </div>
      </div>

      <div style={styles.speedBox}>
        <strong>{Math.round(speed || 0)}</strong>
        <span>KM/H</span>
      </div>

      <button onClick={centerMap} style={styles.centerButton}>
        📍
      </button>

      <div style={styles.bottomPanel}>
        <div>
          <span>DISTANCE</span>
          <strong>{distance.toFixed(2)} km</strong>
        </div>
      </div>
    </div>
  );
}

function useTrackingPathFromGps(): Position[] {
  const tracking = useTracking();
  return tracking.path || [];
}

const styles = {
  wrapper: {
    height: "100%",
    width: "100%",
    position: "relative" as const,
    overflow: "hidden",
  },

  map: {
    height: "100%",
    width: "100%",
  },

  topLeft: {
    position: "absolute" as const,
    top: 16,
    left: 16,
    zIndex: 1000,
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },

  badgeGreen: {
    background: "rgba(15, 23, 42, 0.9)",
    color: "#22c55e",
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 14,
  },

  badgeDark: {
    background: "rgba(15, 23, 42, 0.9)",
    color: "white",
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 14,
  },

  speedBox: {
    position: "absolute" as const,
    top: 16,
    right: 16,
    zIndex: 1000,
    width: 72,
    height: 72,
    borderRadius: 24,
    background: "rgba(15, 23, 42, 0.92)",
    color: "white",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
  },

  centerButton: {
    position: "absolute" as const,
    right: 18,
    bottom: 145,
    zIndex: 1000,
    background: "#0f172a",
    color: "white",
    borderRadius: "50%",
    width: 52,
    height: 52,
    border: "none",
    fontSize: 22,
  },

  bottomPanel: {
    position: "absolute" as const,
    left: 16,
    right: 16,
    bottom: 78,
    zIndex: 1000,
    background: "rgba(15, 23, 42, 0.92)",
    borderRadius: 26,
    padding: "16px 22px",
    color: "white",
  },
};