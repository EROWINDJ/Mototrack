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

  /**
   * Ancien champ conservé pour compatibilité.
   * Avant, le permis était stocké dans permisImage.
   * Maintenant, on privilégie permisRectoImage / permisVersoImage.
   */
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
  const dist = trip.distanceKm.toFixed(1);
  const avg = trip.avgSpeedKmh.toFixed(0);
  const max = trip.maxSpeedKmh.toFixed(0);
  const conso = trip.consumptionRateL100.toFixed(1);

  const dur = trip.durationMinutes;
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

  if (trip.maxLeanAngle && trip.maxLeanAngle > 3) {
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
};

function normalizeSettings(settings: LocalSettings): LocalSettings {
  const tankSize = Math.max(0, Number(settings.tankSize) || 0);
  const consumptionRate = Math.max(0, Number(settings.consumptionRate) || 0);

  let currentFuelL = Number(settings.currentFuelL);

  if (!Number.isFinite(currentFuelL)) {
    currentFuelL = Math.min(DEFAULT_SETTINGS.currentFuelL, tankSize);
  }

  currentFuelL = Math.min(Math.max(0, currentFuelL), tankSize);

  return {
    ...settings,
    id: "default",
    tankSize,
    consumptionRate,
    currentFuelL,
    reserveThresholdKm: Math.max(0, Number(settings.reserveThresholdKm) || 0),
    stopDurationForRefuelAlert: Math.max(
      0,
      Number(settings.stopDurationForRefuelAlert) || 0
    ),
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
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    settings,
    vehicle,
    trips,
  };
}