import { useMemo, useState, type ReactNode } from "react";
import { useLocalTrips } from "@/hooks/useLocalTrips";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Period = "week" | "month" | "all";

export default function Statistics() {
  const { trips, loading } = useLocalTrips();
  const [period, setPeriod] = useState<Period>("week");

  const filteredTrips = useMemo(() => {
    const now = Date.now();

    return trips.filter((trip) => {
      const time = new Date(trip.startedAt).getTime();

      if (period === "week") {
        return now - time <= 7 * 24 * 60 * 60 * 1000;
      }

      if (period === "month") {
        return now - time <= 30 * 24 * 60 * 60 * 1000;
      }

      return true;
    });
  }, [trips, period]);

  const stats = useMemo(() => {
    const totalDistance = filteredTrips.reduce(
      (sum, trip) => sum + (trip.distanceKm || 0),
      0
    );

    const totalFuel = filteredTrips.reduce(
      (sum, trip) => sum + (trip.consumedFuelL || 0),
      0
    );

    const totalDuration = filteredTrips.reduce(
      (sum, trip) => sum + (trip.durationMinutes || 0),
      0
    );

    const maxSpeed = filteredTrips.reduce(
      (max, trip) => Math.max(max, trip.maxSpeedKmh || 0),
      0
    );

    const avgSpeed =
      totalDuration > 0 ? totalDistance / (totalDuration / 60) : 0;

    const realConsumption =
      totalDistance > 0 ? (totalFuel / totalDistance) * 100 : 0;

    const tripsWithLeanLeft = filteredTrips.filter(
      (trip) => (trip.leanAngleSampleCountLeft || 0) > 0
    );

    const tripsWithLeanRight = filteredTrips.filter(
      (trip) => (trip.leanAngleSampleCountRight || 0) > 0
    );

    const avgLeanLeft =
      tripsWithLeanLeft.length > 0
        ? tripsWithLeanLeft.reduce(
            (sum, trip) => sum + (trip.leanAngleAvgLeft || 0),
            0
          ) / tripsWithLeanLeft.length
        : 0;

    const avgLeanRight =
      tripsWithLeanRight.length > 0
        ? tripsWithLeanRight.reduce(
            (sum, trip) => sum + (trip.leanAngleAvgRight || 0),
            0
          ) / tripsWithLeanRight.length
        : 0;

    const maxLeanLeft = filteredTrips.reduce(
      (max, trip) => Math.max(max, trip.leanAngleMaxLeft || 0),
      0
    );

    const maxLeanRight = filteredTrips.reduce(
      (max, trip) => Math.max(max, trip.leanAngleMaxRight || 0),
      0
    );

    const maxLean = Math.max(maxLeanLeft, maxLeanRight);

    const totalGpsPoints = filteredTrips.reduce(
      (sum, trip) => sum + (trip.path?.length ?? 0),
      0
    );

    return {
      totalDistance,
      totalFuel,
      totalDuration,
      maxSpeed,
      avgSpeed,
      realConsumption,
      tripCount: filteredTrips.length,

      avgLeanLeft,
      avgLeanRight,
      maxLeanLeft,
      maxLeanRight,
      maxLean,
      totalGpsPoints,
    };
  }, [filteredTrips]);

  const chartData = useMemo(() => {
    return [...filteredTrips]
      .sort(
        (a, b) =>
          new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      )
      .map((trip, index) => ({
        name: new Date(trip.startedAt).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        }),
        trajet: index + 1,
        distance: Number((trip.distanceKm || 0).toFixed(2)),
        vitesse: Number((trip.avgSpeedKmh || 0).toFixed(0)),
        conso: Number((trip.consumptionRateL100 || 0).toFixed(1)),
        angleMoyG: Number((trip.leanAngleAvgLeft || 0).toFixed(1)),
        angleMoyD: Number((trip.leanAngleAvgRight || 0).toFixed(1)),
        angleMaxG: Number((trip.leanAngleMaxLeft || 0).toFixed(1)),
        angleMaxD: Number((trip.leanAngleMaxRight || 0).toFixed(1)),
        gpsPoints: trip.path?.length ?? 0,
      }));
  }, [filteredTrips]);

  if (loading) {
    return <div style={styles.container}>Chargement...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Statistiques</h1>

      <div style={styles.tabs}>
        <button
          style={period === "week" ? styles.tabActive : styles.tab}
          onClick={() => setPeriod("week")}
        >
          Semaine
        </button>

        <button
          style={period === "month" ? styles.tabActive : styles.tab}
          onClick={() => setPeriod("month")}
        >
          Mois
        </button>

        <button
          style={period === "all" ? styles.tabActive : styles.tab}
          onClick={() => setPeriod("all")}
        >
          Tout
        </button>
      </div>

      <div style={styles.grid}>
        <StatCard label="Distance" value={`${stats.totalDistance.toFixed(1)} km`} />
        <StatCard label="Trajets" value={stats.tripCount} />
        <StatCard label="Vitesse moy" value={`${stats.avgSpeed.toFixed(0)} km/h`} />
        <StatCard label="Vitesse max" value={`${stats.maxSpeed.toFixed(0)} km/h`} />
        <StatCard label="Carburant" value={`${stats.totalFuel.toFixed(2)} L`} />
        <StatCard
          label="Conso réelle"
          value={`${stats.realConsumption.toFixed(2)} L/100`}
        />
        <StatCard label="Angle moy G" value={`${stats.avgLeanLeft.toFixed(1)}°`} />
        <StatCard label="Angle moy D" value={`${stats.avgLeanRight.toFixed(1)}°`} />
        <StatCard label="Angle max G" value={`${stats.maxLeanLeft.toFixed(1)}°`} />
        <StatCard label="Angle max D" value={`${stats.maxLeanRight.toFixed(1)}°`} />
        <StatCard label="Badge angle" value={getLeanAngleBadge(stats.maxLean)} />
        <StatCard label="Points GPS" value={stats.totalGpsPoints} />
      </div>

      {chartData.length === 0 ? (
        <div style={styles.empty}>
          Aucun trajet sur cette période.
          <br />
          Les graphiques apparaîtront après un trajet enregistré.
        </div>
      ) : (
        <>
          <ChartCard title="Distance par trajet">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.55)" />
                <YAxis stroke="rgba(255,255,255,0.55)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="distance" fill="#22c55e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Vitesse moyenne">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.55)" />
                <YAxis stroke="rgba(255,255,255,0.55)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="vitesse"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Consommation L/100">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.55)" />
                <YAxis stroke="rgba(255,255,255,0.55)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="conso"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.25}
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Lean angle moyen gauche / droite">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.55)" />
                <YAxis stroke="rgba(255,255,255,0.55)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="angleMoyG"
                  stroke="#60a5fa"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="Moy G"
                />
                <Line
                  type="monotone"
                  dataKey="angleMoyD"
                  stroke="#f472b6"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="Moy D"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Lean angle maximum gauche / droite">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.55)" />
                <YAxis stroke="rgba(255,255,255,0.55)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="angleMaxG" fill="#60a5fa" radius={[8, 8, 0, 0]} name="Max G" />
                <Bar dataKey="angleMaxD" fill="#f472b6" radius={[8, 8, 0, 0]} name="Max D" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Points GPS par trajet">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.55)" />
                <YAxis stroke="rgba(255,255,255,0.55)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="gpsPoints" fill="#a855f7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={styles.chartCard}>
      <h2 style={styles.chartTitle}>{title}</h2>
      {children}
    </div>
  );
}

