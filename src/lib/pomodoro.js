const DEFAULT_KEY = "pomodoro:global";

export function getPomodoroStorageKey(serverId = "") {
  if (typeof window === "undefined") return DEFAULT_KEY;
  const storedServerId = sessionStorage.getItem("activeServerId") || "";
  const keyId = String(serverId || storedServerId || "").trim();
  return keyId ? `pomodoro:server:${keyId}` : DEFAULT_KEY;
}

export function getStoredPomodoroState(storageKey) {
  if (typeof window === "undefined" || !storageKey) return null;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const phase = parsed?.phase === "break" ? "break" : "focus";
    const secondsLeft = Number.isFinite(parsed?.secondsLeft)
      ? Math.max(1, Math.floor(parsed.secondsLeft))
      : null;
    const isRunning = Boolean(parsed?.isRunning);
    const updatedAt = Number.isFinite(parsed?.updatedAt) ? parsed.updatedAt : Date.now();
    if (!secondsLeft) return null;
    return { phase, secondsLeft, isRunning, updatedAt };
  } catch (_error) {
    return null;
  }
}
