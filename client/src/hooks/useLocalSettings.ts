import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings, saveSettings, type LocalSettings } from "@/lib/localDb";

export function useLocalSettings() {
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const stored = await getSettings();

        if (mounted) {
          setSettings(stored);
        }
      } catch (error) {
        console.error("Erreur chargement paramètres locaux :", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<Omit<LocalSettings, "id">>) => {
      setSettings((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          ...partial,
          id: "default",
        };
      });

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        try {
          const updated = await saveSettings(partial);
          setSettings(updated);
        } catch (error) {
          console.error("Erreur sauvegarde paramètres locaux :", error);
        }
      }, 400);
    },
    []
  );

  const updateFuel = useCallback(async (fuelL: number) => {
    try {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      const updated = await saveSettings({ currentFuelL: fuelL });
      setSettings(updated);
      return updated;
    } catch (error) {
      console.error("Erreur sauvegarde carburant actuel :", error);
      throw error;
    }
  }, []);

  const refuelFull = useCallback(async () => {
    const current = await getSettings();
    return updateFuel(current.tankSize);
  }, [updateFuel]);

  return {
    settings,
    loading,
    updateSettings,
    updateFuel,
    refuelFull,
  };
}
