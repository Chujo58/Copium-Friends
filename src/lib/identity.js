const USERNAME_KEY = "copium_username";

export function getStoredUsername() {
  try {
    const value = localStorage.getItem(USERNAME_KEY);
    return value ? value.trim() : "";
  } catch (error) {
    return "";
  }
}

export function setStoredUsername(username) {
  const value = String(username || "").trim();
  if (!value) return;
  try {
    localStorage.setItem(USERNAME_KEY, value);
  } catch (error) {
    // Ignore storage errors.
  }
}
