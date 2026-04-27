import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface SpeedWarning {
  speed: number;
  limit: number;
  message: string;
}

export interface TripPoint {
  lat: number;
  lng: number;
  timestamp?: number;
  speed?: number;
}

export interface LocalTrip {
  id: string;
  startedAt: string;
  endedAt: string;

  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;

  consumedFuelL: number;
  consumptionRateL100: number;

  durationMinutes: number;

  autonomyBeforeKm?: number;
  autonomyAfterKm?: number;

  maxLeanAngle?: number;
  leanAngleAvgLeft?: number;
  leanAngleAvgRight?: number;
  leanAngleMaxLeft?: number;
  leanAngleMaxRight?: number;
  leanAngleSampleCountLeft?: number;
  leanAngleSampleCountRight?: number;

  speedWarnings?: SpeedWarning[];
  shareText?: string;

  path?: TripPoint[];

  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;

  startAddress?: string;
  startCity?: string;
  endAddress?: string;
  endCity?: string;
}

export interface LeanCalibration {
  beta: number;
  gamma: number;
  calibratedAt: string;
}

export type LeanSmoothingMode = "soft" | "normal" | "sport";

export interface LocalSettings {
  id: "default";
  tankSize: number;
  consumptionRate: number;
  currentFuelL: number;
  stopDurationForRefuelAlert: number;
  profileName: string;
  motoBrand: string;
  reserveAlertEnabled: boolean;
  reserveThresholdKm: number;

  leanCalibration: LeanCalibration | null;
  leanAngleEnabled: boolean;
  leanMaxAngle: number;
  leanMinDisplayAngle: number;
  leanMinRecordedAngle: number;
  leanMinSpeedKmh: number;
  leanSmoothingMode: LeanSmoothingMode;
  leanSmoothingFactor: number;
}

export interface VehicleData {
  id: "default";

  immatriculation: string;
  marque: string;
  modele: string;
  vin: string;
  miseEnCirculation: string;
  puissance: string;
  cylindree: string;
  poids: string;
  typeVehicule: string;

  carteGriseImage?: string;
  permisImage?: string;
  permisRectoImage?: string;
  permisVersoImage?: string;
}

export interface MotoTrackExportData {
  app: "MotoTrack";
  exportVersion: number;
  exportedAt: string;
  settings: LocalSettings;
  vehicle: VehicleData;
  trips: LocalTrip[];
}

export interface MotoTrackImportResult {
  settingsImported: boolean;
  vehicleImported: boolean;
  tripsImported: number;
}

interface MotoTrackDB extends DBSchema {
  trips: {
    key: string;
    value: LocalTrip;
    indexes: {
      "by-date": string;
    };
  };
  settings: {
    key: string;
    value: LocalSettings;
  };
  vehicle: {
    key: string;
    value: VehicleData;
  };
}

const DB_NAME = "mototrack-v1";
const DB_VERSION = 4;
const SETTINGS_UPDATED_EVENT = "mototrack:settings-updated";

let dbPromise: Promise<IDBPDatabase<MotoTrackDB>> | null = null;

function getDb(): Promise<IDBPDatabase<MotoTrackDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MotoTrackDB>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, transaction) {
        let tripStore;

        if (!db.objectStoreNames.contains("trips")) {
          tripStore = db.createObjectStore("trips", { keyPath: "id" });
        } else {
          tripStore = transaction.objectStore("trips");
        }

        if (!tripStore.indexNames.contains("by-date")) {
          tripStore.createIndex("by-date", "startedAt");
        }

        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains("vehicle")) {
          db.createObjectStore("vehicle", { keyPath: "id" });
        }
      },
    });
  }

  return dbPromise;
}

// --- Trips ---

export async function getAllTrips(): Promise<LocalTrip[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("trips", "by-date");
  return all.reverse();
}

export async function saveTrip(
  trip: Omit<LocalTrip, "id" | "shareText">
): Promise<LocalTrip> {
  const db = await getDb();

  const id = crypto.randomUUID();
  const shareText = buildShareText(trip);

  const full: LocalTrip = {
    ...trip,
    id,
    shareText,
  };

  await db.put("trips", full);
  return full;
}

export async function deleteTrip(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("trips", id);
}

