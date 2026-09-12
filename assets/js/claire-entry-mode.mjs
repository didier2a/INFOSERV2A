export function resolveInitialClaireState({
  requested = "",
  storedMode = "",
  seen = false,
  phone = false
} = {}) {
  if (requested === "1" || requested === "start") return "arrival";
  if (requested === "guided" || requested === "continue" || storedMode === "guided") return "guided";
  if (storedMode === "shared") return "guided";
  if (storedMode === "manual" || seen) return "manual";
  return phone ? "choice" : "arrival";
}
