import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

const PORT = Number(process.env.PORT || 3001);
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const servers = new Map();
const codeToServerId = new Map();
const socketPresence = new Map();

function randomId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  if (codeToServerId.has(code)) return createJoinCode();
  return code;
}

function normalizeName(value, fallback = "Guest") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeUsernameKey(username) {
  return normalizeName(username, "").toLowerCase();
}

function roomName(serverId) {
  return `server:${serverId}`;
}

function serializeMember(member) {
  return {
    id: member.id,
    username: member.username,
    online: Boolean(member.online),
    selectedCat: member.selectedCat || null,
    selectedAction: member.selectedAction || null,
    x: Number.isFinite(member.x) ? member.x : 80,
    y: Number.isFinite(member.y) ? member.y : 90,
    joinedAt: member.joinedAt,
  };
}

function serializeServer(server) {
  const members = Array.from(server.members.values()).map(serializeMember);
  return {
    id: server.id,
    code: server.code,
    name: server.name,
    type: server.type,
    maxPlayers: server.maxPlayers,
    createdAt: server.createdAt,
    membersOnline: members.filter((member) => member.online).length,
    totalMembers: members.length,
    members,
  };
}

function createMember(server, username) {
  const member = {
    id: randomId("member"),
    username: normalizeName(username),
    online: false,
    socketId: null,
    selectedCat: null,
    selectedAction: null,
    x: 80,
    y: 90,
    joinedAt: Date.now(),
  };
  server.members.set(member.id, member);
  return member;
}

function removeMemberFromServer(serverId, memberId) {
  const server = servers.get(serverId);
  if (!server) return false;
  return server.members.delete(memberId);
}

function isUsernameTaken(username, excludeMemberId = "") {
  const key = normalizeUsernameKey(username);
  if (!key) return false;
  for (const server of servers.values()) {
    for (const member of server.members.values()) {
      if (member.id === excludeMemberId) continue;
      if (normalizeUsernameKey(member.username) === key) return true;
    }
  }
  return false;
}

function safeCoordinate(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(5000, numeric));
}

function broadcastMembers(serverId) {
  const server = servers.get(serverId);
  if (!server) return;
  io.to(roomName(serverId)).emit("server:members", {
    server: serializeServer(server),
  });
}

function markMemberOfflineBySocket(socketId) {
  const presence = socketPresence.get(socketId);
  if (!presence) return;
  const server = servers.get(presence.serverId);
  if (server) {
    const member = server.members.get(presence.memberId);
    if (member) {
      member.online = false;
      member.socketId = null;
    }
    broadcastMembers(presence.serverId);
  }
  socketPresence.delete(socketId);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, servers: servers.size });
});

app.get("/api/servers", (_req, res) => {
  const list = Array.from(servers.values()).map((server) => {
    const serialized = serializeServer(server);
    return {
      id: serialized.id,
      code: serialized.code,
      name: serialized.name,
      type: serialized.type,
      maxPlayers: serialized.maxPlayers,
      membersOnline: serialized.membersOnline,
      totalMembers: serialized.totalMembers,
      playersLabel: `${serialized.totalMembers}/${serialized.maxPlayers}`,
    };
  });
  res.json({ servers: list });
});

app.get("/api/servers/:serverId", (req, res) => {
  const server = servers.get(req.params.serverId);
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  res.json({ server: serializeServer(server) });
});

app.post("/api/servers", (req, res) => {
  const name = normalizeName(req.body?.name, "");
  const username = normalizeName(req.body?.username);
  if (!name) {
    res.status(400).json({ error: "Server name is required" });
    return;
  }
  if (isUsernameTaken(username)) {
    res.status(409).json({ error: "Username already taken. Choose another one." });
    return;
  }

  const requestedType = String(req.body?.type || "Public").toLowerCase();
  const type = requestedType === "private" ? "Private" : "Public";
  const requestedMax = Number(req.body?.maxPlayers || 12);
  const maxPlayers = Math.max(1, Math.min(12, Math.floor(requestedMax)));

  const id = randomId("server");
  const code = createJoinCode();
  const server = {
    id,
    code,
    name,
    type,
    maxPlayers,
    members: new Map(),
    createdAt: Date.now(),
  };

  const hostMember = createMember(server, username);
  servers.set(id, server);
  codeToServerId.set(code, id);

  res.status(201).json({
    server: serializeServer(server),
    member: serializeMember(hostMember),
  });
});