function getLeanAngleBadge(maxAngle: number) {
  if (maxAngle >= 65) return "Respect. Tu cherchais tes lunettes ?";
  if (maxAngle >= 55) return "Genou pas loin";
  if (maxAngle >= 40) return "Belle mise sur l’angle";
  if (maxAngle >= 25) return "Ça commence à jouer";
  return "Balade tranquille";
}

const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "12px",
  color: "white",
};

const styles = {
  container: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "white",
    padding: "20px 16px 96px",
    fontFamily: "sans-serif",
  },

  title: {
    fontSize: "24px",
    fontWeight: 800,
    marginBottom: "18px",
  },

  tabs: {
    display: "flex",
    gap: "8px",
    padding: "6px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.06)",
    marginBottom: "16px",
  },

  tab: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: "12px",
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.65)",
    fontWeight: 700,
    cursor: "pointer",
  },

  tabActive: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: "12px",
    border: "none",
    background: "#2563eb",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(37,99,235,0.35)",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "18px",
  },

  card: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px",
    padding: "14px",
  },

  cardLabel: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.6)",
    marginBottom: "6px",
  },

  cardValue: {
    fontSize: "20px",
    fontWeight: 900,
  },

  chartCard: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "18px",
    padding: "14px",
    marginBottom: "16px",
  },

  chartTitle: {
    fontSize: "15px",
    fontWeight: 800,
    margin: "0 0 12px",
  },

  empty: {
    marginTop: "24px",
    padding: "24px",
    borderRadius: "18px",
    textAlign: "center" as const,
    color: "rgba(255,255,255,0.65)",
    background: "rgba(255,255,255,0.06)",
    lineHeight: 1.5,
  },
};