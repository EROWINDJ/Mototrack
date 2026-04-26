import { useState, useEffect, useCallback, useRef } from 'react';

export interface CalibrationData {
  beta: number;
  gamma: number;
  calibratedAt: string;
}

export type LeanAngleStatus = 'unavailable' | 'needs-permission' | 'calibrating' | 'ready' | 'active';

export function useLeanAngle(isActive: boolean, calibration: CalibrationData | null) {
  const [leanAngle, setLeanAngle] = useState(0);
  const [maxLeanAngle, setMaxLeanAngle] = useState(0);
  const [status, setStatus] = useState<LeanAngleStatus>('unavailable');
  const maxLeanRef = useRef(0);
  const samplesRef = useRef<number[]>([]);

  useEffect(() => {
    if (!('DeviceOrientationEvent' in window)) {
      setStatus('unavailable');
      return;
    }

    const needsPermission = typeof (DeviceOrientationEvent as any).requestPermission === 'function';
    if (needsPermission && !isActive) {
      setStatus('needs-permission');
      return;
    }

    if (!calibration) {
      setStatus('calibrating');
      return;
    }

    if (!isActive) {
      setStatus('ready');
      return;
    }

    setStatus('active');
    maxLeanRef.current = 0;
    samplesRef.current = [];

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;

      const rawGamma = event.gamma;
      const correctedAngle = rawGamma - (calibration.gamma || 0);
      const clampedAngle = Math.max(-60, Math.min(60, correctedAngle));

      setLeanAngle(clampedAngle);
      const absAngle = Math.abs(clampedAngle);
      if (absAngle > 3) {
        samplesRef.current.push(absAngle);
        if (absAngle > maxLeanRef.current) {
          maxLeanRef.current = absAngle;
          setMaxLeanAngle(absAngle);
        }
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [isActive, calibration]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const result = await (DeviceOrientationEvent as any).requestPermission();
        return result === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }, []);

  const startCalibration = useCallback((): Promise<CalibrationData> => {
    return new Promise((resolve, reject) => {
      const readings: { beta: number; gamma: number }[] = [];
      let timeout: NodeJS.Timeout;

      const handler = (event: DeviceOrientationEvent) => {
        if (event.beta !== null && event.gamma !== null) {
          readings.push({ beta: event.beta, gamma: event.gamma });
        }
        if (readings.length >= 30) {
          window.removeEventListener('deviceorientation', handler);
          clearTimeout(timeout);
          const avgBeta = readings.reduce((s, r) => s + r.beta, 0) / readings.length;
          const avgGamma = readings.reduce((s, r) => s + r.gamma, 0) / readings.length;
          resolve({
            beta: Math.round(avgBeta * 10) / 10,
            gamma: Math.round(avgGamma * 10) / 10,
            calibratedAt: new Date().toISOString(),
          });
        }
      };

      window.addEventListener('deviceorientation', handler);

      timeout = setTimeout(() => {
        window.removeEventListener('deviceorientation', handler);
        if (readings.length >= 5) {
          const avgBeta = readings.reduce((s, r) => s + r.beta, 0) / readings.length;
          const avgGamma = readings.reduce((s, r) => s + r.gamma, 0) / readings.length;
          resolve({
            beta: Math.round(avgBeta * 10) / 10,
            gamma: Math.round(avgGamma * 10) / 10,
            calibratedAt: new Date().toISOString(),
          });
        } else {
          reject(new Error('Capteurs non disponibles'));
        }
      }, 5000);
    });
  }, []);

  const resetMax = useCallback(() => {
    maxLeanRef.current = 0;
    setMaxLeanAngle(0);
    samplesRef.current = [];
  }, []);

  return {
    leanAngle,
    maxLeanAngle,
    status,
    requestPermission,
    startCalibration,
    resetMax,
  };
}