app.post("/api/servers/join", (req, res) => {
  const code = String(req.body?.code || "")
    .trim()
    .toUpperCase();
  const username = normalizeName(req.body?.username);
  if (!code) {
    res.status(400).json({ error: "Join code is required" });
    return;
  }
  if (isUsernameTaken(username)) {
    res.status(409).json({ error: "Username already taken. Choose another one." });
    return;
  }

  const serverId = codeToServerId.get(code);
  if (!serverId || !servers.has(serverId)) {
    res.status(404).json({ error: "Server code not found" });
    return;
  }

  const server = servers.get(serverId);
  if (server.members.size >= server.maxPlayers) {
    res.status(409).json({ error: "Server is full" });
    return;
  }

  const member = createMember(server, username);
  res.json({
    server: serializeServer(server),
    member: serializeMember(member),
  });
});

app.post("/api/servers/leave", (req, res) => {
  const serverId = String(req.body?.serverId || "").trim();
  const memberId = String(req.body?.memberId || "").trim();
  if (!serverId || !memberId) {
    res.status(400).json({ error: "serverId and memberId are required" });
    return;
  }

  const removed = removeMemberFromServer(serverId, memberId);
  if (!removed) {
    res.status(404).json({ error: "Member not found in server" });
    return;
  }

  broadcastMembers(serverId);
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  socket.on("server:subscribe", (payload = {}) => {
    const serverId = String(payload.serverId || "");
    const memberId = String(payload.memberId || "");
    const selectedCat = String(payload.selectedCat || "").trim();
    const selectedAction = String(payload.selectedAction || "").trim();
    const server = servers.get(serverId);

    if (!server) {
      socket.emit("server:error", { error: "Server not found" });
      return;
    }

    const member = server.members.get(memberId);
    if (!member) {
      socket.emit("server:error", { error: "Member not found in server" });
      return;
    }

    markMemberOfflineBySocket(socket.id);

    socket.join(roomName(serverId));
    socketPresence.set(socket.id, { serverId, memberId });
    member.online = true;
    member.socketId = socket.id;
    if (selectedCat) member.selectedCat = selectedCat;
    if (selectedAction) member.selectedAction = selectedAction;

    socket.emit("server:subscribed", {
      server: serializeServer(server),
      member: serializeMember(member),
    });
    broadcastMembers(serverId);
  });

  socket.on("server:move", (payload = {}) => {
    const presence = socketPresence.get(socket.id);
    if (!presence) return;
    const server = servers.get(presence.serverId);
    if (!server) return;
    const member = server.members.get(presence.memberId);
    if (!member) return;

    member.x = safeCoordinate(payload.x, member.x);
    member.y = safeCoordinate(payload.y, member.y);
    broadcastMembers(presence.serverId);
  });

  socket.on("server:leave", (_payload = {}, callback) => {
    const presence = socketPresence.get(socket.id);
    if (!presence) {
      if (typeof callback === "function") callback({ ok: true });
      return;
    }

    const { serverId, memberId } = presence;
    socket.leave(roomName(serverId));
    socketPresence.delete(socket.id);
    removeMemberFromServer(serverId, memberId);
    broadcastMembers(serverId);

    if (typeof callback === "function") callback({ ok: true });
  });

  socket.on("server:unsubscribe", () => {
    markMemberOfflineBySocket(socket.id);
  });

  socket.on("disconnect", () => {
    markMemberOfflineBySocket(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
