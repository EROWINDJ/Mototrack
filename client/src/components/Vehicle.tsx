import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Bike,
  Camera,
  Droplet,
  FileText,
  Fuel,
  Gauge,
  IdCard,
  Loader2,
  Lock,
  Save,
  Unlock,
} from "lucide-react";
import { getVehicle, saveVehicle, type VehicleData } from "@/lib/localDb";
import { useLocalSettings } from "@/hooks/useLocalSettings";

export default function Vehicle() {
  const { settings, loading, updateSettings, updateFuel } = useLocalSettings();

  const [vehicle, setVehicle] = useState<VehicleData | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const carteGriseInputRef = useRef<HTMLInputElement | null>(null);
  const permisInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getVehicle().then(setVehicle);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const remainingAutonomy = useMemo(() => {
    if (!settings || settings.consumptionRate <= 0) return 0;
    return Math.round((settings.currentFuelL / settings.consumptionRate) * 100);
  }, [settings]);

  const maxAutonomy = useMemo(() => {
    if (!settings || settings.consumptionRate <= 0) return 0;
    return Math.round((settings.tankSize / settings.consumptionRate) * 100);
  }, [settings]);

  const fuelPercent = useMemo(() => {
    if (!settings || settings.tankSize <= 0) return 0;
    return Math.min(100, Math.max(0, (settings.currentFuelL / settings.tankSize) * 100));
  }, [settings]);

  const updateVehicleField = (
    field: keyof Omit<VehicleData, "id">,
    value: string
  ) => {
    setVehicle((previous) => {
      if (!previous) return previous;
      return { ...previous, [field]: value };
    });

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      saveVehicle({ [field]: value });
    }, 400);
  };

  const handleToggleLock = async () => {
    if (!vehicle) return;

    if (!isLocked) {
      const { id, ...data } = vehicle;
      await saveVehicle(data);
    }

    setIsLocked((previous) => !previous);
  };

  const handleTankSizeChange = (value: number) => {
    if (!settings) return;

    updateSettings({
      tankSize: value,
      currentFuelL: Math.min(settings.currentFuelL, value),
    });
  };

  const handleCurrentFuelChange = (value: number) => {
    if (!settings) return;
    updateFuel(Math.min(Math.max(0, value), settings.tankSize));
  };

  const handleRefuelFull = () => {
    if (!settings) return;
    updateFuel(settings.tankSize);
  };

  const handleCarteGriseUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanError(null);

    try {
      const base64 = await fileToBase64(file);
      await saveVehicle({ carteGriseImage: base64 });

      setVehicle((previous) =>
        previous ? { ...previous, carteGriseImage: base64 } : previous
      );

      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("fra");
      const { data } = await worker.recognize(file);
      await worker.terminate();

      const extracted = parseCarteGrise(data.text);
      const updates = { ...extracted, carteGriseImage: base64 };

      await saveVehicle(updates);

      setVehicle((previous) =>
        previous ? { ...previous, ...updates } : previous
      );
    } catch (error) {
      console.error("Erreur OCR :", error);
      setScanError("Scan non exploitable. Vous pouvez saisir les données manuellement.");
    } finally {
      setIsScanning(false);
      event.target.value = "";
    }
  };

  const handlePermisUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const base64 = await fileToBase64(file);
    await saveVehicle({ permisImage: base64 });

    setVehicle((previous) =>
      previous ? { ...previous, permisImage: base64 } : previous
    );

    event.target.value = "";
  };

  if (loading || !settings || !vehicle) {
    return (
      <div style={styles.loading}>
        <Loader2 size={28} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.iconBox}>
          <Bike size={24} />
        </div>
        <div>
          <h1 style={styles.title}>Mon véhicule</h1>
          <p style={styles.subtitle}>Réglages locaux de Mototrack</p>
        </div>
      </div>

      <button style={styles.lockButton} onClick={handleToggleLock}>
        {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
        {isLocked ? "Déverrouiller les données" : "Verrouiller et sauvegarder"}
        {!isLocked && <Save size={18} />}
      </button>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>Autonomie</h2>
            <p style={styles.cardText}>Réservoir, carburant actuel, consommation et réserve</p>
          </div>
          <Fuel size={26} />
        </div>

        <div style={styles.autonomyValue}>{remainingAutonomy} km</div>
        <p style={styles.cardText}>
          Autonomie maximale estimée : {maxAutonomy} km · Carburant : {settings.currentFuelL.toFixed(1)} / {settings.tankSize} L
        </p>

        <div style={styles.fuelBar}>
          <div style={{ ...styles.fuelBarFill, width: `${fuelPercent}%` }} />
        </div>

        <div style={styles.grid2}>
          <FieldNumber
            label="Réservoir"
            value={settings.tankSize}
            unit="L"
            disabled={isLocked}
            icon={<Droplet size={16} />}
            step={0.1}
            onChange={handleTankSizeChange}
          />

          <FieldNumber
            label="Carburant actuel"
            value={settings.currentFuelL}
            unit="L"
            disabled={isLocked}
            icon={<Fuel size={16} />}
            step={0.1}
            onChange={handleCurrentFuelChange}
          />
        </div>

        <FieldNumber
          label="Consommation"
          value={settings.consumptionRate}
          unit="L/100"
          disabled={isLocked}
          icon={<Gauge size={16} />}
          step={0.1}
          onChange={(value) => updateSettings({ consumptionRate: value })}
        />

        <button
          style={styles.refuelButton}
          disabled={isLocked}
          onClick={handleRefuelFull}
        >
          ⛽ Faire le plein
        </button>

        <div style={styles.reserveBox}>
          <div style={styles.reserveLeft}>
            <AlertTriangle size={20} color="#facc15" />
            <div>
              <strong>Alerte réserve</strong>
              <p style={styles.cardText}>
                Alerte quand l’autonomie descend sous {settings.reserveThresholdKm} km
              </p>
            </div>
          </div>

          <input
            type="checkbox"
            checked={settings.reserveAlertEnabled}
            disabled={isLocked}
            onChange={(e) => updateSettings({ reserveAlertEnabled: e.target.checked })}
          />
        </div>

        <FieldNumber
          label="Seuil de réserve"
          value={settings.reserveThresholdKm}
          unit="km"
          disabled={isLocked}
          icon={<AlertTriangle size={16} />}
          onChange={(value) => updateSettings({ reserveThresholdKm: value })}
        />
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>Carte grise</h2>
            <p style={styles.cardText}>Saisie manuelle ou scan OCR</p>
          </div>

          <button
            style={styles.smallButton}
            disabled={isLocked || isScanning}
            onClick={() => carteGriseInputRef.current?.click()}
          >
            {isScanning ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            Scanner
          </button>
        </div>

        <input
          ref={carteGriseInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handleCarteGriseUpload}
        />

        {scanError && <div style={styles.warning}>{scanError}</div>}

        <div style={styles.grid2}>
          <FieldText label="Immatriculation" value={vehicle.immatriculation} disabled={isLocked} onChange={(v) => updateVehicleField("immatriculation", v)} />
          <FieldText label="Marque" value={vehicle.marque} disabled={isLocked} onChange={(v) => updateVehicleField("marque", v)} />
        </div>

        <FieldText label="Modèle" value={vehicle.modele} disabled={isLocked} onChange={(v) => updateVehicleField("modele", v)} />

        <div style={styles.grid3}>
          <FieldText label="Cylindrée" value={vehicle.cylindree} unit="cm³" disabled={isLocked} onChange={(v) => updateVehicleField("cylindree", v)} />
          <FieldText label="Puissance" value={vehicle.puissance} unit="kW" disabled={isLocked} onChange={(v) => updateVehicleField("puissance", v)} />
          <FieldText label="Poids" value={vehicle.poids} unit="kg" disabled={isLocked} onChange={(v) => updateVehicleField("poids", v)} />
        </div>

        <FieldText label="Type véhicule" value={vehicle.typeVehicule} disabled={isLocked} onChange={(v) => updateVehicleField("typeVehicule", v)} />
        <FieldText label="VIN" value={vehicle.vin} disabled={isLocked} onChange={(v) => updateVehicleField("vin", v)} />
        <FieldText label="Mise en circulation" value={vehicle.miseEnCirculation} disabled={isLocked} onChange={(v) => updateVehicleField("miseEnCirculation", v)} />
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>Documents</h2>
            <p style={styles.cardText}>Stockage local des justificatifs</p>
          </div>
        </div>

        <div style={styles.grid2}>
          <DocumentBlock
            title="Carte grise"
            icon={<FileText size={18} />}
            image={vehicle.carteGriseImage}
            disabled={isLocked}
            onClick={() => carteGriseInputRef.current?.click()}
          />

          <DocumentBlock
            title="Permis"
            icon={<IdCard size={18} />}
            image={vehicle.permisImage}
            disabled={isLocked}
            onClick={() => permisInputRef.current?.click()}
          />
        </div>

        <input
          ref={permisInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handlePermisUpload}
        />
      </section>
    </div>
  );
}

function FieldText({
  label,
  value,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  unit?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <div style={styles.inputWrap}>
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={styles.input}
        />
        {unit && <span style={styles.unit}>{unit}</span>}
      </div>
    </label>
  );
}

function FieldNumber({
  label,
  value,
  unit,
  icon,
  disabled,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  icon: ReactNode;
  disabled: boolean;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <div style={styles.inputWrap}>
        <span style={styles.inputIcon}>{icon}</span>
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={0}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          style={{ ...styles.input, paddingLeft: 36 }}
        />
        <span style={styles.unit}>{unit}</span>
      </div>
    </label>
  );
}

function DocumentBlock({
  title,
  icon,
  image,
  disabled,
  onClick,
}: {
  title: string;
  icon: ReactNode;
  image?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div style={styles.document}>
      <div style={styles.documentHeader}>
        {icon}
        <strong>{title}</strong>
      </div>

      {image ? (
        <img src={image} alt={title} style={styles.documentImage} />
      ) : (
        <div style={styles.emptyDocument}>Aucun document</div>
      )}

      <button style={styles.smallButton} disabled={disabled} onClick={onClick}>
        <Camera size={16} />
        Ajouter / remplacer
      </button>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseCarteGrise(text: string): Partial<VehicleData> {
  const result: Partial<VehicleData> = {};
  const lines = text.toUpperCase();

  const immatMatch = lines.match(/([A-Z]{2}[\s-]*\d{3}[\s-]*[A-Z]{2})/);
  if (immatMatch) result.immatriculation = immatMatch[1].replace(/\s/g, "-");

  const vinMatch = lines.match(/([A-HJ-NPR-Z0-9]{17})/);
  if (vinMatch) result.vin = vinMatch[1];

  const brands = [
    "YAMAHA",
    "HONDA",
    "KAWASAKI",
    "SUZUKI",
    "BMW",
    "DUCATI",
    "TRIUMPH",
    "KTM",
    "HARLEY",
    "APRILIA",
    "MOTO GUZZI",
    "ROYAL ENFIELD",
    "PIAGGIO",
    "VESPA",
    "PEUGEOT",
    "SYM",
    "KYMCO",
  ];

  for (const brand of brands) {
    if (lines.includes(brand)) {
      result.marque = brand;
      break;
    }
  }

  const dateMatch = lines.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (dateMatch) result.miseEnCirculation = dateMatch[1];

  const cylMatch = lines.match(/(\d{2,4})\s*(?:CM3|CC|CM²)/);
  if (cylMatch) result.cylindree = cylMatch[1];

  const kwMatch = lines.match(/(\d{1,3})\s*KW/);
  if (kwMatch) result.puissance = kwMatch[1];

  return result;
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "white",
    padding: "24px",
    paddingBottom: "96px",
    fontFamily: "sans-serif",
  },
  loading: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "20px",
  },
  iconBox: {
    width: "46px",
    height: "46px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    margin: 0,
    fontSize: "26px",
    fontWeight: 800,
  },
  subtitle: {
    margin: "4px 0 0",
    opacity: 0.65,
    fontSize: "13px",
  },
  lockButton: {
    width: "100%",
    maxWidth: "720px",
    height: "48px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontWeight: 700,
    margin: "0 auto 18px",
  },
  card: {
    width: "100%",
    maxWidth: "720px",
    margin: "0 auto 18px",
    padding: "18px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
    marginBottom: "16px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 800,
  },
  cardText: {
    margin: "4px 0 0",
    opacity: 0.65,
    fontSize: "13px",
  },
  autonomyValue: {
    fontSize: "42px",
    fontWeight: 900,
    marginBottom: "4px",
  },
  fuelBar: {
    width: "100%",
    height: "10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    marginTop: "14px",
  },
  fuelBarFill: {
    height: "100%",
    borderRadius: "999px",
    background: "#22c55e",
    transition: "width 0.25s ease",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    marginTop: "16px",
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "10px",
    marginTop: "12px",
  },
  field: {
    display: "block",
    marginTop: "12px",
  },
  label: {
    display: "block",
    fontSize: "11px",
    opacity: 0.65,
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  inputWrap: {
    position: "relative",
  },
  inputIcon: {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    opacity: 0.65,
  },
  input: {
    width: "100%",
    height: "42px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.7)",
    color: "white",
    padding: "0 42px 0 12px",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  },
  unit: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "12px",
    opacity: 0.65,
  },
  refuelButton: {
    width: "100%",
    minHeight: "42px",
    borderRadius: "12px",
    border: "none",
    background: "#2563eb",
    color: "white",
    fontWeight: 800,
    marginTop: "14px",
  },
  reserveBox: {
    marginTop: "16px",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  reserveLeft: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  warning: {
    padding: "12px",
    borderRadius: "12px",
    background: "rgba(250,204,21,0.12)",
    border: "1px solid rgba(250,204,21,0.25)",
    color: "#facc15",
    fontSize: "13px",
    marginBottom: "12px",
  },
  smallButton: {
    minHeight: "38px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: 700,
  },
  document: {
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.5)",
  },
  documentHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
  },
  documentImage: {
    width: "100%",
    height: "140px",
    objectFit: "cover",
    borderRadius: "12px",
    marginBottom: "10px",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  emptyDocument: {
    height: "140px",
    borderRadius: "12px",
    border: "1px dashed rgba(255,255,255,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.6,
    marginBottom: "10px",
    fontSize: "13px",
  },
};
