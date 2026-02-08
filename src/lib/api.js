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

export function talkWithCat(payload) {
  return request("/api/talk-cat/message", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTalkCatWebRtcToken(agentId) {
  const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
  return request(`/api/talk-cat/webrtc-token${query}`);
}

export function talkCatTts(payload) {
  return request("/api/talk-cat/tts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function talkCatStt(payload) {
  return request("/api/talk-cat/stt", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listFlashcardDecks(username) {
  const query = `?username=${encodeURIComponent(username || "Guest")}`;
  return request(`/api/flashcards/decks${query}`);
}

export function createFlashcardDeck(payload) {
  return request("/api/flashcards/decks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getFlashcardDeck(deckId, username) {
  const query = `?username=${encodeURIComponent(username || "Guest")}`;
  return request(`/api/flashcards/decks/${encodeURIComponent(deckId)}${query}`);
}

export function regenerateFlashcardDeck(deckId, payload) {
  return request(`/api/flashcards/decks/${encodeURIComponent(deckId)}/regenerate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteFlashcardDeck(deckId, username) {
  const query = `?username=${encodeURIComponent(username || "Guest")}`;
  return request(`/api/flashcards/decks/${encodeURIComponent(deckId)}${query}`, {
    method: "DELETE",
  });
}

export function listQuizzes(username) {
  const query = `?username=${encodeURIComponent(username || "Guest")}`;
  return request(`/api/quizzes${query}`);
}

export function createQuiz(payload) {
  return request("/api/quizzes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getQuiz(quizId, username) {
  const query = `?username=${encodeURIComponent(username || "Guest")}`;
  return request(`/api/quizzes/${encodeURIComponent(quizId)}${query}`);
}

export function submitQuiz(quizId, payload) {
  return request(`/api/quizzes/${encodeURIComponent(quizId)}/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
