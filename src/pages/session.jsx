import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { actionOptions, catOptions } from "./catFlowOptions";
import { io } from "socket.io-client";
import { getServer } from "../lib/api";

export default function Session() {
  const CAT_SIZE = 160;
  const navigate = useNavigate();
  const location = useLocation();
  const selectedCat = location.state?.selectedCat || catOptions[0].id;
  const selectedAction = location.state?.selectedAction || actionOptions[0].id;
  const initialServerName = (() => {
    const fromState = location.state?.serverName?.trim();
    if (fromState) return fromState;
    try {
      const saved = sessionStorage.getItem("activeServerName")?.trim();
      if (saved) return saved;
    } catch (error) {
      // Ignore storage errors.
    }
    return "My Server";
  })();
  const serverId =
    location.state?.serverId || sessionStorage.getItem("activeServerId") || "";
  const memberId =
    location.state?.memberId || sessionStorage.getItem("activeMemberId") || "";
  const [serverName, setServerName] = useState(initialServerName);
  const [serverCode, setServerCode] = useState(
    location.state?.serverCode || sessionStorage.getItem("activeServerCode") || "",
  );
  const [showNewTabForm, setShowNewTabForm] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [newTabUrl, setNewTabUrl] = useState("");
  const [customTabs, setCustomTabs] = useState([]);
  const [members, setMembers] = useState([]);
  const [membersError, setMembersError] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("offline");
  const [catPos, setCatPos] = useState({ x: 80, y: 90 });
  const [isDraggingCat, setIsDraggingCat] = useState(false);
  const stageRef = useRef(null);
  const dragRef = useRef({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });

  const finalCat = useMemo(() => {
    return catOptions.find((cat) => cat.id === selectedCat) || catOptions[0];
  }, [selectedCat]);

  const actionName = useMemo(() => {
    const found = actionOptions.find((action) => action.id === selectedAction);
    return found ? found.name : actionOptions[0].name;
  }, [selectedAction]);

  const menuItems = [
    { id: "flashcards", label: "Flashcards", icon: "🗂️" },
    { id: "quizzes", label: "Quizzes", icon: "📝" },
    { id: "chatbot", label: "Chatbot", icon: "🤖" },
    { id: "friends", label: "Friends", icon: "👥" },
  ];

  function normalizeUrl(rawUrl) {
    const trimmed = rawUrl.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }

  function addNewTab() {
    const name = newTabName.trim();
    const url = normalizeUrl(newTabUrl);
    if (!name || !url) return;

    try {
      new URL(url);
      setCustomTabs((prev) => [...prev, { id: Date.now(), name, url }]);
      setNewTabName("");
      setNewTabUrl("");
      setShowNewTabForm(false);
    } catch (error) {
      // Ignore invalid URLs and keep the form open for correction.
    }
  }

  useEffect(() => {
    try {
      if (serverId) sessionStorage.setItem("activeServerId", serverId);
      if (memberId) sessionStorage.setItem("activeMemberId", memberId);
      if (serverName) sessionStorage.setItem("activeServerName", serverName);
      if (serverCode) sessionStorage.setItem("activeServerCode", serverCode);
    } catch (error) {
      // Ignore storage errors.
    }
  }, [memberId, serverCode, serverId, serverName]);

  useEffect(() => {
    let cancelled = false;

    async function loadServerSnapshot() {
      if (!serverId) return;
      setMembersError("");
      try {
        const payload = await getServer(serverId);
        if (cancelled) return;
        setMembers(Array.isArray(payload.server?.members) ? payload.server.members : []);
        if (payload.server?.name) setServerName(payload.server.name);
        if (payload.server?.code) setServerCode(payload.server.code);
      } catch (error) {
        if (!cancelled) {
          setMembersError(error.message || "Could not load members");
        }
      }
    }

    loadServerSnapshot();
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  useEffect(() => {
    if (!serverId || !memberId) return;
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    setRealtimeStatus("connecting");
    setMembersError("");

    socket.on("connect", () => {
      socket.emit("server:subscribe", { serverId, memberId });
    });

    socket.on("server:subscribed", (payload) => {
      const server = payload?.server;
      if (!server) return;
      setRealtimeStatus("online");
      setMembers(Array.isArray(server.members) ? server.members : []);
      if (server.name) setServerName(server.name);
      if (server.code) setServerCode(server.code);
    });

    socket.on("server:members", (payload) => {
      const server = payload?.server;
      if (!server) return;
      setMembers(Array.isArray(server.members) ? server.members : []);
      if (server.name) setServerName(server.name);
      if (server.code) setServerCode(server.code);
    });

    socket.on("server:error", (payload) => {
      setRealtimeStatus("error");
      setMembersError(payload?.error || "Realtime connection error");
    });

    socket.on("disconnect", () => {
      setRealtimeStatus("offline");
    });

    return () => {
      socket.emit("server:unsubscribe");
      socket.disconnect();
    };
  }, [memberId, serverId]);

  function clampCatPosition(x, y) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x, y };
    return {
      x: Math.max(0, Math.min(x, rect.width - CAT_SIZE)),
      y: Math.max(0, Math.min(y, rect.height - CAT_SIZE)),
    };
  }

  function startDrag(event) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current.dragging = true;
    dragRef.current.offsetX = event.clientX - rect.left - catPos.x;
    dragRef.current.offsetY = event.clientY - rect.top - catPos.y;
    setIsDraggingCat(true);
  }

  useEffect(() => {
    function handlePointerMove(event) {
      if (!dragRef.current.dragging) return;
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nextX = event.clientX - rect.left - dragRef.current.offsetX;
      const nextY = event.clientY - rect.top - dragRef.current.offsetY;
      setCatPos(clampCatPosition(nextX, nextY));
    }

    function stopDrag() {
      if (!dragRef.current.dragging) return;
      dragRef.current.dragging = false;
      setIsDraggingCat(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-t from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3] px-4 py-8">
      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/30 blur-2xl" />
      <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-primary/25 blur-2xl" />

      <div className="relative flex w-full max-w-7xl flex-col gap-5 lg:flex-row">
        <aside className="flex w-full flex-col rounded-[2.5rem] border-4 border-primary/40 bg-surface/40 p-5 shadow-2xl backdrop-blur-xl lg:w-72 lg:shrink-0">
          <h2 className="font-card text-3xl font-black tracking-tight text-slate-900">
            Menu
          </h2>

          <nav className="mt-5 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-primary/40 bg-white/80 px-3 py-2 text-left text-lg font-bold text-slate-800 transition hover:bg-white"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface text-lg">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <section className="mt-5 rounded-xl border-2 border-primary/35 bg-white/70 p-3">
            <h3 className="font-card text-xl font-black tracking-tight text-slate-900">
              Members
            </h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Status: {realtimeStatus}
            </p>
            {serverCode && (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Code: {serverCode}
              </p>
            )}
            {membersError && (
              <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                {membersError}
              </p>
            )}
            <div className="mt-2 max-h-36 space-y-1 overflow-auto pr-1">
              {members.length === 0 && (
                <p className="text-sm font-semibold text-slate-700">
                  No members yet.
                </p>
              )}
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-primary/25 bg-white/80 px-2 py-1"
                >
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {member.username}
                  </p>
                  <span
                    className={`ml-2 inline-block h-2.5 w-2.5 rounded-full ${
                      member.online ? "bg-green-500" : "bg-slate-400"
                    }`}
                    title={member.online ? "Online" : "Offline"}
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="mt-auto border-t-2 border-primary/25 pt-4">
            {customTabs.length > 0 && (
              <div className="mb-3 space-y-2">
                {customTabs.map((tab) => (
                  <a
                    key={tab.id}
                    href={tab.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate rounded-lg border-2 border-primary/35 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-white"
                    title={tab.url}
                  >
                    {tab.name}
                  </a>
                ))}
              </div>
            )}

            {showNewTabForm && (
              <div className="mb-3 space-y-2">
                <input
                  value={newTabName}
                  onChange={(event) => setNewTabName(event.target.value)}
                  placeholder="Tab name"
                  className="h-10 w-full rounded-lg border-2 border-primary/35 bg-white/90 px-3 text-sm font-medium text-slate-800 outline-none"
                />
                <input
                  value={newTabUrl}
                  onChange={(event) => setNewTabUrl(event.target.value)}
                  placeholder="Website URL"
                  className="h-10 w-full rounded-lg border-2 border-primary/35 bg-white/90 px-3 text-sm font-medium text-slate-800 outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addNewTab}
                    className="h-9 flex-1 rounded-lg bg-primary text-sm font-bold uppercase text-white transition hover:bg-accent"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowNewTabForm(false);
                      setNewTabName("");
                      setNewTabUrl("");
                    }}
                    className="h-9 flex-1 rounded-lg bg-white text-sm font-bold uppercase text-slate-800 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowNewTabForm((prev) => !prev)}
              className="h-11 w-full rounded-xl border-2 border-primary/40 bg-white/90 font-card text-xl font-black tracking-tight text-slate-800 transition hover:bg-white"
            >
              + New Tab
            </button>
          </div>
        </aside>

        <main className="flex-1 rounded-[2.5rem] border-4 border-primary/40 bg-surface/40 p-5 shadow-2xl backdrop-blur-xl">
          <div
            ref={stageRef}
            className="relative h-[72vh] w-full overflow-hidden rounded-[2rem] border-2 border-primary/35 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/background.jpg')" }}
          >
            <div className="absolute left-4 top-4 rounded-xl border border-white/40 bg-slate-900/45 px-4 py-3 text-white backdrop-blur-sm">
              <p className="font-card text-2xl font-black tracking-tight">
                {serverName}
              </p>
              <p className="text-sm font-semibold">
                {finalCat.name} · {actionName}
              </p>
            </div>

            <img
              src={finalCat.gif}
              alt={`Session cat ${finalCat.name}`}
              onPointerDown={startDrag}
              className={`absolute select-none bg-transparent object-contain ${
                isDraggingCat ? "cursor-grabbing" : "cursor-grab"
              }`}
              style={{
                width: `${CAT_SIZE}px`,
                height: `${CAT_SIZE}px`,
                left: `${catPos.x}px`,
                top: `${catPos.y}px`,
                touchAction: "none",
              }}
              draggable={false}
            />

            <div className="absolute bottom-4 left-4 rounded-lg border border-white/50 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-800">
              Drag the cat anywhere on the session background.
            </div>

            <button
              onClick={() => navigate("/dashboard")}
              className="absolute bottom-4 right-4 h-12 rounded-xl border-2 border-primary/45 bg-primary px-6 font-card text-xl font-black tracking-tight text-white transition hover:bg-accent"
            >
              Back
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
