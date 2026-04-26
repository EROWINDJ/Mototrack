import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { getAllTrips, deleteTrip, type LocalTrip } from "@/lib/localDb";

type Position = {
  lat: number;
  lng: number;
};

export default function History() {
  const [trips, setTrips] = useState<LocalTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<LocalTrip | null>(null);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    const data = await getAllTrips();
    setTrips(data.reverse());
  };

  const handleDelete = async (id: string) => {
    await deleteTrip(id);
    loadTrips();
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Mes trajets</h2>

      {!selectedTrip && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {trips.map((trip) => (
            <div
              key={trip.id}
              style={card}
              onClick={() => setSelectedTrip(trip)}
            >
              <div>
                <strong>{trip.distanceKm.toFixed(2)} km</strong>
                <div>{formatDate(trip.id)}</div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(trip.id);
                }}
                style={deleteBtn}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedTrip && (
        <TripDetail
          trip={selectedTrip}
          onBack={() => setSelectedTrip(null)}
        />
      )}
    </div>
  );
}

function TripDetail({
  trip,
  onBack,
}: {
  trip: LocalTrip;
  onBack: () => void;
}) {
  const mapRef = useState<L.Map | null>(null)[0];

  useEffect(() => {
    const map = L.map("detailMap").setView([48.8566, 2.3522], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
      map
    );

    const points = trip.path || [];

    if (points.length > 1) {
      const latLngs: L.LatLngTuple[] = points.map((p: Position) => [p.lat, p.lng]);

      const polyline = L.polyline(latLngs, {
        color: "#22c55e",
        weight: 6,
      }).addTo(map);

      map.fitBounds(polyline.getBounds());
    }

    return () => {
      map.remove();
    };
  }, [trip]);

  const start = trip.path?.[0];
  const end = trip.path?.[trip.path.length - 1];

  return (
    <div>
      <button onClick={onBack} style={backBtn}>
        ← Retour
      </button>

      <h3>Détail du trajet</h3>

      <div style={{ marginBottom: 12 }}>
        <div><strong>Distance :</strong> {trip.distanceKm.toFixed(2)} km</div>
        <div><strong>Vitesse max :</strong> {trip.maxSpeedKmh.toFixed(0)} km/h</div>
      </div>

      <div style={infoBox}>
        <div>
          <strong>Départ :</strong>{" "}
          {start
            ? `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}`
            : "-"}
        </div>

        <div>
          <strong>Arrivée :</strong>{" "}
          {end
            ? `${end.lat.toFixed(4)}, ${end.lng.toFixed(4)}`
            : "-"}
        </div>
      </div>

      <div id="detailMap" style={mapStyle} />
    </div>
  );
}

/* ===================== UI ===================== */

const card = {
  background: "#0f172a",
  color: "white",
  padding: 16,
  borderRadius: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
};

const deleteBtn = {
  background: "transparent",
  border: "none",
  color: "red",
  fontSize: 18,
};

const backBtn = {
  marginBottom: 12,
};

const infoBox = {
  background: "#020617",
  color: "white",
  padding: 12,
  borderRadius: 12,
  marginBottom: 12,
};

const mapStyle = {
  height: 300,
  borderRadius: 16,
};

/* ===================== UTILS ===================== */

function formatDate(id: string) {
  try {
    const d = new Date(Number(id));
    return d.toLocaleString();
  } catch {
    return "";
  }
}