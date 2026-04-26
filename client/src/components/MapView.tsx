import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocalSettings } from "@/hooks/useLocalSettings";
import { useTracking } from "@/context/TrackingContext";

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const hasCenteredRef = useRef(false);

  const { settings } = useLocalSettings();

  const {
    position,
    path,
    speed,
    distance,
    accuracy,
    gpsStatus,
    isTracking,
    toggleTracking,
    resetRoute,
  } = useTracking();

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map("map", {
      zoomControl: true,
    }).setView([48.8566, 2.3522], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      polylineRef.current = null;
      hasCenteredRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;

    const latLng: L.LatLngExpression = [position.lat, position.lng];

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(latLng, {
        radius: 8,
        color: "#020617",
        weight: 3,
        fillColor: "#22c55e",
        fillOpacity: 1,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(latLng);
    }

    if (!hasCenteredRef.current) {
      map.setView(latLng, 16);
      hasCenteredRef.current = true;
    }
  }, [position]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (path.length === 0) {
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      return;
    }

    const latLngs: L.LatLngExpression[] = path.map((point) => [
      point.lat,
      point.lng,
    ]);

    if (!polylineRef.current) {
      polylineRef.current = L.polyline(latLngs, {
        color: "#22c55e",
        weight: 5,
        opacity: 0.9,
      }).addTo(map);
    } else {
      polylineRef.current.setLatLngs(latLngs);
    }
  }, [path]);

  const autonomy = useMemo(() => {
    if (!settings || settings.consumptionRate <= 0) return 0;

    const currentFuelL = settings.currentFuelL ?? settings.tankSize;
    const currentAutonomy = (currentFuelL / settings.consumptionRate) * 100;

    return Math.max(0, currentAutonomy - distance);
  }, [settings, distance]);

  const handleReset = () => {
    resetRoute();
    hasCenteredRef.current = false;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
  };

  const handleCenter = () => {
    const map = mapRef.current;
    if (!map || !position) return;

    map.setView([position.lat, position.lng], 16);
    hasCenteredRef.current = true;
  };

  return (
    <div style={styles.container}>
      <div id="map" style={styles.map} />

      <div style={styles.hud}>
        <div style={styles.gpsPill}>● GPS {gpsStatus.toUpperCase()}</div>
        <div style={styles.accuracyPill}>
          Précision : {accuracy ? `${Math.round(accuracy)} m` : "-"}
        </div>
      </div>

      <div style={styles.speedCard}>
        <div style={styles.speedValue}>{Math.round(speed)}</div>
        <div style={styles.speedUnit}>KM/H</div>
      </div>

      <button style={styles.centerButton} onClick={handleCenter}>
        📍
      </button>

      <div style={styles.bottomPanel}>
        <div>
          <div style={styles.label}>Distance</div>
          <div style={styles.value}>{distance.toFixed(2)} km</div>
        </div>

        <div>
          <div style={styles.label}>Autonomie</div>
          <div style={styles.value}>{autonomy.toFixed(0)} km</div>
        </div>
      </div>

      <div style={styles.buttons}>
        <button style={styles.mainButton} onClick={toggleTracking}>
          {isTracking ? "Arrêter" : "Démarrer"}
        </button>

        {!isTracking && (
          <button style={styles.resetButton} onClick={handleReset}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    position: "relative",
    height: "100vh",
    width: "100%",
    overflow: "hidden",
    background: "#0f172a",
  },

  map: {
    height: "100%",
    width: "100%",
    filter: "saturate(0.95) contrast(1.03)",
  },

  hud: {
    position: "absolute",
    top: 18,
    left: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    zIndex: 500,
  },

  gpsPill: {
    padding: "10px 16px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.88)",
    border: "1px solid rgba(34,197,94,0.55)",
    color: "#22c55e",
    fontWeight: 800,
    fontSize: 14,
  },

  accuracyPill: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.88)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
  },

  speedCard: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 74,
    height: 74,
    borderRadius: 22,
    background: "rgba(15,23,42,0.9)",
    border: "1px solid rgba(255,255,255,0.14)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 500,
  },

  speedValue: {
    fontSize: 34,
    fontWeight: 900,
    lineHeight: 1,
    color: "white",
  },

  speedUnit: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: 800,
    opacity: 0.75,
  },

  centerButton: {
    position: "absolute",
    right: 18,
    bottom: 184,
    width: 48,
    height: 48,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.9)",
    color: "white",
    fontSize: 20,
    zIndex: 500,
  },

  bottomPanel: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 116,
    minHeight: 72,
    padding: "14px 18px",
    borderRadius: 24,
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(255,255,255,0.14)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 500,
  },

  label: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.65,
    fontWeight: 800,
  },

  value: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: 900,
    color: "white",
  },

  buttons: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 52,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 20px",
    gap: 12,
    zIndex: 1000,
  },

  mainButton: {
    minWidth: 120,
    padding: "14px 20px",
    borderRadius: 12,
    background: "#22c55e",
    color: "white",
    fontSize: 16,
    fontWeight: 800,
    border: "none",
    boxShadow: "0 8px 24px rgba(34,197,94,0.4)",
  },

  resetButton: {
    minWidth: 100,
    padding: "14px 20px",
    borderRadius: 12,
    background: "#ef4444",
    color: "white",
    fontSize: 16,
    fontWeight: 800,
    border: "none",
    boxShadow: "0 8px 24px rgba(239,68,68,0.4)",
  },
};