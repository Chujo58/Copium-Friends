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

function roomName(serverId) {
  return `server:${serverId}`;
}

function serializeMember(member) {
  return {
    id: member.id,
    username: member.username,
    online: Boolean(member.online),
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
    joinedAt: Date.now(),
  };
  server.members.set(member.id, member);
  return member;
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

io.on("connection", (socket) => {
  socket.on("server:subscribe", (payload = {}) => {
    const serverId = String(payload.serverId || "");
    const memberId = String(payload.memberId || "");
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

    socket.emit("server:subscribed", {
      server: serializeServer(server),
      member: serializeMember(member),
    });
    broadcastMembers(serverId);
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
