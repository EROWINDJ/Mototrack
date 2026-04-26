import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Trash2, MapPin, Clock, Gauge, ArrowLeft } from "lucide-react";

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
          {[...trips].reverse().map((trip) => (
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
                <span>{trip.distanceKm.toFixed(2)} km</span>
              </div>

              <div style={styles.row}>
                <Gauge size={16} />
                <span>
                  {trip.avgSpeedKmh.toFixed(0)} km/h — max{" "}
                  {trip.maxSpeedKmh.toFixed(0)} km/h
                </span>
              </div>

              <div style={styles.row}>
                <Clock size={16} />
                <span>{trip.durationMinutes} min</span>
              </div>

              <div style={styles.addressPreview}>
                {formatAddress(trip.startAddress, trip.startCity)} →{" "}
                {formatAddress(trip.endAddress, trip.endCity)}
              </div>
            </div>
          ))}
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

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Mes trajets</h1>

      <button onClick={onBack} style={styles.backButton}>
        <ArrowLeft size={18} />
        Retour
      </button>

      <h2 style={styles.detailTitle}>Détail du trajet</h2>

      <div style={styles.metrics}>
        <div>
          <strong>Distance :</strong> {trip.distanceKm.toFixed(2)} km
        </div>
        <div>
          <strong>Vitesse max :</strong> {trip.maxSpeedKmh.toFixed(0)} km/h
        </div>
        <div>
          <strong>Vitesse moy :</strong> {trip.avgSpeedKmh.toFixed(0)} km/h
        </div>
        <div>
          <strong>Durée :</strong> {trip.durationMinutes} min
        </div>
        <div>
          <strong>Date :</strong> {formatDate(trip)}
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