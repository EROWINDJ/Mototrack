import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Trash2,
  MapPin,
  Clock,
  Gauge,
  ArrowLeft,
  Route,
  Activity,
} from "lucide-react";

import { useLocalTrips } from "@/hooks/useLocalTrips";
import type { LocalTrip } from "@/lib/localDb";

type Position = {
  lat: number;
  lng: number;
};

export default function History() {
  const { trips, loading, removeTrip } = useLocalTrips();
  const [selectedTrip, setSelectedTrip] = useState<LocalTrip | null>(null);

  if (loading) {
    return (
      <div style={styles.container}>
        <p>Chargement...</p>
      </div>
    );
  }

  if (selectedTrip) {
    return (
      <TripDetail
        trip={selectedTrip}
        onBack={() => setSelectedTrip(null)}
        onDelete={async () => {
          await removeTrip(selectedTrip.id);
          setSelectedTrip(null);
        }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Mes trajets</h1>

      {trips.length === 0 ? (
        <p style={styles.empty}>Aucun trajet enregistré</p>
      ) : (
        <div style={styles.list}>
          {[...trips].reverse().map((trip) => {
            const maxLean = getMaxLeanAngle(trip);
            const gpsPoints = getGpsPointsCount(trip);

            return (
              <div
                key={trip.id}
                style={styles.card}
                onClick={() => setSelectedTrip(trip)}
              >
                <div style={styles.header}>
                  <span style={styles.date}>{formatDate(trip)}</span>

                  <button
                    style={styles.delete}
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeTrip(trip.id);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={styles.row}>
                  <MapPin size={16} />
                  <span>{formatNumber(trip.distanceKm, 2)} km</span>
                </div>

                <div style={styles.row}>
                  <Gauge size={16} />
                  <span>
                    {formatNumber(trip.avgSpeedKmh, 0)} km/h — max{" "}
                    {formatNumber(trip.maxSpeedKmh, 0)} km/h
                  </span>
                </div>

                <div style={styles.row}>
                  <Clock size={16} />
                  <span>{trip.durationMinutes} min</span>
                </div>

                <div style={styles.row}>
                  <Activity size={16} />
                  <span>
                    Angle max : {formatNumber(maxLean, 1)}° · GPS : {gpsPoints} pts
                  </span>
                </div>

                <div style={styles.addressPreview}>
                  {formatAddress(trip.startAddress, trip.startCity)} →{" "}
                  {formatAddress(trip.endAddress, trip.endCity)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TripDetail({
  trip,
  onBack,
  onDelete,
}: {
  trip: LocalTrip;
  onBack: () => void;
  onDelete: () => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const points = trip.path || [];
    const firstPoint = points[0];

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
    }).setView(firstPoint ? [firstPoint.lat, firstPoint.lng] : [48.8566, 2.3522], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; Leaflet",
    }).addTo(map);

    if (points.length > 1) {
      const latLngs: L.LatLngTuple[] = points.map((p: Position) => [
        p.lat,
        p.lng,
      ]);

      const polyline = L.polyline(latLngs, {
        color: "#22c55e",
        weight: 6,
        opacity: 0.95,
      }).addTo(map);

      map.fitBounds(polyline.getBounds(), {
        padding: [28, 28],
      });

      L.circleMarker(latLngs[0], {
        radius: 7,
        color: "#22c55e",
        fillColor: "#22c55e",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup("Départ");

      L.circleMarker(latLngs[latLngs.length - 1], {
        radius: 7,
        color: "#ef4444",
        fillColor: "#ef4444",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup("Arrivée");
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
    };
  }, [trip]);

  const start = trip.path?.[0];
  const end = trip.path?.[trip.path.length - 1];

  const maxLean = getMaxLeanAngle(trip);
  const gpsPoints = getGpsPointsCount(trip);
  const badge = getLeanAngleBadge(maxLean);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Mes trajets</h1>

      <button onClick={onBack} style={styles.backButton}>
        <ArrowLeft size={18} />
        Retour
      </button>

      <h2 style={styles.detailTitle}>Détail du trajet</h2>

      <div style={styles.metrics}>
        <Metric label="Distance" value={`${formatNumber(trip.distanceKm, 2)} km`} />
        <Metric label="Vitesse max" value={`${formatNumber(trip.maxSpeedKmh, 0)} km/h`} />
        <Metric label="Vitesse moy" value={`${formatNumber(trip.avgSpeedKmh, 0)} km/h`} />
        <Metric label="Durée" value={`${trip.durationMinutes} min`} />
        <Metric label="Date" value={formatDate(trip)} />
      </div>

      <div style={styles.leanReport}>
        <div style={styles.leanReportHeader}>
          <div>
            <div style={styles.leanReportTitle}>Lean angle</div>
            <div style={styles.leanReportBadge}>{badge}</div>
          </div>

          <div style={styles.leanReportMax}>{formatNumber(maxLean, 1)}°</div>
        </div>

        <div style={styles.leanGrid}>
          <MiniStat label="Moy G" value={`${formatNumber(trip.leanAngleAvgLeft, 1)}°`} />
          <MiniStat label="Max G" value={`${formatNumber(trip.leanAngleMaxLeft, 1)}°`} />
          <MiniStat label="Moy D" value={`${formatNumber(trip.leanAngleAvgRight, 1)}°`} />
          <MiniStat label="Max D" value={`${formatNumber(trip.leanAngleMaxRight, 1)}°`} />
        </div>

        <div style={styles.gpsBox}>
          <Route size={18} />
          <span>
            Points GPS enregistrés : <strong>{gpsPoints}</strong>
          </span>
        </div>
      </div>

      <div style={styles.infoBox}>
        <div>
          <strong>Départ :</strong>{" "}
          {formatAddress(trip.startAddress, trip.startCity) ||
            formatCoords(start)}
        </div>

        <div>
          <strong>Arrivée :</strong>{" "}
          {formatAddress(trip.endAddress, trip.endCity) || formatCoords(end)}
        </div>
      </div>

      <div ref={mapContainerRef} style={styles.map} />

      <button onClick={onDelete} style={styles.deleteLarge}>
        Supprimer ce trajet
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong>{label} :</strong> {value}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.miniStat}>
      <span style={styles.miniStatLabel}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getMaxLeanAngle(trip: LocalTrip) {
  return Math.max(
    Number(trip.leanAngleMaxLeft || 0),
    Number(trip.leanAngleMaxRight || 0),
    Number(trip.maxLeanAngle || 0)
  );
}

function getGpsPointsCount(trip: LocalTrip) {
  return trip.path?.length ?? 0;
}

function getLeanAngleBadge(maxAngle: number) {
  if (maxAngle >= 65) return "Respect. Tu cherchais tes lunettes ?";
  if (maxAngle >= 55) return "Genou pas loin";
  if (maxAngle >= 40) return "Belle mise sur l’angle";
  if (maxAngle >= 25) return "Ça commence à jouer";
  return "Balade tranquille";
}

function formatNumber(value?: number, decimals = 1) {
  const numeric = Number(value || 0);
  return numeric.toFixed(decimals).replace(".", ",");
}

function formatDate(trip: LocalTrip) {
  const rawDate = trip.startedAt || trip.endedAt;

  if (!rawDate) return "Date non disponible";

  const date = new Date(rawDate);

  if (Number.isNaN(date.getTime())) return "Date non disponible";

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAddress(address?: string, city?: string) {
  return [address, city].filter(Boolean).join(", ");
}

function formatCoords(point?: Position) {
  if (!point) return "-";
  return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "white",
    padding: "24px",
    paddingBottom: "110px",
    fontFamily: "sans-serif",
  },

  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "18px",
  },

  detailTitle: {
    fontSize: "20px",
    fontWeight: "bold",
    marginTop: "22px",
    marginBottom: "14px",
  },

  empty: {
    opacity: 0.6,
  },

  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },

  card: {
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: "pointer",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "10px",
  },

  date: {
    fontSize: "13px",
    opacity: 0.72,
  },

  delete: {
    background: "transparent",
    border: "none",
    color: "#ef4444",
    cursor: "pointer",
  },

  row: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    marginTop: "7px",
  },

  addressPreview: {
    marginTop: "10px",
    fontSize: "13px",
    opacity: 0.7,
  },

  backButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "transparent",
    color: "white",
    border: "none",
    fontSize: "18px",
    padding: 0,
    marginBottom: "12px",
  },

  metrics: {
    display: "grid",
    gap: "6px",
    marginBottom: "14px",
    fontSize: "16px",
  },

  leanReport: {
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(59,130,246,0.12)",
    border: "1px solid rgba(59,130,246,0.25)",
    marginBottom: "16px",
  },

  leanReportHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
  },

  leanReportTitle: {
    fontSize: "15px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    opacity: 0.85,
  },

  leanReportBadge: {
    marginTop: "5px",
    fontSize: "13px",
    color: "#bfdbfe",
  },

  leanReportMax: {
    fontSize: "34px",
    fontWeight: 900,
  },

  leanGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
    marginBottom: "12px",
  },

  miniStat: {
    padding: "10px 6px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.08)",
    textAlign: "center" as const,
    fontSize: "13px",
  },

  miniStatLabel: {
    display: "block",
    opacity: 0.58,
    fontSize: "11px",
    marginBottom: "4px",
  },

  gpsBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    borderRadius: "12px",
    background: "rgba(15,23,42,0.45)",
    fontSize: "14px",
  },

  infoBox: {
    background: "#020617",
    color: "white",
    padding: "16px",
    borderRadius: "18px",
    marginBottom: "16px",
    display: "grid",
    gap: "10px",
    lineHeight: 1.4,
  },

  map: {
    width: "100%",
    height: "330px",
    borderRadius: "20px",
    overflow: "hidden",
    marginBottom: "16px",
  },

  deleteLarge: {
    width: "100%",
    padding: "14px",
    borderRadius: "16px",
    border: "none",
    background: "#ef4444",
    color: "white",
    fontWeight: 800,
    fontSize: "16px",
  },
};