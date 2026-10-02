import { useCallback, useEffect, useState } from "react";

/** Pagina's van het Command Center. Hash-routes: geen router-dependency nodig. */
export const ROUTES = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "leads", label: "Leads", icon: "users" },
  { key: "agenda", label: "Agenda", icon: "calendar" },
  { key: "kpis", label: "KPI's", icon: "chart" },
  { key: "partners", label: "Partners", icon: "briefcase" },
  { key: "commissies", label: "Commissies", icon: "euro" },
];
export const BOTTOM_ROUTES = [
  { key: "instellingen", label: "Instellingen", icon: "cog" },
  { key: "help", label: "Help / handleiding", icon: "help" },
];
const KNOWN = new Set([...ROUTES, ...BOTTOM_ROUTES].map((r) => r.key));

function parse() {
  const h = String(window.location.hash || "").replace(/^#\/?/, "");
  const [page, ...rest] = h.split("/");
  return { page: KNOWN.has(page) ? page : "dashboard", param: rest.join("/") || "" };
}

/** { page, param, navigate(page, param?) } */
export function useHashRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const navigate = useCallback((page, param = "") => {
    const hash = `#/${page}${param ? `/${param}` : ""}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    setRoute({ page, param });
  }, []);
  return { ...route, navigate };
}

/** Kleine voorkeur per gebruiker in de browser (bijv. kaarten/tabel). */
export function usePref(userId, key, initial) {
  const storageKey = `msk:${userId}:${key}`;
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw === null ? initial : JSON.parse(raw);
    } catch (e) {
      return initial;
    }
  });
  const set = useCallback(
    (v) =>
      setValue((prev) => {
        const next = typeof v === "function" ? v(prev) : v;
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {
          /* opslag niet beschikbaar: alleen in geheugen */
        }
        return next;
      }),
    [storageKey]
  );
  return [value, set];
}