function buildShareText(trip: Omit<LocalTrip, "id" | "shareText">): string {
  const dist = Number(trip.distanceKm || 0).toFixed(1);
  const avg = Number(trip.avgSpeedKmh || 0).toFixed(0);
  const max = Number(trip.maxSpeedKmh || 0).toFixed(0);
  const conso = Number(trip.consumptionRateL100 || 0).toFixed(1);

  const dur = Number(trip.durationMinutes || 0);
  const h = Math.floor(dur / 60);
  const m = dur % 60;
  const durStr = h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;

  const start = formatPlace(trip.startAddress, trip.startCity);
  const end = formatPlace(trip.endAddress, trip.endCity);

  let text = `🏍️ Trajet MotoTrack\n📍 ${dist} km en ${durStr}\n⚡ Vitesse moy. ${avg} km/h | max ${max} km/h`;

  if (start || end) {
    text += `\n🟢 Départ : ${start || "non précisé"}\n🔴 Arrivée : ${
      end || "non précisée"
    }`;
  }

  const leftMax = Number(trip.leanAngleMaxLeft || 0);
  const rightMax = Number(trip.leanAngleMaxRight || 0);

  if (leftMax > 3 || rightMax > 3) {
    text += `\n🏁 Angle max. G ${Math.round(leftMax)}° | D ${Math.round(
      rightMax
    )}°`;
  } else if (trip.maxLeanAngle && trip.maxLeanAngle > 3) {
    text += `\n🏁 Angle max. ${Math.round(trip.maxLeanAngle)}°`;
  }

  text += `\n⛽ Conso. ${conso} L/100km\n#MotoTrack #Moto #GPS`;

  return text;
}

function formatPlace(address?: string, city?: string): string {
  return [address, city].filter(Boolean).join(", ");
}

// --- Settings ---

export const DEFAULT_SETTINGS: LocalSettings = {
  id: "default",
  tankSize: 10,
  consumptionRate: 3.5,
  currentFuelL: 5,
  stopDurationForRefuelAlert: 5,
  profileName: "",
  motoBrand: "",
  reserveAlertEnabled: true,
  reserveThresholdKm: 40,

  leanCalibration: null,
  leanAngleEnabled: true,
  leanMaxAngle: 75,
  leanMinDisplayAngle: 5,
  leanMinRecordedAngle: 20,
  leanMinSpeedKmh: 15,
  leanSmoothingMode: "soft",
  leanSmoothingFactor: 0.1,
};

function smoothingFactorFromMode(mode: LeanSmoothingMode): number {
  if (mode === "sport") return 0.2;
  if (mode === "normal") return 0.12;
  return 0.1;
}

function normalizeSmoothingMode(value: unknown): LeanSmoothingMode {
  if (value === "sport" || value === "normal" || value === "soft") {
    return value;
  }

  return "soft";
}

function normalizeNumberSetting(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
}

function normalizeSettings(settings: LocalSettings): LocalSettings {
  const tankSize = Math.max(0, Number(settings.tankSize) || 0);
  const consumptionRate = Math.max(0, Number(settings.consumptionRate) || 0);

  let currentFuelL = Number(settings.currentFuelL);

  if (!Number.isFinite(currentFuelL)) {
    currentFuelL = Math.min(DEFAULT_SETTINGS.currentFuelL, tankSize);
  }

  currentFuelL = Math.min(Math.max(0, currentFuelL), tankSize);

  const leanSmoothingMode = normalizeSmoothingMode(settings.leanSmoothingMode);

  return {
    ...settings,
    id: "default",
    tankSize,
    consumptionRate,
    currentFuelL,
    reserveThresholdKm: normalizeNumberSetting(
      settings.reserveThresholdKm,
      DEFAULT_SETTINGS.reserveThresholdKm,
      0,
      1000
    ),
    stopDurationForRefuelAlert: normalizeNumberSetting(
      settings.stopDurationForRefuelAlert,
      DEFAULT_SETTINGS.stopDurationForRefuelAlert,
      0,
      120
    ),

    leanCalibration: settings.leanCalibration || null,

    leanAngleEnabled:
      settings.leanAngleEnabled === undefined
        ? DEFAULT_SETTINGS.leanAngleEnabled
        : Boolean(settings.leanAngleEnabled),

    leanMaxAngle: normalizeNumberSetting(
      settings.leanMaxAngle,
      DEFAULT_SETTINGS.leanMaxAngle,
      30,
      90
    ),

    leanMinDisplayAngle: normalizeNumberSetting(
      settings.leanMinDisplayAngle,
      DEFAULT_SETTINGS.leanMinDisplayAngle,
      0,
      30
    ),

    leanMinRecordedAngle: normalizeNumberSetting(
      settings.leanMinRecordedAngle,
      DEFAULT_SETTINGS.leanMinRecordedAngle,
      0,
      60
    ),

    leanMinSpeedKmh: normalizeNumberSetting(
      settings.leanMinSpeedKmh,
      DEFAULT_SETTINGS.leanMinSpeedKmh,
      0,
      80
    ),

    leanSmoothingMode,
    leanSmoothingFactor: smoothingFactorFromMode(leanSmoothingMode),
  };
}

export async function getSettings(): Promise<LocalSettings> {
  const db = await getDb();
  const stored = await db.get("settings", "default");

  if (!stored) {
    const normalized = normalizeSettings(DEFAULT_SETTINGS);
    await db.put("settings", normalized);
    return normalized;
  }

  const normalized = normalizeSettings({
    ...DEFAULT_SETTINGS,
    ...stored,
    id: "default",
  });

  await db.put("settings", normalized);
  return normalized;
}

