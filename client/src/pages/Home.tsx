import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSettings } from "@/hooks/useLocalSettings";
import { useTracking } from "@/context/TrackingContext";
import type { LeanSmoothingMode } from "@/lib/localDb";

const START_SPEED_THRESHOLD_KMH = 7;
const START_VALIDATION_SECONDS = 7;

export default function Home() {
  const {
    settings,
    loading,
    updateFuel,
    updateSettings,
    updateSettingsNow,
  } = useLocalSettings();

  const {
    speed,
    distance,
    gpsStatus,
    accuracy,
    isTracking,
    toggleTracking,
    resetRoute,
    leanAngle,
    leanAngleStatus,
    leanAngleStats,
    calibrateLeanAngleZero,
    requestLeanAnglePermission,
  } = useTracking();

  const [isWaitingForStart, setIsWaitingForStart] = useState(false);
  const [isTripValidated, setIsTripValidated] = useState(false);
  const [startValidationProgress, setStartValidationProgress] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [calibrationMessage, setCalibrationMessage] = useState<string | null>(
    null
  );
  const [isCalibrating, setIsCalibrating] = useState(false);

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

  const handleCalibrateZero = async () => {
    setCalibrationMessage(null);
    setIsCalibrating(true);

    try {
      const calibration = await calibrateLeanAngleZero();

      setCalibrationMessage(
        `Calibration OK : gamma ${calibration.gamma.toFixed(1)}°`
      );
    } catch (error) {
      console.error("Erreur calibration lean angle :", error);
      setCalibrationMessage(
        "Calibration impossible. Vérifiez les permissions capteurs."
      );
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestLeanAnglePermission();

    setCalibrationMessage(
      granted
        ? "Permission capteurs accordée."
        : "Permission capteurs refusée ou indisponible."
    );
  };

  const handleSmoothingChange = (mode: LeanSmoothingMode) => {
    updateSettings({
      leanSmoothingMode: mode,
      leanSmoothingFactor:
        mode === "sport" ? 0.2 : mode === "normal" ? 0.12 : 0.1,
    });
  };

  const displayedLeanAngle = Math.abs(Math.round(leanAngle));
  const direction = leanAngleStats.direction;

  const directionArrow =
    direction === "left" ? "↖" : direction === "right" ? "↗" : "↑";

  const directionLabel =
    direction === "left"
      ? "Inclinaison gauche"
      : direction === "right"
      ? "Inclinaison droite"
      : "Position neutre";

  return (
    <div style={styles.container}>
      <div style={styles.leanInlineCard}>
        <div style={styles.leanHeaderRow}>
          <span style={styles.leanSmallLabel}>Lean angle</span>

          <button
            style={styles.settingsButton}
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Paramètres MotoTrack"
          >
            ⚙️
          </button>
        </div>

        <div style={styles.leanStatusRow}>
          <span style={styles.leanSmallStatus}>{leanAngleStatus}</span>
          {settings?.leanCalibration?.calibratedAt && (
            <span style={styles.leanCalibrated}>calibré</span>
          )}
        </div>

        <div style={styles.leanInlineContent}>
          <div
            style={{
              ...styles.leanArrowBadge,
              transform:
                direction === "left"
                  ? "rotate(-18deg)"
                  : direction === "right"
                  ? "rotate(18deg)"
                  : "rotate(0deg)",
            }}
          >
            {directionArrow}
          </div>

          <div style={styles.leanInlineTextBlock}>
            <div style={styles.leanInlineValue}>{displayedLeanAngle}°</div>
            <div style={styles.leanInlineLabel}>{directionLabel}</div>
          </div>
        </div>
      </div>

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
            Carburant : {settings.currentFuelL.toFixed(1)} / {settings.tankSize}{" "}
            L · Conso : {settings.consumptionRate} L/100 km
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

      {isSettingsOpen && settings && (
        <div style={styles.modalOverlay}>
          <div style={styles.settingsPanel}>
            <div style={styles.settingsHeader}>
              <div>
                <h2 style={styles.settingsTitle}>Paramètres MotoTrack</h2>
                <p style={styles.settingsSubtitle}>
                  Réglages évolutifs de l’application
                </p>
              </div>

              <button
                style={styles.closeButton}
                onClick={() => setIsSettingsOpen(false)}
              >
                ✕
              </button>
            </div>

            <section style={styles.settingsSection}>
              <h3 style={styles.sectionTitle}>Lean angle</h3>

              <div style={styles.toggleRow}>
                <div>
                  <strong>Activer le Lean angle</strong>
                  <p style={styles.settingHelp}>
                    Désactive l’affichage et l’enregistrement des angles.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={settings.leanAngleEnabled}
                  onChange={(event) =>
                    updateSettingsNow({
                      leanAngleEnabled: event.target.checked,
                    })
                  }
                />
              </div>

              <div style={styles.calibrationBox}>
                <strong>Calibration 0°</strong>
                <p style={styles.settingHelp}>
                  Placez le deux-roues droit, guidon droit, téléphone fixé
                  normalement, puis lancez la calibration.
                </p>

                <div style={styles.calibrationButtons}>
                  <button
                    style={styles.secondaryButton}
                    onClick={handleRequestPermission}
                  >
                    Autoriser capteurs
                  </button>

                  <button
                    style={styles.primaryButton}
                    disabled={isCalibrating}
                    onClick={handleCalibrateZero}
                  >
                    {isCalibrating ? "Calibration..." : "Définir 0°"}
                  </button>
                </div>

                {settings.leanCalibration && (
                  <div style={styles.calibrationInfo}>
                    Dernière calibration :{" "}
                    {new Date(
                      settings.leanCalibration.calibratedAt
                    ).toLocaleString("fr-FR")}
                    <br />
                    Gamma référence : {settings.leanCalibration.gamma.toFixed(1)}°
                  </div>
                )}

                {calibrationMessage && (
                  <div style={styles.calibrationMessage}>
                    {calibrationMessage}
                  </div>
                )}
              </div>

              <SettingNumber
                label="Angle affiché dès"
                help="Seuil minimum pour afficher gauche/droite sur l’accueil."
                value={settings.leanMinDisplayAngle}
                unit="°"
                min={0}
                max={30}
                step={1}
                onChange={(value) =>
                  updateSettings({ leanMinDisplayAngle: value })
                }
              />

              <SettingNumber
                label="Angle enregistré dès"
                help="Seuil minimum pour les statistiques de trajet."
                value={settings.leanMinRecordedAngle}
                unit="°"
                min={0}
                max={60}
                step={1}
                onChange={(value) =>
                  updateSettings({ leanMinRecordedAngle: value })
                }
              />

              <SettingNumber
                label="Vitesse minimale de calcul"
                help="En dessous de cette vitesse, les angles ne sont pas enregistrés."
                value={settings.leanMinSpeedKmh}
                unit="km/h"
                min={0}
                max={80}
                step={1}
                onChange={(value) => updateSettings({ leanMinSpeedKmh: value })}
              />

              <SettingNumber
                label="Angle maximum accepté"
                help="Plafond anti-valeurs aberrantes."
                value={settings.leanMaxAngle}
                unit="°"
                min={30}
                max={90}
                step={1}
                onChange={(value) => updateSettings({ leanMaxAngle: value })}
              />

              <label style={styles.settingField}>
                <span style={styles.settingLabel}>Lissage</span>
                <span style={styles.settingHelp}>
                  Souple = stable, Sport = plus réactif.
                </span>

                <select
                  value={settings.leanSmoothingMode}
                  style={styles.select}
                  onChange={(event) =>
                    handleSmoothingChange(
                      event.target.value as LeanSmoothingMode
                    )
                  }
                >
                  <option value="soft">Souple</option>
                  <option value="normal">Normal</option>
                  <option value="sport">Sport</option>
                </select>
              </label>
            </section>

            <button
              style={styles.doneButton}
              onClick={() => setIsSettingsOpen(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingNumber({
  label,
  help,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={styles.settingField}>
      <span style={styles.settingLabel}>{label}</span>
      <span style={styles.settingHelp}>{help}</span>

      <div style={styles.settingNumberRow}>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          style={styles.settingInput}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            if (!Number.isFinite(parsed)) return;
            onChange(Math.min(max, Math.max(min, parsed)));
          }}
        />

        <span style={styles.settingUnit}>{unit}</span>
      </div>
    </label>
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
    paddingBottom: "96px",
  },

  leanInlineCard: {
    width: "100%",
    maxWidth: "340px",
    padding: "14px 16px",
    borderRadius: "18px",
    background: "rgba(59, 130, 246, 0.10)",
    border: "1px solid rgba(59, 130, 246, 0.22)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  },

  leanHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "6px",
  },

  leanStatusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  },

  leanSmallLabel: {
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    opacity: 0.75,
  },

  leanSmallStatus: {
    fontSize: "12px",
    opacity: 0.62,
  },

  leanCalibrated: {
    fontSize: "11px",
    padding: "3px 8px",
    borderRadius: "999px",
    color: "#bbf7d0",
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.25)",
  },

  settingsButton: {
    width: "34px",
    height: "34px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontSize: "17px",
  },

  leanInlineContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "14px",
  },

  leanArrowBadge: {
    width: "58px",
    height: "58px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.10)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "30px",
    fontWeight: 800,
    transition: "transform 0.18s ease",
  },

  leanInlineTextBlock: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
  },

  leanInlineValue: {
    fontSize: "34px",
    fontWeight: 900,
    lineHeight: 1,
  },

  leanInlineLabel: {
    fontSize: "13px",
    opacity: 0.72,
    marginTop: "6px",
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

  modalOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(2,6,23,0.76)",
    backdropFilter: "blur(10px)",
    zIndex: 50,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "16px",
  },

  settingsPanel: {
    width: "100%",
    maxWidth: "520px",
    maxHeight: "88vh",
    overflowY: "auto" as const,
    borderRadius: "24px",
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
    padding: "18px",
  },

  settingsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "16px",
  },

  settingsTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 900,
  },

  settingsSubtitle: {
    margin: "4px 0 0",
    fontSize: "13px",
    opacity: 0.62,
  },

  closeButton: {
    width: "36px",
    height: "36px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontSize: "16px",
    cursor: "pointer",
  },

  settingsSection: {
    padding: "14px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
  },

  sectionTitle: {
    margin: "0 0 14px",
    fontSize: "16px",
    fontWeight: 900,
  },

  toggleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(15,23,42,0.55)",
    marginBottom: "12px",
  },

  settingHelp: {
    display: "block",
    marginTop: "4px",
    fontSize: "12px",
    opacity: 0.62,
    lineHeight: 1.4,
  },

  calibrationBox: {
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.2)",
    marginBottom: "12px",
  },

  calibrationButtons: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginTop: "12px",
  },

  primaryButton: {
    minHeight: "40px",
    borderRadius: "12px",
    border: "none",
    background: "#2563eb",
    color: "white",
    fontWeight: 800,
  },

  secondaryButton: {
    minHeight: "40px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 800,
  },

  calibrationInfo: {
    marginTop: "10px",
    fontSize: "12px",
    lineHeight: 1.5,
    opacity: 0.72,
  },

  calibrationMessage: {
    marginTop: "10px",
    padding: "10px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.08)",
    fontSize: "12px",
    lineHeight: 1.4,
  },

  settingField: {
    display: "block",
    marginTop: "12px",
  },

  settingLabel: {
    display: "block",
    fontSize: "13px",
    fontWeight: 800,
  },

  settingNumberRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "8px",
  },

  settingInput: {
    flex: 1,
    height: "40px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.72)",
    color: "white",
    padding: "0 12px",
    fontSize: "15px",
  },

  settingUnit: {
    minWidth: "44px",
    fontSize: "13px",
    opacity: 0.72,
  },

  select: {
    width: "100%",
    height: "42px",
    marginTop: "8px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#0f172a",
    color: "white",
    padding: "0 12px",
    fontSize: "15px",
  },

  doneButton: {
    width: "100%",
    minHeight: "44px",
    borderRadius: "14px",
    border: "none",
    background: "#22c55e",
    color: "white",
    fontWeight: 900,
    marginTop: "14px",
  },
};