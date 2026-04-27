import { useCallback, useEffect, useRef, useState } from "react";

export interface CalibrationData {
  beta: number;
  gamma: number;
  calibratedAt: string;
}

export type LeanAngleDirection = "left" | "right" | "neutral";

export type LeanAngleStatus =
  | "unavailable"
  | "needs-permission"
  | "ready"
  | "active";

export interface LeanAngleStats {
  currentAngle: number;
  direction: LeanAngleDirection;

  maxLeft: number;
  maxRight: number;

  avgLeft: number;
  avgRight: number;

  sampleCountLeft: number;
  sampleCountRight: number;
}

const MAX_LEAN_ANGLE = 75;
const MIN_RECORDED_ANGLE = 2;
const SMOOTHING_FACTOR = 0.25;

const EMPTY_STATS: LeanAngleStats = {
  currentAngle: 0,
  direction: "neutral",

  maxLeft: 0,
  maxRight: 0,

  avgLeft: 0,
  avgRight: 0,

  sampleCountLeft: 0,
  sampleCountRight: 0,
};

export function useLeanAngle(
  isActive: boolean,
  calibration: CalibrationData | null
) {
  const [leanAngle, setLeanAngle] = useState(0);
  const [status, setStatus] = useState<LeanAngleStatus>("unavailable");
  const [stats, setStats] = useState<LeanAngleStats>(EMPTY_STATS);

  const smoothedAngleRef = useRef(0);

  const maxLeftRef = useRef(0);
  const maxRightRef = useRef(0);

  const sumLeftRef = useRef(0);
  const sumRightRef = useRef(0);

  const countLeftRef = useRef(0);
  const countRightRef = useRef(0);

  const resetStats = useCallback(() => {
    smoothedAngleRef.current = 0;

    maxLeftRef.current = 0;
    maxRightRef.current = 0;

    sumLeftRef.current = 0;
    sumRightRef.current = 0;

    countLeftRef.current = 0;
    countRightRef.current = 0;

    setLeanAngle(0);
    setStats(EMPTY_STATS);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("DeviceOrientationEvent" in window)) {
      setStatus("unavailable");
      return false;
    }

    const deviceOrientation = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (typeof deviceOrientation.requestPermission === "function") {
      try {
        const result = await deviceOrientation.requestPermission();
        return result === "granted";
      } catch {
        return false;
      }
    }

    return true;
  }, []);

  const startCalibration = useCallback((): Promise<CalibrationData> => {
    return new Promise((resolve, reject) => {
      if (!("DeviceOrientationEvent" in window)) {
        reject(new Error("Capteurs non disponibles"));
        return;
      }

      const readings: { beta: number; gamma: number }[] = [];
      let timeout: ReturnType<typeof setTimeout>;

      const handler = (event: DeviceOrientationEvent) => {
        if (event.beta !== null && event.gamma !== null) {
          readings.push({ beta: event.beta, gamma: event.gamma });
        }

        if (readings.length >= 30) {
          window.removeEventListener("deviceorientation", handler);
          clearTimeout(timeout);

          const avgBeta =
            readings.reduce((sum, reading) => sum + reading.beta, 0) /
            readings.length;

          const avgGamma =
            readings.reduce((sum, reading) => sum + reading.gamma, 0) /
            readings.length;

          resolve({
            beta: Math.round(avgBeta * 10) / 10,
            gamma: Math.round(avgGamma * 10) / 10,
            calibratedAt: new Date().toISOString(),
          });
        }
      };

      window.addEventListener("deviceorientation", handler);

      timeout = setTimeout(() => {
        window.removeEventListener("deviceorientation", handler);

        if (readings.length >= 5) {
          const avgBeta =
            readings.reduce((sum, reading) => sum + reading.beta, 0) /
            readings.length;

          const avgGamma =
            readings.reduce((sum, reading) => sum + reading.gamma, 0) /
            readings.length;

          resolve({
            beta: Math.round(avgBeta * 10) / 10,
            gamma: Math.round(avgGamma * 10) / 10,
            calibratedAt: new Date().toISOString(),
          });
        } else {
          reject(new Error("Capteurs non disponibles"));
        }
      }, 5000);
    });
  }, []);

  useEffect(() => {
    if (!("DeviceOrientationEvent" in window)) {
      setStatus("unavailable");
      return;
    }

    const deviceOrientation = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    const needsPermission =
      typeof deviceOrientation.requestPermission === "function";

    if (needsPermission && !isActive) {
      setStatus("needs-permission");
      return;
    }

    if (!isActive) {
      setStatus("ready");
      return;
    }

    setStatus("active");
    resetStats();

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null) return;

      const offsetGamma = calibration?.gamma ?? 0;
      const correctedAngle = event.gamma - offsetGamma;

      const clampedAngle = Math.max(
        -MAX_LEAN_ANGLE,
        Math.min(MAX_LEAN_ANGLE, correctedAngle)
      );

      const smoothedAngle =
        smoothedAngleRef.current * (1 - SMOOTHING_FACTOR) +
        clampedAngle * SMOOTHING_FACTOR;

      smoothedAngleRef.current = smoothedAngle;

      const roundedAngle = Math.round(smoothedAngle * 10) / 10;
      const absAngle = Math.abs(roundedAngle);

      let direction: LeanAngleDirection = "neutral";

      if (roundedAngle <= -MIN_RECORDED_ANGLE) {
        direction = "left";
      } else if (roundedAngle >= MIN_RECORDED_ANGLE) {
        direction = "right";
      }

      if (direction === "left") {
        sumLeftRef.current += absAngle;
        countLeftRef.current += 1;
        maxLeftRef.current = Math.max(maxLeftRef.current, absAngle);
      }

      if (direction === "right") {
        sumRightRef.current += absAngle;
        countRightRef.current += 1;
        maxRightRef.current = Math.max(maxRightRef.current, absAngle);
      }

      const avgLeft =
        countLeftRef.current > 0
          ? sumLeftRef.current / countLeftRef.current
          : 0;

      const avgRight =
        countRightRef.current > 0
          ? sumRightRef.current / countRightRef.current
          : 0;

      setLeanAngle(roundedAngle);

      setStats({
        currentAngle: roundedAngle,
        direction,

        maxLeft: Math.round(maxLeftRef.current * 10) / 10,
        maxRight: Math.round(maxRightRef.current * 10) / 10,

        avgLeft: Math.round(avgLeft * 10) / 10,
        avgRight: Math.round(avgRight * 10) / 10,

        sampleCountLeft: countLeftRef.current,
        sampleCountRight: countRightRef.current,
      });
    };

    window.addEventListener("deviceorientation", handleOrientation);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [isActive, calibration, resetStats]);

  return {
    leanAngle,
    stats,
    status,
    requestPermission,
    startCalibration,
    resetStats,
  };
}