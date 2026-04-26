import { useLocalTrips } from "@/hooks/useLocalTrips";
import { Trash2, MapPin, Clock, Gauge } from "lucide-react";

export default function History() {
  const { trips, loading, removeTrip } = useLocalTrips();

  if (loading) {
    return (
      <div style={styles.container}>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Historique</h1>

      {trips.length === 0 ? (
        <p style={styles.empty}>Aucun trajet enregistré</p>
      ) : (
        <div style={styles.list}>
          {trips.map((trip) => (
            <div key={trip.id} style={styles.card}>
              <div style={styles.header}>
                <span style={styles.date}>
                  {new Date(trip.startedAt).toLocaleDateString()}
                </span>

                <button
                  style={styles.delete}
                  onClick={() => removeTrip(trip.id)}
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
                  {trip.avgSpeedKmh.toFixed(0)} km/h (max {trip.maxSpeedKmh.toFixed(0)})
                </span>
              </div>

              <div style={styles.row}>
                <Clock size={16} />
                <span>{trip.durationMinutes} min</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "white",
    padding: "24px",
    fontFamily: "sans-serif",
  },

  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "20px",
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
    borderRadius: "14px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "10px",
  },

  date: {
    fontSize: "13px",
    opacity: 0.7,
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
    marginTop: "6px",
  },
};