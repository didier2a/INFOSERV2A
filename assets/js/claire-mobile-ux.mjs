export const PHONE_MEDIA_QUERY = "(max-width: 768px)";

export const MOBILE_SURFACES = Object.freeze({
  PIP: "pip",
  CLAIRE: "claire",
  SHEET: "sheet",
  GUIDED: "guided"
});

function normalizedPath(pathname = "") {
  const value = String(pathname || "").split(/[?#]/, 1)[0].replace(/^\/+/, "");
  return value || "index.html";
}

export function isMobileFormPath(pathname = "") {
  return /^(?:devis|contact)\.html$/i.test(normalizedPath(pathname));
}

export function mobileTabForLocation(pathname = "", hash = "") {
  const path = normalizedPath(pathname);
  if (path === "index.html") {
    return String(hash || "").replace(/^#/, "") === "services" ? "services" : "accueil";
  }
  if (path === "devis.html" || path === "contact.html") return "devis";
  return "services";
}

export function siteSurfaceForPath(pathname = "") {
  return isMobileFormPath(pathname) ? MOBILE_SURFACES.SHEET : MOBILE_SURFACES.PIP;
}

export function createMobileUxState({ pathname = "", hash = "" } = {}) {
  return {
    surface: siteSurfaceForPath(pathname),
    activeTab: mobileTabForLocation(pathname, hash),
    pathname: normalizedPath(pathname),
    hash: String(hash || ""),
    sheetExpanded: false,
    returnSurface: siteSurfaceForPath(pathname)
  };
}

export function reduceMobileUx(state, event = {}) {
  const current = state && typeof state === "object"
    ? state
    : createMobileUxState();
  const type = typeof event === "string" ? event : event.type;
  const pathname = typeof event === "object" && "pathname" in event
    ? event.pathname
    : current.pathname;
  const hash = typeof event === "object" && "hash" in event
    ? event.hash
    : current.hash;

  switch (type) {
    case "route": {
      const surface = siteSurfaceForPath(pathname);
      return {
        ...current,
        surface,
        activeTab: mobileTabForLocation(pathname, hash),
        pathname: normalizedPath(pathname),
        hash: String(hash || ""),
        sheetExpanded: false,
        returnSurface: surface
      };
    }
    case "open-claire":
      return {
        ...current,
        surface: MOBILE_SURFACES.CLAIRE,
        activeTab: "claire",
        sheetExpanded: false
      };
    case "show-site": {
      const surface = siteSurfaceForPath(pathname);
      return {
        ...current,
        surface,
        activeTab: mobileTabForLocation(pathname, hash),
        pathname: normalizedPath(pathname),
        hash: String(hash || ""),
        sheetExpanded: false,
        returnSurface: surface
      };
    }
    case "open-sheet":
      return {
        ...current,
        surface: MOBILE_SURFACES.SHEET,
        activeTab: "devis",
        sheetExpanded: Boolean(event.expanded),
        returnSurface: MOBILE_SURFACES.SHEET
      };
    case "expand-sheet":
      return current.surface === MOBILE_SURFACES.SHEET
        ? { ...current, sheetExpanded: true }
        : current;
    case "collapse-sheet":
      return current.surface === MOBILE_SURFACES.SHEET
        ? { ...current, sheetExpanded: false }
        : current;
    case "guide":
      return {
        ...current,
        surface: MOBILE_SURFACES.GUIDED,
        sheetExpanded: false,
        returnSurface: siteSurfaceForPath(pathname)
      };
    case "dismiss-guide": {
      const surface = current.returnSurface || siteSurfaceForPath(pathname);
      return {
        ...current,
        surface,
        activeTab: mobileTabForLocation(pathname, hash),
        sheetExpanded: false
      };
    }
    default:
      return { ...current };
  }
}

export function mobileUxLocksScroll(state) {
  return Boolean(
    state?.surface === MOBILE_SURFACES.GUIDED
    || (state?.surface === MOBILE_SURFACES.SHEET && state?.sheetExpanded)
  );
}
