export const PHONE_MEDIA_QUERY = "(max-width: 768px)";
export const MOBILE_PIP_STORAGE_KEY = "infoserv2a.claire.pip-position";
export const MOBILE_PIP_DRAG_THRESHOLD_PX = 8;
export const MOBILE_PIP_EDGE_MAGNET_PX = 20;
export const CLAIRE_DISCOVERY_DISMISSED_KEY = "infoserv2a.claire.discovery-dismissed";
export const CLAIRE_DISCOVERY_SEEN_KEY = "infoserv2a.claire.discovery-seen";

export const MOBILE_SURFACES = Object.freeze({
  SITE: "site",
  PIP: "pip",
  CLAIRE: "claire",
  SHEET: "sheet",
  GUIDED: "guided"
});

function storageValue(storage, key) {
  try {
    return storage?.getItem?.(key) || "";
  } catch {
    return "";
  }
}

function storeValue(storage, key) {
  try {
    storage?.setItem?.(key, "1");
    return true;
  } catch {
    return false;
  }
}

export function shouldShowClaireDiscovery(sessionStorageRef, localStorageRef) {
  return (
    storageValue(localStorageRef, CLAIRE_DISCOVERY_DISMISSED_KEY) !== "1"
    && storageValue(sessionStorageRef, CLAIRE_DISCOVERY_SEEN_KEY) !== "1"
  );
}

export function markClaireDiscoverySeen(sessionStorageRef) {
  return storeValue(sessionStorageRef, CLAIRE_DISCOVERY_SEEN_KEY);
}

export function dismissClaireDiscovery(sessionStorageRef, localStorageRef) {
  markClaireDiscoverySeen(sessionStorageRef);
  return storeValue(localStorageRef, CLAIRE_DISCOVERY_DISMISSED_KEY);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(finite(value, minimum), minimum), maximum);
}

function pipLimits(bounds = {}, size = {}) {
  const left = finite(bounds.left);
  const top = finite(bounds.top);
  const right = Math.max(left, finite(bounds.right, left));
  const bottom = Math.max(top, finite(bounds.bottom, top));
  const width = Math.max(0, finite(size.width));
  const height = Math.max(0, finite(size.height));
  return {
    minX: left,
    minY: top,
    maxX: Math.max(left, right - width),
    maxY: Math.max(top, bottom - height)
  };
}

export function clampMobilePipPoint(point = {}, bounds = {}, size = {}) {
  const limits = pipLimits(bounds, size);
  return {
    x: clamp(point.x, limits.minX, limits.maxX),
    y: clamp(point.y, limits.minY, limits.maxY)
  };
}

export function mobilePipPointFromPercent(position = {}, bounds = {}, size = {}) {
  const limits = pipLimits(bounds, size);
  const x = clamp(position.x, 0, 1);
  const y = clamp(position.y, 0, 1);
  return {
    x: limits.minX + ((limits.maxX - limits.minX) * x),
    y: limits.minY + ((limits.maxY - limits.minY) * y)
  };
}

export function mobilePipPercentFromPoint(point = {}, bounds = {}, size = {}) {
  const limits = pipLimits(bounds, size);
  const clamped = clampMobilePipPoint(point, bounds, size);
  const spanX = limits.maxX - limits.minX;
  const spanY = limits.maxY - limits.minY;
  return {
    x: spanX > 0 ? (clamped.x - limits.minX) / spanX : 0,
    y: spanY > 0 ? (clamped.y - limits.minY) / spanY : 0
  };
}

export function magnetizeMobilePipPoint(
  point = {},
  bounds = {},
  size = {},
  threshold = MOBILE_PIP_EDGE_MAGNET_PX
) {
  const limits = pipLimits(bounds, size);
  const next = clampMobilePipPoint(point, bounds, size);
  const distance = Math.max(0, finite(threshold, MOBILE_PIP_EDGE_MAGNET_PX));
  if (Math.abs(next.x - limits.minX) <= distance) next.x = limits.minX;
  else if (Math.abs(limits.maxX - next.x) <= distance) next.x = limits.maxX;
  if (Math.abs(next.y - limits.minY) <= distance) next.y = limits.minY;
  else if (Math.abs(limits.maxY - next.y) <= distance) next.y = limits.maxY;
  return next;
}

export function mobilePipDragExceeded(start = {}, current = {}) {
  return Math.hypot(
    finite(current.x) - finite(start.x),
    finite(current.y) - finite(start.y)
  ) >= MOBILE_PIP_DRAG_THRESHOLD_PX;
}

function normalizedPath(pathname = "") {
  const value = String(pathname || "")
    .split(/[?#]/, 1)[0]
    .replace(/^\/+|\/+$/g, "");
  return value || "index.html";
}

export function isMobileFormPath(pathname = "") {
  return /^(?:devis|contact)(?:\.html)?$/i.test(normalizedPath(pathname));
}

export function mobileTabForLocation(pathname = "", hash = "") {
  const path = normalizedPath(pathname);
  if (path === "index.html") {
    return String(hash || "").replace(/^#/, "") === "services" ? "services" : "accueil";
  }
  if (/^(?:devis|contact)(?:\.html)?$/i.test(path)) return "devis";
  return "services";
}

export function siteSurfaceForPath() {
  return MOBILE_SURFACES.SITE;
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
      const surface = current.surface === MOBILE_SURFACES.PIP
        ? MOBILE_SURFACES.PIP
        : siteSurfaceForPath(pathname);
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
    case "show-pip":
      return {
        ...current,
        surface: MOBILE_SURFACES.PIP,
        activeTab: mobileTabForLocation(pathname, hash),
        pathname: normalizedPath(pathname),
        hash: String(hash || ""),
        sheetExpanded: false,
        returnSurface: MOBILE_SURFACES.SITE
      };
    case "evacuate-pip":
      return {
        ...current,
        surface: MOBILE_SURFACES.SITE,
        activeTab: mobileTabForLocation(pathname, hash),
        pathname: normalizedPath(pathname),
        hash: String(hash || ""),
        sheetExpanded: false,
        returnSurface: MOBILE_SURFACES.SITE
      };
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
