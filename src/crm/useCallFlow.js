import { useEffect, useState, useSyncExternalStore } from "react";
import { subscribe, getState, refreshLocalRecs } from "./callFlow";
import { subscribeCallSettings } from "./calls";

/** Live status van opname, uploads en lokaal bewaarde opnames. */
export function useCallFlow() {
  const state = useSyncExternalStore(subscribe, getState, getState);
  useEffect(() => {
    refreshLocalRecs();
  }, []);
  return state;
}

/** Live instellingen/tegoed (settings/gesprekken). */
export function useCallSettings() {
  const [settings, setSettings] = useState({});
  useEffect(
    () =>
      subscribeCallSettings(setSettings, (e) => {
        console.error("gespreksinstellingen", e);
      }),
    []
  );
  return settings;
}
