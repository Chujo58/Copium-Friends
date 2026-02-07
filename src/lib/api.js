async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export function listServers() {
  return request("/api/servers");
}

export function getServer(serverId) {
  return request(`/api/servers/${serverId}`);
}

export function createServer(payload) {
  return request("/api/servers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function joinServerByCode(payload) {
  return request("/api/servers/join", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function leaveServer(payload) {
  return request("/api/servers/leave", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
