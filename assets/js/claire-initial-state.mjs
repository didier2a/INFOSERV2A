export function resolveInitialClaireState({
  requested = "",
  storedMode = null,
  seen = false,
  phone = false
} = {}) {
  if (requested === "1" || requested === "start") return "arrival";
  if (["guided", "continue"].includes(requested) || storedMode === "guided" || storedMode === "shared") {
    return "guided";
  }
  if (storedMode === "manual" || seen) return "manual";
  return phone ? "choice" : "arrival";
}
