import { useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { createServer, joinServerByCode, listServers } from "../lib/api";
import { getStoredUsername, setStoredUsername } from "../lib/identity";
import { useTheme } from "../theme-context.jsx";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDay, toggleMode } = useTheme();

  const username = (
    location.state?.username?.trim() ||
    getStoredUsername() ||
    "Guest"
  ).trim();

  const [createServerName, setCreateServerName] = useState("");
  const [serverCode, setServerCode] = useState("");
  const [filterText, setFilterText] = useState("");
  const [serverType, setServerType] = useState("Public");
  const [playerCount, setPlayerCount] = useState("8");

  const [servers, setServers] = useState([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [serversError, setServersError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoiningByCode, setIsJoiningByCode] = useState(false);
  const [joiningServerId, setJoiningServerId] = useState("");

  useEffect(() => {
    if (username && username !== "Guest") {
      setStoredUsername(username);
    }
  }, [username]);

  const filteredServers = useMemo(() => {
    const value = filterText.trim().toLowerCase();
    if (!value) return servers;
    return servers.filter((server) =>
      server.name.toLowerCase().includes(value),
    );
  }, [filterText, servers]);

  async function fetchServers(showLoading = true) {
    if (showLoading) setServersLoading(true);
    setServersError("");
    try {
      const payload = await listServers();
      setServers(Array.isArray(payload.servers) ? payload.servers : []);
    } catch (error) {
      setServersError(error.message || "Failed to load servers");
    } finally {
      if (showLoading) setServersLoading(false);
    }
  }

  useEffect(() => {
    fetchServers(true);
  }, []);

  function handlePlayerCountChange(value) {
    if (value === "") {
      setPlayerCount("");
      return;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    setPlayerCount(String(Math.min(12, Math.max(1, numeric))));
  }

  function persistActiveServer(server, member) {
    try {
      sessionStorage.setItem("activeServerName", server.name || "My Server");
      sessionStorage.setItem("activeServerId", server.id || "");
      sessionStorage.setItem("activeServerCode", server.code || "");
      sessionStorage.setItem("activeMemberId", member.id || "");
    } catch (error) {
      // Ignore storage errors.
    }
  }

  function openCatChooser(flowType, server, member) {
    persistActiveServer(server, member);
    navigate("/choosecat1", {
      state: {
        username,
        flowType,
        serverName: server.name,
        serverId: server.id,
        serverCode: server.code,
        memberId: member.id,
      },
    });
  }

  async function handleCreateServer() {
    const name = createServerName.trim();
    if (!name || isCreating) return;
    setActionError("");
    setIsCreating(true);

    try {
      const payload = await createServer({
        name,
        username,
        type: serverType,
        maxPlayers: Number(playerCount || 8),
      });
      await fetchServers(false);
      openCatChooser("create", payload.server, payload.member);
    } catch (error) {
      setActionError(error.message || "Failed to create server");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinByCode() {
    const code = serverCode.trim();
    if (!code || isJoiningByCode) return;
    setActionError("");
    setIsJoiningByCode(true);

    try {
      const payload = await joinServerByCode({ code, username });
      await fetchServers(false);
      openCatChooser("join-by-code", payload.server, payload.member);
    } catch (error) {
      setActionError(error.message || "Failed to join server");
    } finally {
      setIsJoiningByCode(false);
    }
  }

  async function handleJoinListedServer(server) {
    if (!server?.code || joiningServerId) return;
    setActionError("");
    setJoiningServerId(server.id);

    try {
      const payload = await joinServerByCode({
        code: server.code,
        username,
      });
      await fetchServers(false);
      openCatChooser("join-server", payload.server, payload.member);
    } catch (error) {
      setActionError(error.message || "Failed to join server");
    } finally {
      setJoiningServerId("");
    }
  }

  return (
    <div
      className={`relative min-h-screen overflow-hidden px-4 py-8 transition-all duration-[2000ms] md:px-8 ${
        isDay
          ? "bg-gradient-to-t from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3]"
          : "bg-gradient-to-t from-[#0F172A] via-[#1E293B] to-[#334155]"
      }`}
    >
      <button
        onClick={toggleMode}
        aria-label="Toggle light/dark mode"
        className={`group absolute right-12 top-12 z-20 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full outline-none transition-all duration-[2000ms] ${
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

      <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-white/30 blur-2xl" />
      <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-primary/25 blur-2xl" />

      <div className="relative mx-auto max-w-6xl rounded-[2.5rem] border-4 border-primary/40 bg-surface/40 p-5 shadow-2xl backdrop-blur-xl md:p-8">
        <p className="mb-5 text-lg font-semibold text-slate-800">
          Welcome, {username}
        </p>

        <section>
          <div className="inline-block rounded-t-[18px] border-4 border-b-0 border-primary/50 bg-primary px-8 py-3 font-card text-3xl font-black tracking-tight text-white">
            Create Server
          </div>
          <div className="rounded-r-[24px] rounded-bl-[24px] border-4 border-primary/50 bg-white/30 p-5">
            <div className="mb-4 flex gap-3">
              <input
                value={createServerName}
                onChange={(event) => setCreateServerName(event.target.value)}
                placeholder="Server Name"
                className="h-14 flex-1 rounded-2xl border-2 border-primary/40 bg-white/85 px-4 text-xl font-semibold text-slate-800 placeholder:text-slate-500 outline-none"
              />
              <button
                onClick={handleCreateServer}
                disabled={!createServerName.trim() || isCreating}
                className={`h-14 rounded-2xl border-2 border-primary/40 px-8 font-card text-2xl font-black tracking-tight transition ${
                  createServerName.trim() && !isCreating
                    ? "bg-white/90 text-slate-800 hover:bg-white"
                    : "cursor-not-allowed bg-slate-200/70 text-slate-500"
                }`}
              >
                {isCreating ? "Creating..." : "Create"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-lg font-semibold text-slate-800">
              <div className="flex items-center gap-3">
                <span>Type:</span>
                <div className="inline-flex rounded-xl border-2 border-primary/40 bg-white/75 p-1">
                  <button
                    onClick={() => setServerType("Public")}
                    className={`rounded-lg px-4 py-1 font-bold transition ${
                      serverType === "Public"
                        ? "bg-primary text-white"
                        : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    Public
                  </button>
                  <button
                    onClick={() => setServerType("Private")}
                    className={`rounded-lg px-4 py-1 font-bold transition ${
                      serverType === "Private"
                        ? "bg-slate-700 text-white"
                        : "text-slate-700 hover:bg-white"
                    }`}
                  >
                    Private
                  </button>
                </div>
              </div>

              <label className="inline-flex items-center gap-2">
                <span>Players:</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={playerCount}
                  onChange={(event) =>
                    handlePlayerCountChange(event.target.value)
                  }
                  placeholder="1-12"
                  className="h-10 w-24 rounded-xl border-2 border-primary/40 bg-white/80 px-3 text-center text-base font-bold text-slate-800 outline-none"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="inline-block rounded-t-[18px] border-4 border-b-0 border-primary/50 bg-[#e9e2d6] px-8 py-3 font-card text-3xl font-black tracking-tight text-slate-800">
            Join Server
          </div>
          <div className="rounded-r-[24px] rounded-bl-[24px] border-4 border-primary/50 bg-white/30 p-5">
            <div className="mb-4 flex gap-3">
              <input
                value={serverCode}
                onChange={(event) => setServerCode(event.target.value)}
                placeholder="Join Server by Code"
                className="h-14 flex-1 rounded-2xl border-2 border-primary/40 bg-white/85 px-4 text-xl font-semibold text-slate-800 placeholder:text-slate-500 outline-none"
              />
              <button
                onClick={handleJoinByCode}
                disabled={!serverCode.trim() || isJoiningByCode}
                className={`h-14 rounded-2xl border-2 border-primary/40 px-10 font-card text-2xl font-black tracking-tight transition ${
                  serverCode.trim() && !isJoiningByCode
                    ? "bg-primary text-white hover:bg-accent"
                    : "cursor-not-allowed bg-slate-200 text-slate-500"
                }`}
              >
                {isJoiningByCode ? "Joining..." : "Join"}
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3 border-t-2 border-primary/25 pt-4">
              <input
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                placeholder="Filter server names"
                className="h-12 min-w-[220px] flex-1 rounded-xl border-2 border-primary/40 bg-white/85 px-4 text-lg text-slate-800 outline-none"
              />
              <button className="h-12 rounded-xl border-2 border-primary/40 bg-primary px-8 font-card text-xl font-black tracking-tight text-white transition hover:bg-accent">
                Filter
              </button>
            </div>

            <div className="max-h-[340px] space-y-3 overflow-auto pr-2">
              {serversLoading && (
                <p className="rounded-xl border-2 border-primary/30 bg-white/70 p-3 text-center font-semibold text-slate-700">
                  Loading servers...
                </p>
              )}
              {serversError && (
                <p className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-center font-semibold text-red-700">
                  {serversError}
                </p>
              )}
              {!serversLoading && !serversError && filteredServers.length === 0 && (
                <p className="rounded-xl border-2 border-primary/30 bg-white/70 p-3 text-center font-semibold text-slate-700">
                  No servers found.
                </p>
              )}

              {filteredServers.map((server) => (
                <article
                  key={server.id}
                  className="flex items-center gap-3 rounded-2xl border-2 border-primary/40 bg-white/85 p-3"
                >
                  <div className="min-w-0 flex-1 py-1">
                    <p className="truncate text-xl font-semibold text-slate-800">
                      {server.name}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Code: {server.code}
                    </p>
                  </div>
                  <p className="w-20 text-center text-xl font-bold text-slate-800">
                    {server.playersLabel || `${server.totalMembers}/${server.maxPlayers}`}
                  </p>
                  <button
                    onClick={() => handleJoinListedServer(server)}
                    disabled={
                      joiningServerId === server.id ||
                      Number(server.totalMembers) >= Number(server.maxPlayers)
                    }
                    className={`h-12 rounded-xl border-2 border-primary/40 px-8 font-card text-xl font-black tracking-tight transition ${
                      joiningServerId === server.id ||
                      Number(server.totalMembers) >= Number(server.maxPlayers)
                        ? "cursor-not-allowed bg-slate-200 text-slate-500"
                        : "bg-primary text-white hover:bg-accent"
                    }`}
                  >
                    {joiningServerId === server.id
                      ? "Joining..."
                      : Number(server.totalMembers) >= Number(server.maxPlayers)
                        ? "Full"
                        : "Join"}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {actionError && (
          <p className="mt-5 rounded-xl border-2 border-red-300 bg-red-50 p-3 text-center font-semibold text-red-700">
            {actionError}
          </p>
        )}

        <div className="mt-7 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="h-14 w-44 rounded-2xl border-2 border-primary/40 bg-white/85 font-card text-2xl font-black tracking-tight text-slate-800 transition hover:bg-white"
          >
            Back
          </button>
          <button
            onClick={() => fetchServers(true)}
            className="h-14 w-56 rounded-2xl border-2 border-primary/40 bg-primary font-card text-2xl font-black tracking-tight text-white transition hover:bg-accent"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
