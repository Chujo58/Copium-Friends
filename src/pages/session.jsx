import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../theme-context.jsx";
import { Sun, Moon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { actionOptions, catOptions } from "./catFlowOptions";
import { io } from "socket.io-client";
import { MessageCircle } from "lucide-react";
import { getServer, leaveServer } from "../lib/api";
import { getStoredUsername } from "../lib/identity";

const KNOWN_BLOCKED_IFRAME_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "google.com",
  "accounts.google.com",
  "github.com",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "discord.com",
  "slack.com",
  "notion.so",
  "notion.site",
  "microsoftonline.com",
  "login.live.com",
  "appleid.apple.com",
];

export default function Session() {
  const CAT_SIZE = 160;
  const navigate = useNavigate();
  const location = useLocation();
  const { isDay, toggleMode } = useTheme();

  const selectedCat =
    location.state?.selectedCat ||
    sessionStorage.getItem("activeSelectedCat") ||
    sessionStorage.getItem("selectedCatId") ||
    catOptions[0].id;
  const selectedAction =
    location.state?.selectedAction ||
    sessionStorage.getItem("activeSelectedAction") ||
    actionOptions[0].id;
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
  const [selectedTabId, setSelectedTabId] = useState("");
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [overlayTarget, setOverlayTarget] = useState(null);
  const [overlayCatPosition, setOverlayCatPosition] = useState({ x: 90, y: 90 });
  const [sharedOverlay, setSharedOverlay] = useState(null);
  const [overlayHint, setOverlayHint] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatPop, setChatPop] = useState(false);

  const [members, setMembers] = useState([]);
  const [membersError, setMembersError] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("offline");
  const [isDraggingCat, setIsDraggingCat] = useState(false);
  const [isOverlayDraggingCat, setIsOverlayDraggingCat] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const stageRef = useRef(null);
  const overlayStageRef = useRef(null);
  const chatScrollRef = useRef(null);
  const socketRef = useRef(null);
  const isChatOpenRef = useRef(false);
  const memberIdRef = useRef(memberId);
  const dragRef = useRef({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
    memberId: "",
  });
  const overlayDragRef = useRef({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });

  const menuItems = [
    { id: "flashcards", label: "Flashcards", icon: "🗂️" },
    { id: "quizzes", label: "Quizzes", icon: "📝" },
    { id: "chatbot", label: "Chatbot", icon: "🤖" },
    { id: "talk-cat", label: "Talk With Cat", icon: "🐱" },
  ];

  const finalCat = useMemo(() => {
    return catOptions.find((cat) => cat.id === selectedCat) || catOptions[0];
  }, [selectedCat]);

  const actionName = useMemo(() => {
    const found = actionOptions.find((action) => action.id === selectedAction);
    return found ? found.name : actionOptions[0].name;
  }, [selectedAction]);

  const ownMember = useMemo(
    () => members.find((member) => member.id === memberId) || null,
    [memberId, members],
  );

  const visibleMembers = useMemo(() => {
    const onlineMembers = members.filter((member) => member.online);
    if (!memberId) return onlineMembers;

    const ownOnline = onlineMembers.some((member) => member.id === memberId);
    if (ownOnline) return onlineMembers;

    const ownAnyState = members.find((member) => member.id === memberId);
    if (ownAnyState) return [...onlineMembers, ownAnyState];

    return [
      ...onlineMembers,
      {
        id: memberId,
        username: getStoredUsername() || "You",
        online: false,
        selectedCat,
        x: 80,
        y: 90,
      },
    ];
  }, [memberId, members, selectedCat]);

  const selectedTab = useMemo(() => {
    if (!selectedTabId) return null;
    return customTabs.find((tab) => String(tab.id) === String(selectedTabId)) || null;
  }, [customTabs, selectedTabId]);

  useEffect(() => {
    if (!selectedTabId && customTabs.length > 0) {
      setSelectedTabId(String(customTabs[0].id));
    }
  }, [customTabs, selectedTabId]);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setUnreadChatCount(0);
      setChatPop(false);
    }
  }, [isChatOpen]);

  useEffect(() => {
    memberIdRef.current = memberId;
  }, [memberId]);

  useEffect(() => {
    if (!chatPop) return;
    const timer = window.setTimeout(() => setChatPop(false), 220);
    return () => window.clearTimeout(timer);
  }, [chatPop]);

  useEffect(() => {
    try {
      if (serverId) sessionStorage.setItem("activeServerId", serverId);
      if (memberId) sessionStorage.setItem("activeMemberId", memberId);
      if (serverName) sessionStorage.setItem("activeServerName", serverName);
      if (serverCode) sessionStorage.setItem("activeServerCode", serverCode);
      if (selectedCat) {
        sessionStorage.setItem("activeSelectedCat", selectedCat);
        sessionStorage.setItem("selectedCatId", selectedCat);
      }
      if (selectedAction) sessionStorage.setItem("activeSelectedAction", selectedAction);
    } catch (error) {
      // Ignore storage errors.
    }
  }, [memberId, selectedAction, selectedCat, serverCode, serverId, serverName]);

  function applyServerSnapshot(server) {
    if (!server) return;
    setMembers(Array.isArray(server.members) ? server.members : []);
    if (server.name) setServerName(server.name);
    if (server.code) setServerCode(server.code);
    setSharedOverlay(server.sharedOverlay || null);
    const nextMessages = Array.isArray(server.chatMessages) ? server.chatMessages : [];
    setChatMessages((prevMessages) => {
      if (prevMessages.length !== nextMessages.length) {
        return nextMessages;
      }
      const prevLast = prevMessages[prevMessages.length - 1];
      const nextLast = nextMessages[nextMessages.length - 1];
      if (prevLast?.id !== nextLast?.id) {
        return nextMessages;
      }
      return prevMessages;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadServerSnapshot() {
      if (!serverId) return;
      setMembersError("");
      try {
        const payload = await getServer(serverId);
        if (cancelled) return;
        applyServerSnapshot(payload.server);
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
    socketRef.current = socket;

    setRealtimeStatus("connecting");
    setMembersError("");

    socket.on("connect", () => {
      socket.emit("server:subscribe", {
        serverId,
        memberId,
        selectedCat,
        selectedAction,
      });
    });

    socket.on("server:subscribed", (payload) => {
      const server = payload?.server;
      if (!server) return;
      setRealtimeStatus("online");
      applyServerSnapshot(server);
    });

    socket.on("server:members", (payload) => {
      const server = payload?.server;
      if (!server) return;
      applyServerSnapshot(server);
    });

    socket.on("server:error", (payload) => {
      setRealtimeStatus("error");
      setMembersError(payload?.error || "Realtime connection error");
    });

    socket.on("server:chat:message", (payload) => {
      const message = payload?.message;
      if (!message?.id) return;
      let isDuplicate = false;
      setChatMessages((prev) => {
        isDuplicate = prev.some((existing) => existing.id === message.id);
        return isDuplicate ? prev : [...prev, message];
      });
      if (
        !isDuplicate &&
        !isChatOpenRef.current &&
        message.memberId !== memberIdRef.current
      ) {
        setUnreadChatCount((count) => count + 1);
        setChatPop(false);
        window.setTimeout(() => setChatPop(true), 0);
      }
    });

    socket.on("disconnect", () => {
      setRealtimeStatus("offline");
    });

    return () => {
      socket.emit("server:unsubscribe");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [memberId, selectedAction, selectedCat, serverId]);

  useEffect(() => {
    const node = chatScrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [chatMessages]);

  function clampPositionWithinRect(x, y, rect) {
    return {
      x: Math.max(0, Math.min(x, rect.width - CAT_SIZE)),
      y: Math.max(0, Math.min(y, rect.height - CAT_SIZE)),
    };
  }

  function clampStageCatPosition(x, y) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x, y };
    return clampPositionWithinRect(x, y, rect);
  }

  function startDrag(member, event) {
    if (!member || member.id !== memberId) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current.dragging = true;
    dragRef.current.memberId = member.id;
    dragRef.current.offsetX = event.clientX - rect.left - (member.x ?? 80);
    dragRef.current.offsetY = event.clientY - rect.top - (member.y ?? 90);
    setIsDraggingCat(true);
  }

  useEffect(() => {
    function handlePointerMove(event) {
      if (!dragRef.current.dragging) return;
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nextX = event.clientX - rect.left - dragRef.current.offsetX;
      const nextY = event.clientY - rect.top - dragRef.current.offsetY;
      const clamped = clampStageCatPosition(nextX, nextY);

      setMembers((prevMembers) =>
        prevMembers.map((member) =>
          member.id === dragRef.current.memberId
            ? { ...member, x: clamped.x, y: clamped.y }
            : member,
        ),
      );

      socketRef.current?.emit("server:move", clamped);
    }

    function stopDrag() {
      if (!dragRef.current.dragging) return;
      dragRef.current.dragging = false;
      dragRef.current.memberId = "";
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

  function startOverlayDrag(event) {
    if (!isOverlayOpen) return;
    const rect = overlayStageRef.current?.getBoundingClientRect();
    if (!rect) return;
    overlayDragRef.current.dragging = true;
    overlayDragRef.current.offsetX = event.clientX - rect.left - overlayCatPosition.x;
    overlayDragRef.current.offsetY = event.clientY - rect.top - overlayCatPosition.y;
    setIsOverlayDraggingCat(true);
  }

  useEffect(() => {
    function handleOverlayPointerMove(event) {
      if (!overlayDragRef.current.dragging) return;
      const rect = overlayStageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nextX = event.clientX - rect.left - overlayDragRef.current.offsetX;
      const nextY = event.clientY - rect.top - overlayDragRef.current.offsetY;
      const clamped = clampPositionWithinRect(nextX, nextY, rect);
      setOverlayCatPosition(clamped);
    }

    function stopOverlayDrag() {
      if (!overlayDragRef.current.dragging) return;
      overlayDragRef.current.dragging = false;
      setIsOverlayDraggingCat(false);
    }

    window.addEventListener("pointermove", handleOverlayPointerMove);
    window.addEventListener("pointerup", stopOverlayDrag);
    window.addEventListener("pointercancel", stopOverlayDrag);

    return () => {
      window.removeEventListener("pointermove", handleOverlayPointerMove);
      window.removeEventListener("pointerup", stopOverlayDrag);
      window.removeEventListener("pointercancel", stopOverlayDrag);
    };
  }, []);

  function getCatGif(member) {
    // Use member.selectedAction if present, otherwise fallback to selectedAction
    const actionId = member.selectedAction || selectedAction;
    const cat = catOptions.find((c) => c.id === member.selectedCat) || finalCat;
    // Try to get the image for the action
    if (actionId && cat[`${actionId}Image`]) {
      return cat[`${actionId}Image`];
    }
    // Fallback to default gif for the cat
    if (cat.gif) return cat.gif;
    return "/giphy.gif";
  }

  function normalizeUrl(rawUrl) {
    const trimmed = rawUrl.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }

  function shouldOpenInNewTab(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return KNOWN_BLOCKED_IFRAME_HOSTS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
    } catch (error) {
      return false;
    }
  }

  function isLocalhostUrl(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    } catch (error) {
      return false;
    }
  }

  function addNewTab() {
    const name = newTabName.trim();
    const url = normalizeUrl(newTabUrl);
    if (!name || !url) return;

    try {
      new URL(url);
      const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const nextTab = { id, name, url };
      setCustomTabs((prev) => [...prev, nextTab]);
      if (!selectedTabId) setSelectedTabId(id);
      setNewTabName("");
      setNewTabUrl("");
      setShowNewTabForm(false);
    } catch (error) {
      // Ignore invalid URLs and keep the form open for correction.
    }
  }

  async function leaveAndGoBack() {
    if (isLeaving) return;
    setIsLeaving(true);

    let left = false;
    const socket = socketRef.current;
    if (socket?.connected) {
      left = await new Promise((resolve) => {
        const timeout = window.setTimeout(() => resolve(false), 500);
        socket.emit("server:leave", {}, (result) => {
          window.clearTimeout(timeout);
          resolve(Boolean(result?.ok));
        });
      });
    }

    if (!left && serverId && memberId) {
      try {
        await leaveServer({ serverId, memberId });
      } catch (error) {
        // Fallback just navigates even if leave request fails.
      }
    }

    try {
      sessionStorage.removeItem("activeServerId");
      sessionStorage.removeItem("activeServerCode");
      sessionStorage.removeItem("activeMemberId");
    } catch (error) {
      // Ignore storage errors.
    }

    navigate("/dashboard", {
      state: { username: getStoredUsername() || "Guest" },
    });
  }

  function openOverlayForSelectedTab() {
    const link = selectedTab
      ? { name: selectedTab.name, url: selectedTab.url }
      : sharedOverlay
        ? { name: sharedOverlay.name, url: sharedOverlay.url }
        : null;
    if (!link) return;

    if (selectedTab) {
      socketRef.current?.emit("server:overlay:set", link);
      setSharedOverlay((prev) => ({
        ...prev,
        ...link,
        updatedBy: ownMember?.username || getStoredUsername() || "You",
        updatedAt: Date.now(),
      }));
    }

    openOverlayByLink(link);
  }

  function openOverlayByLink(link) {
    if (!link?.url) return;
    if (isLocalhostUrl(link.url) && window.location.hostname !== "localhost") {
      setOverlayHint(
        "This link uses localhost/127.0.0.1, which only works on the creator's machine. Use your LAN IP instead.",
      );
      setIsOverlayOpen(false);
      return;
    }
    if (shouldOpenInNewTab(link.url)) {
      const opened = window.open(link.url, "_blank", "noopener,noreferrer");
      if (opened) {
        setOverlayHint(
          `${link.name || "Link"} opened in a new tab because this domain blocks embedded overlays.`,
        );
      } else {
        setOverlayHint("Popup was blocked. Use the Open button next to the tab.");
      }
      setIsOverlayOpen(false);
      return;
    }
    setOverlayHint("");
    setOverlayTarget(link);
    setOverlayCatPosition({ x: 90, y: 90 });
    setIsOverlayOpen(true);
  }

  function sendChatMessage(event) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    if (!socketRef.current?.connected) {
      setChatError("Chat is disconnected. Rejoin the server.");
      return;
    }

    setIsSendingChat(true);
    setChatError("");
    socketRef.current.emit("server:chat:send", { text }, (result) => {
      setIsSendingChat(false);
      if (!result?.ok) {
        setChatError(result?.error || "Failed to send message");
        return;
      }
      setChatInput("");
    });
  }

  function handleSidebarAction(itemId) {
    if (itemId === "flashcards") {
      navigate("/flashcards", {
        state: {
          from: "session",
          username: getStoredUsername() || "Guest",
          serverId,
          serverName,
          serverCode,
          memberId,
          selectedCat,
          selectedAction,
        },
      });
      return;
    }

    if (itemId === "quizzes") {
      navigate("/quizzes", {
        state: {
          from: "session",
          username: getStoredUsername() || "Guest",
          serverId,
          serverName,
          serverCode,
          memberId,
          selectedCat,
          selectedAction,
        },
      });
      return;
    }

    if (itemId === "talk-cat") {
      navigate("/talk_cat", {
        state: {
          serverId,
          serverName,
          serverCode,
          memberId,
          selectedCat,
          selectedAction,
        },
      });
    }
  }

  return (
    <div
      className={`relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 transition-all duration-[2000ms] ${
        isDay
          ? "bg-gradient-to-t from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3]"
          : "bg-gradient-to-t from-[#0F172A] via-[#1E293B] to-[#334155]"
      }`}
    >
      <button
        onClick={toggleMode}
        aria-label="Toggle light/dark mode"
        className={`group fixed right-12 top-12 z-50 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full outline-none transition-all duration-[2000ms] ${
          isDay
            ? "bg-yellow-100 shadow-[0_0_80px_rgba(253,224,71,0.4)] hover:shadow-[0_0_100px_rgba(253,224,71,0.6)]"
            : "bg-slate-100 shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:shadow-[0_0_70px_rgba(255,255,255,0.4)]"
        }`}
      >
        <div className="transition-transform duration-700 group-hover:rotate-12 group-active:scale-90">
          {isDay ? (
            <Sun className="h-8 w-8 text-yellow-400/60" />
          ) : (
            <Moon className="h-7 w-7 fill-slate-400/10 text-slate-400/60" />
          )}
        </div>
      </button>
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
                onClick={() => handleSidebarAction(item.id)}
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
                <p className="text-sm font-semibold text-slate-700">No members yet.</p>
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
                {customTabs.map((tab) => {
                  const isSelected = String(selectedTabId) === String(tab.id);
                  return (
                    <div
                      key={tab.id}
                      className={`flex items-center gap-2 rounded-lg border-2 px-2 py-2 transition ${
                        isSelected
                          ? "border-primary/70 bg-primary/20"
                          : "border-primary/35 bg-white/80 hover:bg-white"
                      }`}
                    >
                      <button
                        onClick={() => setSelectedTabId(String(tab.id))}
                        className="flex-1 truncate text-left text-sm font-semibold text-slate-800"
                        title={tab.url}
                      >
                        {tab.name}
                      </button>
                      <a
                        href={tab.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-white/90 px-2 py-1 text-xs font-bold text-slate-700 transition hover:bg-white"
                        title="Open in new tab"
                      >
                        Open
                      </a>
                    </div>
                  );
                })}
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

            <button
              onClick={openOverlayForSelectedTab}
              disabled={!selectedTab && !sharedOverlay}
              className={`mt-3 h-11 w-full rounded-xl border-2 font-card text-lg font-black tracking-tight transition ${
                selectedTab || sharedOverlay
                  ? "border-primary/45 bg-primary text-white hover:bg-accent"
                  : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
              }`}
            >
              Overlay Selected Tab
            </button>
            {overlayHint && (
              <p className="mt-2 rounded-lg border border-primary/30 bg-white/80 px-2 py-1 text-xs font-semibold text-slate-700">
                {overlayHint}
              </p>
            )}
            {sharedOverlay?.url && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-white/75 p-2">
                <p className="truncate text-xs font-semibold text-slate-700">
                  Shared: {sharedOverlay.name || "Link"}
                  {sharedOverlay.updatedBy ? ` by ${sharedOverlay.updatedBy}` : ""}
                </p>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 rounded-[2.5rem] border-4 border-primary/40 bg-surface/40 p-5 shadow-2xl backdrop-blur-xl">
          <div
            ref={stageRef}
            className="relative h-[72vh] w-full overflow-hidden rounded-[2rem] border-2 border-primary/35 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/background.jpg')" }}
          >
            <button
              onClick={() => setIsChatOpen((prev) => !prev)}
              aria-label={isChatOpen ? "Close chat panel" : "Open chat panel"}
              title={isChatOpen ? "Close chat" : "Open chat"}
              className={`absolute right-4 top-4 z-20 inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 transition ${
                isChatOpen
                  ? "border-primary/55 bg-primary text-white hover:bg-accent"
                  : "border-slate-300/70 bg-slate-900/70 text-white hover:bg-slate-800/80"
              } ${chatPop ? "scale-110" : "scale-100"}`}
            >
              <MessageCircle className="h-5 w-5" />
              {unreadChatCount > 0 && (
                <>
                  <span className="absolute -right-1 -top-1 z-10 min-w-[1.1rem] rounded-full bg-red-500 px-1 text-center text-[10px] font-black leading-[1.1rem] text-white">
                    {unreadChatCount > 9 ? "9+" : unreadChatCount}
                  </span>
                  <span className="absolute -right-1 -top-1 h-[1.1rem] w-[1.1rem] rounded-full bg-red-400/70 animate-ping" />
                </>
              )}
            </button>

            <div className="absolute left-4 top-4 rounded-xl border border-white/40 bg-slate-900/45 px-4 py-3 text-white backdrop-blur-sm">
              <p className="font-card text-2xl font-black tracking-tight">{serverName}</p>
              <p className="text-sm font-semibold">
                {ownMember?.username || finalCat.name} · {actionName}
              </p>
            </div>

            {visibleMembers.map((member) => {
                const isSelf = member.id === memberId;
                return (
                  <div
                    key={member.id}
                    className="absolute"
                    style={{
                      left: `${member.x ?? 80}px`,
                      top: `${member.y ?? 90}px`,
                      width: `${CAT_SIZE}px`,
                      height: `${CAT_SIZE + 24}px`,
                    }}
                  >
                    <img
                      src={
                        isSelf && isDraggingCat && catOptions.find((c) => c.id === member.selectedCat)?.grabImage
                          ? catOptions.find((c) => c.id === member.selectedCat).grabImage
                          : getCatGif(member)
                      }
                      alt={`${member.username} character`}
                      onPointerDown={(event) => startDrag(member, event)}
                      className={`select-none bg-transparent object-contain ${
                        isSelf
                          ? isDraggingCat
                            ? "cursor-grabbing"
                            : "cursor-grab"
                          : "pointer-events-none cursor-default"
                      }`}
                      style={{
                        width: `${CAT_SIZE}px`,
                        height: `${CAT_SIZE}px`,
                        touchAction: "none",
                      }}
                      draggable={false}
                    />
                    <p className="mx-auto mt-1 w-fit rounded-full bg-white/80 px-2 py-0.5 text-center text-xs font-black text-slate-900">
                      {member.username}
                      {isSelf ? " (You)" : ""}
                    </p>
                  </div>
                );
              })}

            <div className="absolute bottom-4 left-4 rounded-lg border border-white/50 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-800">
              Drag only your own character. Everyone can see movement live.
            </div>

            <button
              onClick={leaveAndGoBack}
              disabled={isLeaving}
              className="absolute bottom-4 right-4 h-12 rounded-xl border-2 border-primary/45 bg-primary px-6 font-card text-xl font-black tracking-tight text-white transition hover:bg-accent"
            >
              {isLeaving ? "Leaving..." : "Back"}
            </button>

            {isChatOpen && (
              <aside className="absolute right-4 top-16 z-30 flex h-[calc(100%-5rem)] w-80 flex-col rounded-2xl border-2 border-primary/40 bg-white/90 p-3 shadow-xl backdrop-blur-xl">
                <h3 className="font-card text-2xl font-black tracking-tight text-slate-900">
                  Server Chat
                </h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Everyone in this session can chat.
                </p>

                <div
                  ref={chatScrollRef}
                  className="mt-3 min-h-[120px] flex-1 space-y-2 overflow-auto rounded-xl border-2 border-primary/30 bg-white/70 p-3"
                >
                  {chatMessages.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-600">
                      No messages yet.
                    </p>
                  ) : (
                    chatMessages.map((message) => {
                      const isSelf = message.memberId === memberId;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg border px-2 py-1 ${
                              isSelf
                                ? "border-primary/50 bg-primary/20"
                                : "border-slate-300 bg-white/85"
                            }`}
                          >
                            <p className="text-xs font-black uppercase tracking-wide text-slate-700">
                              {isSelf ? "You" : message.username}
                            </p>
                            <p className="break-words text-sm font-semibold text-slate-900">
                              {message.text}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={sendChatMessage} className="mt-3">
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    maxLength={400}
                    placeholder="Type a message"
                    className="h-11 w-full rounded-xl border-2 border-primary/35 bg-white/95 px-3 text-sm font-medium text-slate-800 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isSendingChat}
                    className={`mt-2 h-11 w-full rounded-xl border-2 font-card text-lg font-black tracking-tight transition ${
                      chatInput.trim() && !isSendingChat
                        ? "border-primary/45 bg-primary text-white hover:bg-accent"
                        : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                    }`}
                  >
                    {isSendingChat ? "Sending..." : "Send"}
                  </button>
                </form>

                {chatError && (
                  <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                    {chatError}
                  </p>
                )}
              </aside>
            )}
          </div>
        </main>
      </div>

      {isOverlayOpen && overlayTarget && (
        <div className="fixed inset-0 z-[90] bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-6xl flex-col rounded-[2rem] border-4 border-primary/45 bg-white/95 p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border-2 border-primary/35 bg-surface/50 px-4 py-3">
              <p className="truncate font-card text-2xl font-black tracking-tight text-slate-900">
                Overlay: {overlayTarget.name}
              </p>
              <button
                onClick={() => setIsOverlayOpen(false)}
                className="rounded-xl border-2 border-primary/45 bg-primary px-4 py-2 font-card text-lg font-black tracking-tight text-white transition hover:bg-accent"
              >
                Close
              </button>
            </div>

            <div
              ref={overlayStageRef}
              className="relative flex-1 overflow-hidden rounded-[1.5rem] border-2 border-primary/35"
            >
              <iframe
                src={overlayTarget.url}
                title={`Overlay ${overlayTarget.name}`}
                className="h-full w-full border-0 bg-white"
              />

              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${overlayCatPosition.x}px`,
                  top: `${overlayCatPosition.y}px`,
                  width: `${CAT_SIZE}px`,
                  height: `${CAT_SIZE + 20}px`,
                }}
              >
                <img
                  src={
                    isOverlayDraggingCat && catOptions.find((c) => c.id === (ownMember?.selectedCat || selectedCat))?.grabImage
                      ? catOptions.find((c) => c.id === (ownMember?.selectedCat || selectedCat)).grabImage
                      : getCatGif(ownMember || { selectedCat, username: getStoredUsername() || "You" })
                  }
                  alt="Your character"
                  onPointerDown={startOverlayDrag}
                  className={`pointer-events-auto select-none bg-transparent object-contain ${
                    isOverlayDraggingCat ? "cursor-grabbing" : "cursor-grab"
                  }`}
                  style={{
                    width: `${CAT_SIZE}px`,
                    height: `${CAT_SIZE}px`,
                    touchAction: "none",
                  }}
                  draggable={false}
                />
                <p className="mx-auto mt-1 w-fit rounded-full bg-white/80 px-2 py-0.5 text-center text-xs font-black text-slate-900">
                  {ownMember?.username || getStoredUsername() || "You"} (You)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
