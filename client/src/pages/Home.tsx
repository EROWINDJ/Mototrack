import { useMemo } from "react";
import { useLocalSettings } from "@/hooks/useLocalSettings";
import { useTracking } from "@/context/TrackingContext";

export default function Home() {
  const { settings, loading, updateFuel } = useLocalSettings();

  const {
    speed,
    distance,
    gpsStatus,
    accuracy,
    isTracking,
    toggleTracking,
    resetRoute,
  } = useTracking();

  const remainingAutonomy = useMemo(() => {
    if (!settings || settings.consumptionRate <= 0) return 0;
    return (settings.currentFuelL / settings.consumptionRate) * 100;
  }, [settings]);

  const liveAutonomy = useMemo(() => {
    return Math.max(0, remainingAutonomy - distance);
  }, [remainingAutonomy, distance]);

  const isReserve = useMemo(() => {
    if (!settings) return false;
    return liveAutonomy <= settings.reserveThresholdKm;
  }, [settings, liveAutonomy]);

  const handleRefuel = async () => {
    if (!settings || isTracking) return;
    await updateFuel(settings.tankSize);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Mototrack</h1>

      <div style={styles.status}>
        <p>GPS : {gpsStatus}</p>
        <p>Précision : {accuracy ? `${Math.round(accuracy)} m` : "-"}</p>
      </div>

      <div style={styles.speed}>
        <span style={styles.speedValue}>{Math.round(speed)}</span>
        <span style={styles.unit}>km/h</span>
      </div>

      <div style={styles.distance}>Distance : {distance.toFixed(2)} km</div>

      <div style={styles.autonomyCard}>
        <div style={styles.autonomyLabel}>Autonomie estimée</div>

        <div style={styles.autonomyValue}>
          {loading ? "..." : `${liveAutonomy.toFixed(0)} km`}
        </div>

        {!loading && settings && (
          <div style={styles.autonomyDetails}>
            Carburant : {settings.currentFuelL.toFixed(1)} / {settings.tankSize} L · Conso :{" "}
            {settings.consumptionRate} L/100 km
          </div>
        )}

        {!loading &&
          settings &&
          isReserve &&
          settings.reserveAlertEnabled && (
            <div style={styles.reserveAlert}>⚠️ Réserve atteinte</div>
          )}
      </div>

      <div style={styles.buttons}>
        <button onClick={toggleTracking} style={styles.mainButton}>
          {isTracking ? "Arrêter" : "Démarrer"}
        </button>

        {!isTracking && (
          <>
            <button onClick={handleRefuel} style={styles.refuelButton}>
              ⛽ Faire le plein
            </button>

            <button onClick={resetRoute} style={styles.resetButton}>
              Reset
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "white",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    fontFamily: "sans-serif",
    padding: "24px",
  },

  title: {
    fontSize: "28px",
    fontWeight: "bold",
    margin: 0,
  },

  status: {
    fontSize: "14px",
    opacity: 0.75,
    lineHeight: 1.4,
  },

  speed: {
    display: "flex",
    alignItems: "baseline",
    gap: "10px",
  },

  speedValue: {
    fontSize: "72px",
    fontWeight: "bold",
  },

  unit: {
    fontSize: "20px",
    opacity: 0.7,
  },

  distance: {
    fontSize: "18px",
    fontWeight: 600,
  },

  autonomyCard: {
    width: "100%",
    maxWidth: "320px",
    padding: "16px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    textAlign: "center" as const,
  },

  autonomyLabel: {
    fontSize: "13px",
    opacity: 0.7,
    marginBottom: "6px",
  },

  autonomyValue: {
    fontSize: "28px",
    fontWeight: "bold",
  },

  autonomyDetails: {
    marginTop: "8px",
    fontSize: "12px",
    opacity: 0.65,
  },

  reserveAlert: {
    marginTop: "10px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#facc15",
  },

  buttons: {
    display: "flex",
    flexWrap: "wrap" as const,
    justifyContent: "center",
    gap: "10px",
  },

  mainButton: {
    padding: "12px 24px",
    fontSize: "16px",
    color: "white",
    background: "#22c55e",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },

  refuelButton: {
    padding: "12px 18px",
    fontSize: "15px",
    color: "white",
    background: "#2563eb",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },

  resetButton: {
    padding: "12px 18px",
    fontSize: "15px",
    color: "white",
    background: "#ef4444",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
};