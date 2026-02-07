import { useMemo, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../theme-context.jsx";
import { useLocation, useNavigate } from "react-router-dom";

const demoServers = [
  {
    name: "Personal Day, Focusing On Self",
    players: "1/16",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDay, toggleMode } = useTheme();
  const [serverName, setServerName] = useState("");
  const [serverCode, setServerCode] = useState("");
  const [filterText, setFilterText] = useState("");
  const [serverType, setServerType] = useState("Public");
  const [playerCount, setPlayerCount] = useState("8");
  const username = location.state?.username || "Guest";

  const [errorMessageCreation, setErrorMessageCreation] = useState("");
  const [errorMessageJoin, setErrorMessageJoin] = useState("");

  const filteredServers = useMemo(() => {
    const value = filterText.trim().toLowerCase();
    if (!value) return demoServers;
    return demoServers.filter((server) =>
      server.name.toLowerCase().includes(value),
    );
  }, [filterText]);

  function handlePlayerCountChange(value) {
    if (value === "") {
      setPlayerCount("");
      return;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    setPlayerCount(String(Math.min(12, Math.max(1, numeric))));
  }

  function openCatChooser(flowType) {
    if (!serverName.trim() && flowType === "create") {
      setErrorMessageCreation("Server name cannot be empty.");
      return;
    }
    if (!serverCode.trim() && flowType === "join-by-code") {
      setErrorMessageJoin("Server code cannot be empty.");
      return;
    }
    navigate("/choosecat1", {
      state: {
        username,
        flowType,
      },
    });
  }

  return (
    <div className={`relative min-h-screen overflow-hidden transition-all duration-[2000ms] px-4 py-8 md:px-8 ${
      isDay
        ? "bg-gradient-to-t from-[#88A7BE] via-[#A6C0D2] to-[#C8D8E3]"
        : "bg-gradient-to-t from-[#0F172A] via-[#1E293B] to-[#334155]"
    }`}>
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
                placeholder="Server Name"
                onChange={(event) => setServerName(event.target.value)}
                className="h-14 flex-1 rounded-2xl border-2 border-primary/40 bg-white/85 px-4 text-xl font-semibold text-slate-800 placeholder:text-slate-500 outline-none"
              />
              <button
                onClick={() => openCatChooser("create")}
                className="h-14 rounded-2xl border-2 border-primary/40 bg-white/90 px-8 font-card text-2xl font-black tracking-tight text-slate-800 transition hover:bg-white"
              >
                Create
              </button>
            </div>

            {errorMessageCreation && (
              <p className="mb-4 text-sm font-semibold text-red-600">{errorMessageCreation}</p>
            )}

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
                onClick={() => openCatChooser("join-by-code")}
                className="h-14 rounded-2xl border-2 border-primary/40 bg-primary px-10 font-card text-2xl font-black tracking-tight text-white n hover:bg-accent hover:text-black"
              >
                Join
              </button>
            </div>

            {errorMessageJoin && (
              <p className="mb-4 text-sm font-semibold text-red-600">{errorMessageJoin}</p>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-3 border-t-2 border-primary/25 pt-4">
              <input
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                placeholder="Filter server names"
                className="h-12 min-w-[220px] flex-1 rounded-xl border-2 border-primary/40 bg-white/85 px-4 text-lg text-slate-800 outline-none"
              />
              <button className="h-12 rounded-xl border-2 border-accent/40 bg-accent px-8 font-card text-xl font-black tracking-tight text-black transition hover:bg-surface">
                Filter
              </button>
            </div>

            <div className="max-h-[340px] space-y-3 overflow-auto ">
              {filteredServers.map((server) => (
                <article
                  key={server.name}
                  className="flex items-center gap-3 rounded-2xl border-2 border-primary/40 bg-white/85 p-3"
                >
                  <div className="min-w-0 flex-1 py-1">
                    <p className="truncate text-xl font-semibold text-slate-800">
                      {server.name}
                    </p>
                  </div>
                  <p className="w-20 text-center text-xl font-bold text-slate-800">
                    {server.players}
                  </p>
                  <button
                    onClick={() => openCatChooser("join-server")}
                    className="h-12 rounded-xl border-2 border-accent/40 bg-accent px-8 font-card text-xl font-black tracking-tight text-black transition hover:bg-surface"
                  >
                    Join
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-7 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="h-14 w-44 rounded-2xl border-2 border-primary/40 bg-white/85 font-card text-2xl font-black tracking-tight text-slate-800 transition hover:bg-white"
          >
            Back
          </button>
          <button className="h-14 w-56 rounded-2xl border-2 border-primary/40 bg-primary font-card text-2xl font-black tracking-tight text-white transition hover:bg-accent">
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
