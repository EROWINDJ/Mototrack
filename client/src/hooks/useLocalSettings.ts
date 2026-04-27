import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings, saveSettings, type LocalSettings } from "@/lib/localDb";

const SETTINGS_UPDATED_EVENT = "mototrack:settings-updated";

export function useLocalSettings() {
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSettings = useCallback(async () => {
    try {
      const stored = await getSettings();
      setSettings(stored);
      return stored;
    } catch (error) {
      console.error("Erreur chargement paramètres locaux :", error);
      return null;
    }
  }, []);

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

    const handleSettingsUpdated = () => {
      if (!mounted) return;
      void refreshSettings();
    };

    load();

    window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);

    return () => {
      mounted = false;

      window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [refreshSettings]);

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
          window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
        } catch (error) {
          console.error("Erreur sauvegarde paramètres locaux :", error);
        }
      }, 250);
    },
    []
  );

  const updateSettingsNow = useCallback(
    async (partial: Partial<Omit<LocalSettings, "id">>) => {
      try {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }

        const updated = await saveSettings(partial);
        setSettings(updated);
        window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
        return updated;
      } catch (error) {
        console.error("Erreur sauvegarde immédiate paramètres locaux :", error);
        throw error;
      }
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
      window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
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
    updateSettingsNow,
    updateFuel,
    refuelFull,
    refreshSettings,
  };
}