export async function saveSettings(
  partial: Partial<Omit<LocalSettings, "id">>
): Promise<LocalSettings> {
  const db = await getDb();
  const current = await getSettings();

  const updated = normalizeSettings({
    ...current,
    ...partial,
    id: "default",
  });

  await db.put("settings", updated);
  return updated;
}

// --- Vehicle ---

const DEFAULT_VEHICLE: VehicleData = {
  id: "default",

  immatriculation: "",
  marque: "",
  modele: "",
  vin: "",
  miseEnCirculation: "",
  puissance: "",
  cylindree: "",
  poids: "",
  typeVehicule: "",

  carteGriseImage: undefined,
  permisImage: undefined,
  permisRectoImage: undefined,
  permisVersoImage: undefined,
};

export async function getVehicle(): Promise<VehicleData> {
  const db = await getDb();
  const stored = await db.get("vehicle", "default");

  if (!stored) {
    await db.put("vehicle", DEFAULT_VEHICLE);
    return DEFAULT_VEHICLE;
  }

  return {
    ...DEFAULT_VEHICLE,
    ...stored,
    id: "default",
  };
}

export async function saveVehicle(
  partial: Partial<Omit<VehicleData, "id">>
): Promise<VehicleData> {
  const db = await getDb();
  const current = await getVehicle();

  const updated: VehicleData = {
    ...current,
    ...partial,
    id: "default",
  };

  await db.put("vehicle", updated);
  return updated;
}

// --- Export ---

export async function getMotoTrackExportData(): Promise<MotoTrackExportData> {
  const [settings, vehicle, trips] = await Promise.all([
    getSettings(),
    getVehicle(),
    getAllTrips(),
  ]);

  return {
    app: "MotoTrack",
    exportVersion: 3,
    exportedAt: new Date().toISOString(),
    settings,
    vehicle,
    trips,
  };
}

// --- Import ---

function isMotoTrackExportData(data: unknown): data is MotoTrackExportData {
  if (!data || typeof data !== "object") return false;

  const candidate = data as Partial<MotoTrackExportData>;

  return (
    candidate.app === "MotoTrack" &&
    typeof candidate.exportVersion === "number" &&
    !!candidate.settings &&
    !!candidate.vehicle &&
    Array.isArray(candidate.trips)
  );
}

function normalizeImportedTrip(trip: LocalTrip): LocalTrip {
  const leanAngleMaxLeft = Number(trip.leanAngleMaxLeft) || 0;
  const leanAngleMaxRight = Number(trip.leanAngleMaxRight) || 0;

  const normalizedTrip: LocalTrip = {
    ...trip,

    id: trip.id || crypto.randomUUID(),

    distanceKm: Number(trip.distanceKm) || 0,
    avgSpeedKmh: Number(trip.avgSpeedKmh) || 0,
    maxSpeedKmh: Number(trip.maxSpeedKmh) || 0,

    consumedFuelL: Number(trip.consumedFuelL) || 0,
    consumptionRateL100: Number(trip.consumptionRateL100) || 0,
    durationMinutes: Number(trip.durationMinutes) || 0,

    autonomyBeforeKm: Number(trip.autonomyBeforeKm) || 0,
    autonomyAfterKm: Number(trip.autonomyAfterKm) || 0,

    leanAngleAvgLeft: Number(trip.leanAngleAvgLeft) || 0,
    leanAngleAvgRight: Number(trip.leanAngleAvgRight) || 0,
    leanAngleMaxLeft,
    leanAngleMaxRight,
    leanAngleSampleCountLeft: Number(trip.leanAngleSampleCountLeft) || 0,
    leanAngleSampleCountRight: Number(trip.leanAngleSampleCountRight) || 0,

    maxLeanAngle:
      Number(trip.maxLeanAngle) ||
      Math.max(leanAngleMaxLeft, leanAngleMaxRight),
  };

  return {
    ...normalizedTrip,
    shareText: normalizedTrip.shareText || buildShareText(normalizedTrip),
  };
}

export async function importMotoTrackData(
  data: unknown
): Promise<MotoTrackImportResult> {
  if (!isMotoTrackExportData(data)) {
    throw new Error("Fichier d’export MotoTrack invalide.");
  }

  const db = await getDb();

  const normalizedSettings = normalizeSettings({
    ...DEFAULT_SETTINGS,
    ...data.settings,
    id: "default",
  });

  const normalizedVehicle: VehicleData = {
    ...DEFAULT_VEHICLE,
    ...data.vehicle,
    id: "default",
  };

  await db.put("settings", normalizedSettings);
  await db.put("vehicle", normalizedVehicle);

  let tripsImported = 0;

  for (const trip of data.trips) {
    if (!trip || !trip.startedAt || !trip.endedAt) continue;

    const normalizedTrip = normalizeImportedTrip(trip);
    await db.put("trips", normalizedTrip);
    tripsImported += 1;
  }

  window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));

  return {
    settingsImported: true,
    vehicleImported: true,
    tripsImported,
  };
}