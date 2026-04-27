import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSettings } from "@/hooks/useLocalSettings";
import { useTracking } from "@/context/TrackingContext";

const START_SPEED_THRESHOLD_KMH = 7;
const START_VALIDATION_SECONDS = 7;
const MAX_GPS_ACCURACY_METERS = 30;

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

  const [isWaitingForStart, setIsWaitingForStart] = useState(false);
  const [isTripValidated, setIsTripValidated] = useState(false);
  const [startValidationProgress, setStartValidationProgress] = useState(0);

  const startValidationStartedAtRef = useRef<number | null>(null);
  const validationIntervalRef = useRef<number | null>(null);

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

  const clearStartValidation = () => {
    startValidationStartedAtRef.current = null;
    setStartValidationProgress(0);

    if (validationIntervalRef.current !== null) {
      window.clearInterval(validationIntervalRef.current);
      validationIntervalRef.current = null;
    }
  };

  const validateRealStart = () => {
    clearStartValidation();

    resetRoute();

    setIsWaitingForStart(false);
    setIsTripValidated(true);
    setStartValidationProgress(100);
  };

  useEffect(() => {
    if (!isTracking || !isWaitingForStart || isTripValidated) {
      clearStartValidation();
      return;
    }

    if (speed > START_SPEED_THRESHOLD_KMH) {
      if (startValidationStartedAtRef.current === null) {
        startValidationStartedAtRef.current = Date.now();
      }

      if (validationIntervalRef.current === null) {
        validationIntervalRef.current = window.setInterval(() => {
          if (startValidationStartedAtRef.current === null) return;

          const elapsedSeconds =
            (Date.now() - startValidationStartedAtRef.current) / 1000;

          const progress = Math.min(
            100,
            (elapsedSeconds / START_VALIDATION_SECONDS) * 100
          );

          setStartValidationProgress(progress);

          if (elapsedSeconds >= START_VALIDATION_SECONDS) {
            validateRealStart();
          }
        }, 250);
      }
    } else {
      clearStartValidation();
    }

    return () => {};
  }, [speed, isTracking, isWaitingForStart, isTripValidated]);

  const handleSmartTracking = () => {
    if (!isTracking) {
      resetRoute();

      setIsWaitingForStart(true);
      setIsTripValidated(false);
      setStartValidationProgress(0);
      clearStartValidation();

      toggleTracking();
      return;
    }

    if (isWaitingForStart && !isTripValidated) {
      clearStartValidation();

      setIsWaitingForStart(false);
      setIsTripValidated(false);
      setStartValidationProgress(0);

      resetRoute();
      toggleTracking();
      return;
    }

    clearStartValidation();

    setIsWaitingForStart(false);
    setIsTripValidated(false);
    setStartValidationProgress(0);

    toggleTracking();
  };

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

      {isWaitingForStart && (
        <div style={styles.waitingCard}>
          <div style={styles.waitingTitle}>En attente de départ</div>

          <div style={styles.waitingText}>
            Roulez au-dessus de {START_SPEED_THRESHOLD_KMH} km/h pendant{" "}
            {START_VALIDATION_SECONDS} secondes pour lancer le trajet.
          </div>

          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${startValidationProgress}%`,
              }}
            />
          </div>

          <div style={styles.waitingSmall}>
            Progression : {Math.round(startValidationProgress)} %
          </div>
        </div>
      )}

      {isTripValidated && isTracking && (
        <div style={styles.activeTripBadge}>Trajet en cours</div>
      )}

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
            Carburant : {settings.currentFuelL.toFixed(1)} / {settings.tankSize} L ·
            Conso : {settings.consumptionRate} L/100 km
          </div>
        )}

        {!loading && settings && isReserve && settings.reserveAlertEnabled && (
          <div style={styles.reserveAlert}>⚠️ Réserve atteinte</div>
        )}
      </div>

      <div style={styles.buttons}>
        <button
          onClick={handleSmartTracking}
          style={{
            ...styles.mainButton,
            background: isTracking ? "#ef4444" : "#22c55e",
          }}
        >
          {isTracking ? "Arrêter" : "Démarrer"}
        </button>

        {!isTracking && (
          <button onClick={handleRefuel} style={styles.refuelButton}>
            ⛽ Faire le plein
          </button>
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
    textAlign: "center" as const,
  },

  waitingCard: {
    width: "100%",
    maxWidth: "340px",
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(251, 146, 60, 0.14)",
    border: "1px solid rgba(251, 146, 60, 0.35)",
    textAlign: "center" as const,
  },

  waitingTitle: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#fdba74",
    marginBottom: "6px",
  },

  waitingText: {
    fontSize: "13px",
    opacity: 0.88,
    lineHeight: 1.4,
  },

  waitingSmall: {
    marginTop: "8px",
    fontSize: "12px",
    opacity: 0.7,
  },

  progressTrack: {
    width: "100%",
    height: "8px",
    background: "rgba(255,255,255,0.12)",
    borderRadius: "999px",
    overflow: "hidden",
    marginTop: "12px",
  },

  progressFill: {
    height: "100%",
    background: "#fb923c",
    borderRadius: "999px",
    transition: "width 0.25s ease",
  },

  activeTripBadge: {
    padding: "8px 14px",
    borderRadius: "999px",
    background: "rgba(34, 197, 94, 0.16)",
    border: "1px solid rgba(34, 197, 94, 0.35)",
    color: "#86efac",
    fontSize: "13px",
    fontWeight: 700,
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
};